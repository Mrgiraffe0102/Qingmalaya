/**
 * 全局弹窗管理（SUPER_ADMIN only）。
 *
 * 单条记录——首次保存时插入（id=1），之后 PUT 整体替换。
 * "启用"开关关闭时，前端 /popup/active 返回 null，移动端不再显示。
 */
import React, { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Space,
  Switch,
  Typography,
} from 'antd';
import { getPopup, updatePopup } from '@/api/popup';
import type { SitePopup, PopupUpdatePayload } from '@qingmalaya/shared';

const { Title, Text } = Typography;

interface PopupFormValues {
  title: string;
  content: string;
  enabled: boolean;
}

const PopupPage: React.FC = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm<PopupFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<SitePopup | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await getPopup();
        setCurrent(data);
        form.setFieldsValue({
          title: data?.title ?? '',
          content: data?.content ?? '',
          enabled: data?.enabled ?? true,
        });
      } catch (err) {
        message.error(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [form, message]);

  const onFinish = async (values: PopupFormValues) => {
    setSaving(true);
    try {
      const payload: PopupUpdatePayload = {
        title: values.title.trim(),
        content: values.content,
        enabled: values.enabled,
      };
      const updated = await updatePopup(payload);
      setCurrent(updated);
      message.success(current ? '已更新' : '已创建');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <Title level={4} style={{ marginBottom: 4 }}>
        全局弹窗
      </Title>
      <Text type="secondary">
        {current
          ? '编辑当前全站强制弹窗。用户每次打开/刷新网站时第一时间看到，关闭后本次会话内不再弹。'
          : '尚未创建。填写下方表单后点击保存即可启用。'}
      </Text>

      <Card style={{ marginTop: 16 }} loading={loading}>
        <Form<PopupFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ enabled: true }}
        >
          <Form.Item
            name="enabled"
            label="启用"
            valuePropName="checked"
            extra="关闭后，前台不再弹出（已关闭的会话刷新前会一直显示旧内容）。"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="title"
            label="标题"
            rules={[
              { required: true, message: '请输入标题' },
              { max: 120, message: '标题不超过 120 个字符' },
            ]}
          >
            <Input placeholder="例：关于开展新一期播客创作的通知" showCount maxLength={120} />
          </Form.Item>

          <Form.Item
            name="content"
            label="正文"
            rules={[
              { required: true, message: '请输入正文' },
              { max: 4000, message: '正文不超过 4000 个字符' },
            ]}
            extra="支持换行（前台会保留换行符），纯文本即可。"
          >
            <Input.TextArea
              placeholder="请输入要传达给所有用户的内容..."
              autoSize={{ minRows: 6, maxRows: 16 }}
              maxLength={4000}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {current ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PopupPage;
