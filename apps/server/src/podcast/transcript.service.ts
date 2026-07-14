import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import type {
  TranscriptData,
  TranscriptResponse,
  TranscriptSegment,
} from '@qingmalaya/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { appConfig } from '../app.config';

/**
 * Aliyun DashScope ASR transcription service.
 *
 * Uses the paraformer-v2 model via the async transcription API:
 *  1. Submit a task (POST /services/audio/asr/transcription)
 *  2. Poll for completion (GET /tasks/{task_id})
 *  3. Download + parse the result JSON
 *  4. Cache the segments in Podcast.transcript
 *
 * The POST endpoint kicks off the background work and returns immediately
 * with `{ status: 'processing' }`. The client polls GET until `ready`.
 */
@Injectable()
export class TranscriptService {
  private readonly logger = new Logger(TranscriptService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /podcasts/:id/transcript — return cached transcript state.
   */
  async getTranscript(podcastId: number): Promise<TranscriptResponse> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
      select: { transcript: true },
    });
    if (!podcast) throw new NotFoundException('播客不存在');
    if (!podcast.transcript) return { status: 'none' };

    const data = podcast.transcript as unknown as TranscriptData;
    return {
      status: data.status,
      segments: data.segments,
      fullText: data.fullText,
      error: data.error,
    };
  }

  /**
   * POST /podcasts/:id/transcript — kick off ASR generation.
   * Returns immediately; the actual work runs in the background.
   */
  async generateTranscript(
    podcastId: number,
  ): Promise<{ status: string }> {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
      select: { audioPath: true, transcript: true },
    });
    if (!podcast) throw new NotFoundException('播客不存在');

    // Already processing or ready — no-op
    if (podcast.transcript) {
      const data = podcast.transcript as unknown as TranscriptData;
      if (data.status === 'processing' || data.status === 'ready') {
        return { status: data.status };
      }
    }

    // Mark as processing
    await this.prisma.podcast.update({
      where: { id: podcastId },
      data: {
        transcript: { status: 'processing' },
      },
    });

    // Fire-and-forget background task
    void this.processTranscription(podcastId, podcast.audioPath);

    return { status: 'processing' };
  }

  /**
   * Upload a local audio file to DashScope's temporary OSS storage
   * and return an `oss://` URL that the ASR API can access.
   *
   * Two-step process:
   *  1. GET /uploads?action=getPolicy&model=fun-asr → get OSS upload credentials
   *  2. POST file to the OSS upload_host → file becomes available at oss://<key>
   */
  private async uploadAudioFile(audioPath: string): Promise<string> {
    const cfg = appConfig();
    const filePath = join(process.cwd(), cfg.upload.dir, audioPath);
    const fileBuffer = await readFile(filePath);
    const fileName = basename(audioPath);

    // 1. Get upload policy from DashScope
    const policyResp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/uploads?action=getPolicy&model=fun-asr`,
      {
        headers: { Authorization: `Bearer ${cfg.dashscope.apiKey}` },
      },
    );
    const policyBody = (await policyResp.json()) as {
      data?: {
        upload_dir?: string;
        oss_access_key_id?: string;
        signature?: string;
        policy?: string;
        x_oss_object_acl?: string;
        x_oss_forbid_overwrite?: string;
        upload_host?: string;
      };
    };
    const policy = policyBody.data;
    if (!policy?.upload_host) {
      throw new Error(
        `Failed to get upload policy: ${JSON.stringify(policyBody)}`,
      );
    }

    const key = `${policy.upload_dir}/${fileName}`;

    // 2. Upload file to OSS via multipart form
    const formData = new FormData();
    formData.append('OSSAccessKeyId', policy.oss_access_key_id!);
    formData.append('Signature', policy.signature!);
    formData.append('policy', policy.policy!);
    formData.append('x-oss-object-acl', policy.x_oss_object_acl!);
    formData.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite!);
    formData.append('key', key);
    formData.append('success_action_status', '200');
    formData.append('file', new Blob([fileBuffer]), fileName);

    const uploadResp = await fetch(policy.upload_host, {
      method: 'POST',
      body: formData,
    });
    if (!uploadResp.ok) {
      const text = await uploadResp.text();
      throw new Error(`OSS upload failed: ${uploadResp.status} ${text}`);
    }

    return `oss://${key}`;
  }

  /**
   * Background: upload audio → submit ASR task → poll → download → parse → save.
   */
  private async processTranscription(
    podcastId: number,
    audioPath: string,
  ): Promise<void> {
    const cfg = appConfig();
    try {
      if (!cfg.dashscope.apiKey) {
        throw new Error('DASHSCOPE_API_KEY is not configured');
      }

      // 0. Upload audio file to DashScope's temporary OSS storage
      this.logger.log(`Uploading audio file for podcast ${podcastId}: ${audioPath}`);
      const audioUrl = await this.uploadAudioFile(audioPath);
      this.logger.log(`Audio uploaded, submitting ASR task for podcast ${podcastId}: ${audioUrl}`);

      // 1. Submit transcription task (fun-asr: timestamps always enabled)
      const submitResp = await fetch(
        `${cfg.dashscope.baseUrl}/services/audio/asr/transcription`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.dashscope.apiKey}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
            'X-DashScope-OssResourceResolve': 'enable',
          },
          body: JSON.stringify({
            model: 'fun-asr',
            input: { file_urls: [audioUrl] },
            parameters: {
              language_hints: ['zh', 'en'],
            },
          }),
        },
      );
      const submitData = await submitResp.json() as {
        output?: { task_id?: string };
      };
      const taskId = submitData.output?.task_id;
      if (!taskId) {
        throw new Error(
          `ASR task submission failed: ${JSON.stringify(submitData)}`,
        );
      }
      this.logger.log(`ASR task submitted: ${taskId}`);

      // 2. Poll for completion
      const result = await this.pollTask(taskId);

      // 3. Download transcription JSON
      const transcriptionUrl =
        result.output?.results?.[0]?.transcription_url;
      if (!transcriptionUrl) {
        throw new Error('No transcription_url in ASR result');
      }
      const transcriptionResp = await fetch(transcriptionUrl);
      const transcriptionData = (await transcriptionResp.json()) as {
        transcripts?: Array<{
          sentences?: Array<{
            begin_time: number;
            end_time: number;
            text: string;
            sentence_id?: number;
          }>;
        }>;
      };

      // 4. Parse segments
      const sentences =
        transcriptionData.transcripts?.[0]?.sentences ?? [];
      const segments: TranscriptSegment[] = sentences.map((s, i) => ({
        beginTime: Math.floor(s.begin_time / 1000),
        endTime: Math.floor(s.end_time / 1000),
        text: s.text,
        sentenceId: s.sentence_id ?? i + 1,
      }));
      const fullText = segments.map((s) => s.text).join('');

      this.logger.log(
        `ASR completed for podcast ${podcastId}: ${segments.length} segments`,
      );

      // 5. Save to database
      const transcriptData: TranscriptData = {
        status: 'ready',
        segments,
        fullText,
      };
      await this.prisma.podcast.update({
        where: { id: podcastId },
        data: {
          transcript: transcriptData as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`ASR failed for podcast ${podcastId}: ${message}`);
      await this.prisma.podcast.update({
        where: { id: podcastId },
        data: {
          transcript: {
            status: 'failed',
            error: message,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  /**
   * Poll the Aliyun task API until SUCCEEDED / FAILED.
   * Max ~10 minutes (300 attempts × 2 s).
   */
  private async pollTask(taskId: string): Promise<{
    output?: {
      task_status?: string;
      results?: Array<{
        transcription_url?: string;
        subtask_status?: string;
      }>;
    };
  }> {
    const cfg = appConfig();
    const maxAttempts = 300;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const resp = await fetch(`${cfg.dashscope.baseUrl}/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${cfg.dashscope.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      const data = (await resp.json()) as {
        output?: {
          task_status?: string;
          message?: string;
          results?: Array<{
            transcription_url?: string;
            subtask_status?: string;
          }>;
        };
      };
      const status = data.output?.task_status;
      if (status === 'SUCCEEDED') return data;
      if (status === 'FAILED' || status === 'UNKNOWN') {
        this.logger.error(
          `ASR task ${status}, full response: ${JSON.stringify(data)}`,
        );
        throw new Error(
          `ASR task ${status}: ${data.output?.message ?? 'no message'}`,
        );
      }
    }
    throw new Error('ASR task timed out after 10 minutes');
  }
}
