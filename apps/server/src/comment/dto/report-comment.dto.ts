import { IsString, MaxLength } from 'class-validator';

/**
 * DTO for POST /comments/:id/report. Student admins report a comment with a
 * reason (required, max 500 chars). The report is forwarded to the teacher
 * managing the comment author's class.
 */
export class ReportCommentDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
