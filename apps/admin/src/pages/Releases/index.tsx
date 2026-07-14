/**
 * APP 更新管理 — admin page for uploading APK releases.
 *
 * ProTable lists all releases newest-first. ModalForm handles create
 * (version, versionCode, updateContent, APK file upload).
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormDigit,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag, Upload, type UploadProps } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { AppRelease } from '@qingmalaya/shared';
import {
  createRelease,
  deleteRelease,
  listReleases,
  uploadApk,
} from '@/api/releases';

interface ReleaseFormValues {
  version: string;
  versionCode: number;
  updateContent: string;
}

const ReleasesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [apkPath, setApkPath] = useState<string | undefined>(undefined);
  const [apkName, setApkName] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  const openCreate = () => {
    setApkPath(undefined);
    setApkName(undefined);
    setModalOpen(true);
  };

  const uploadProps: UploadProps = {
    accept: '.apk',
    maxCount: 1,
    showUploadList: true,
    customRequest: async (options) => {
      const { file, onSuccess, onError } = options;
      setUploading(true);
      try {
        const result = await uploadApk(file as File);
        setApkPath(result.path);
        setApkName(result.originalName);
        onSuccess?.(result);
        message.success('APK 上传成功');
      } catch (err) {
        onError?.(err as Error);
        message.error(err instanceof Error ? err.message : 'APK 上传失败');
      } finally {
        setUploading(false);
      }
    },
    onRemove: () => {
      setApkPath(undefined);
      setApkName(undefined);
    },
  };

  const handleSubmit = async (values: ReleaseFormValues) => {
    await createRelease({
      version: values.version,
      versionCode: values.versionCode,
      updateContent: values.updateContent,
      apkPath,
    });
    message.success('版本已发布');
    setModalOpen(false);
    actionRef.current?.reload();
    return true;
  };

  const handleDelete = async (row: AppRelease) => {
    try {
      await deleteRelease(row.id);
      message.success('版本已删除');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ProColumns<AppRelease>[] = [
    {
      title: '版本号',
      dataIndex: 'version',
      width: 120,
      render: (_, row) => (
        <Tag color="blue">v{row.version}</Tag>
      ),
    },
    {
      title: '版本序号',
      dataIndex: 'versionCode',
      width: 100,
    },
    {
      title: '更新内容',
      dataIndex: 'updateContent',
      ellipsis: true,
      width: 400,
    },
    {
      title: '安装包',
      dataIndex: 'apkPath',
      width: 100,
      render: (_, row) =>
        row.downloadUrl ? (
          <a href={row.downloadUrl} target="_blank" rel="noreferrer">
            下载
          </a>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '发布时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (_, row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 80,
      fixed: 'right',
      render: (_, row) => [
        <Popconfirm
          key="delete"
          title="确认删除该版本？安装包文件也会一并删除。"
          onConfirm={() => handleDelete(row)}
        >
          <a style={{ color: '#ba1a1a' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<AppRelease>
        headerTitle="APP 更新管理"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            发布新版本
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listReleases();
            return { data, success: true, total: data.length };
          } catch (err) {
            message.error(err instanceof Error ? err.message : '加载失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={columns}
        pagination={false}
        scroll={{ x: 980 }}
        options={{ reload: true, density: false, setting: false }}
      />
      <ModalForm<ReleaseFormValues>
        title="发布新版本"
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={{
          version: '',
          versionCode: undefined,
          updateContent: '',
        }}
        onFinish={handleSubmit}
        width={560}
      >
        <ProFormText
          name="version"
          label="版本号"
          placeholder="例如 1.0.0"
          rules={[
            { required: true, message: '请输入版本号' },
            { max: 30, message: '不超过 30 个字符' },
          ]}
        />
        <ProFormDigit
          name="versionCode"
          label="版本序号"
          placeholder="递增的整数，例如 1, 2, 3..."
          min={1}
          fieldProps={{ precision: 0 }}
          rules={[
            { required: true, message: '请输入版本序号' },
          ]}
        />
        <ProFormTextArea
          name="updateContent"
          label="更新内容"
          placeholder="请输入更新内容"
          fieldProps={{ autoSize: { minRows: 4, maxRows: 10 } }}
          rules={[{ required: true, message: '请输入更新内容' }]}
        />
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontWeight: 500, fontSize: 14 }}>安装包 (APK)</label>
          <div style={{ marginTop: 8 }}>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                选择 APK 文件
              </Button>
            </Upload>
            {apkName && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                已上传: {apkName}
              </div>
            )}
          </div>
        </div>
      </ModalForm>
    </>
  );
};

export default ReleasesPage;
