/**
 * 系统设置. OPERATOR+.
 *
 * Edits the two upload-related SystemSetting keys:
 *   - max_audio_size      (stored as bytes on the backend, shown as MB)
 *   - max_audio_duration   (stored as seconds on the backend, shown as minutes)
 */
import React, { useEffect, useState } from 'react';
import {
  ProCard,
  ProForm,
  ProFormDigit,
} from '@ant-design/pro-components';
import { App as AntdApp, Spin } from 'antd';
import { getSettings, updateSettings, type SettingsMap } from '@/api/settings';

const BYTES_PER_MB = 1024 * 1024;
const SECONDS_PER_MIN = 60;

/** Server defaults (must match SystemSettingService). */
const DEFAULT_MAX_AUDIO_SIZE_MB = 200;
const DEFAULT_MAX_AUDIO_DURATION_MIN = 60;

/** Keys managed by this page. */
const SETTING_KEYS = {
  MAX_AUDIO_SIZE: 'max_audio_size',
  MAX_AUDIO_DURATION: 'max_audio_duration',
} as const;

interface SettingsFormValues {
  maxAudioSizeMb: number;
  maxAudioDurationMin: number;
}

const SettingsPage: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [form] = ProForm.useForm<SettingsFormValues>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const map = await getSettings();
        if (cancelled) return;
        const rawSize = Number(map[SETTING_KEYS.MAX_AUDIO_SIZE] ?? 0);
        const rawDuration = Number(map[SETTING_KEYS.MAX_AUDIO_DURATION] ?? 0);
        form.setFieldsValue({
          maxAudioSizeMb:
            rawSize > 0
              ? Math.round(rawSize / BYTES_PER_MB)
              : DEFAULT_MAX_AUDIO_SIZE_MB,
          maxAudioDurationMin:
            rawDuration > 0
              ? Math.round(rawDuration / SECONDS_PER_MIN)
              : DEFAULT_MAX_AUDIO_DURATION_MIN,
        });
      } catch (e) {
        if (!cancelled) message.error((e as Error).message || '加载设置失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form, message]);

  const handleFinish = async (
    values: SettingsFormValues,
  ): Promise<boolean> => {
    try {
      const payload: SettingsMap = {
        [SETTING_KEYS.MAX_AUDIO_SIZE]: String(
          values.maxAudioSizeMb * BYTES_PER_MB,
        ),
        [SETTING_KEYS.MAX_AUDIO_DURATION]: String(
          values.maxAudioDurationMin * SECONDS_PER_MIN,
        ),
      };
      await updateSettings(payload);
      message.success('设置已保存');
      return true;
    } catch (e) {
      message.error((e as Error).message || '保存失败');
      return false;
    }
  };

  return (
    <ProCard title="系统设置" headerBordered bordered>
      <Spin spinning={loading}>
        <ProForm<SettingsFormValues>
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          submitter={{
            searchConfig: { submitText: '保存设置' },
            resetButtonProps: false,
          }}
          style={{ maxWidth: 560 }}
        >
          <ProFormDigit
            name="maxAudioSizeMb"
            label="上传音频文件大小上限 (MB)"
            min={1}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入文件大小上限' }]}
          />
          <ProFormDigit
            name="maxAudioDurationMin"
            label="上传音频时长上限 (分钟)"
            min={1}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入时长上限' }]}
          />
        </ProForm>
      </Spin>
    </ProCard>
  );
};

export default SettingsPage;
