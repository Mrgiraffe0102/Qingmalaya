/**
 * 系统设置 (Task 33). OPERATOR+.
 *
 * Edits the four SystemSetting keys (upload.maxFileSize, upload.maxDuration,
 * login.whitelist, cache.version). Values are stored as strings on the
 * backend; numeric fields are parsed/serialized here.
 */
import React, { useEffect, useState } from 'react';
import {
  ProCard,
  ProForm,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App as AntdApp, Spin } from 'antd';
import { getSettings, updateSettings, type SettingsMap } from '@/api/settings';

/** Keys managed by this page. */
const SETTING_KEYS = {
  MAX_FILE_SIZE: 'upload.maxFileSize',
  MAX_DURATION: 'upload.maxDuration',
  LOGIN_WHITELIST: 'login.whitelist',
  CACHE_VERSION: 'cache.version',
} as const;

interface SettingsFormValues {
  [SETTING_KEYS.MAX_FILE_SIZE]: number;
  [SETTING_KEYS.MAX_DURATION]: number;
  [SETTING_KEYS.LOGIN_WHITELIST]: string;
  [SETTING_KEYS.CACHE_VERSION]: number;
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
        form.setFieldsValue({
          [SETTING_KEYS.MAX_FILE_SIZE]: Number(map[SETTING_KEYS.MAX_FILE_SIZE] ?? 0),
          [SETTING_KEYS.MAX_DURATION]: Number(map[SETTING_KEYS.MAX_DURATION] ?? 0),
          [SETTING_KEYS.LOGIN_WHITELIST]: map[SETTING_KEYS.LOGIN_WHITELIST] ?? '',
          [SETTING_KEYS.CACHE_VERSION]: Number(map[SETTING_KEYS.CACHE_VERSION] ?? 0),
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
        [SETTING_KEYS.MAX_FILE_SIZE]: String(values[SETTING_KEYS.MAX_FILE_SIZE]),
        [SETTING_KEYS.MAX_DURATION]: String(values[SETTING_KEYS.MAX_DURATION]),
        [SETTING_KEYS.LOGIN_WHITELIST]: values[SETTING_KEYS.LOGIN_WHITELIST] ?? '',
        [SETTING_KEYS.CACHE_VERSION]: String(values[SETTING_KEYS.CACHE_VERSION]),
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
            name={[SETTING_KEYS.MAX_FILE_SIZE]}
            label="上传文件大小上限 (MB)"
            min={1}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入文件大小上限' }]}
          />
          <ProFormDigit
            name={[SETTING_KEYS.MAX_DURATION]}
            label="上传音频时长上限 (分钟)"
            min={1}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入时长上限' }]}
          />
          <ProFormTextArea
            name={[SETTING_KEYS.LOGIN_WHITELIST]}
            label="登录 IP 白名单"
            tooltip="每行一个 IP，或用逗号分隔"
            fieldProps={{ rows: 4, placeholder: '每行一个 IP，或用逗号分隔' }}
          />
          <ProFormDigit
            name={[SETTING_KEYS.CACHE_VERSION]}
            label="缓存版本号"
            min={0}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入缓存版本号' }]}
          />
        </ProForm>
      </Spin>
    </ProCard>
  );
};

export default SettingsPage;
