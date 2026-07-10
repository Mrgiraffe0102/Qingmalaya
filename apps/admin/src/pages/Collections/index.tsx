/**
 * 精选集管理 (Collection management).
 *
 * ProTable listing all collections. ModalForm handles create + edit with
 * podcast multi-select (options from GET /admin/podcasts/options).
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag as AntdTag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { BannerStatus } from '@qingmalaya/shared';
import {
  createCollection,
  deleteCollection,
  getCollectionDetail,
  listCollections,
  updateCollection,
  type CollectionListItem,
  type CollectionCreatePayload,
} from '@/api/collections';
import { listPodcastOptions } from '@/api/podcasts';
import ImagePicker from '@/components/ImagePicker';
import { coverUrl } from '@/utils/file';

const STATUS_LABEL: Record<BannerStatus, string> = {
  ONLINE: '上线',
  OFFLINE: '下线',
};

const STATUS_COLOR: Record<BannerStatus, string> = {
  ONLINE: 'green',
  OFFLINE: 'default',
};

interface CollectionFormValues {
  title: string;
  description?: string;
  coverPath?: string;
  podcastIds: number[];
  sort: number;
  status: BannerStatus;
}

const CollectionsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionListItem | null>(null);
  const [editingPodcastIds, setEditingPodcastIds] = useState<number[] | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setEditingPodcastIds(undefined);
    setModalOpen(true);
  };

  const openEdit = async (row: CollectionListItem) => {
    setEditing(row);
    setEditingPodcastIds(undefined);
    setDetailLoading(true);
    try {
      const detail = await getCollectionDetail(row.id);
      setEditingPodcastIds(detail.podcastIds);
      setModalOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载精选集详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: CollectionFormValues) => {
    const payload: CollectionCreatePayload = {
      title: values.title,
      description: values.description || undefined,
      coverPath: values.coverPath || undefined,
      podcastIds: values.podcastIds,
      sort: values.sort,
      status: values.status,
    };
    if (editing) {
      await updateCollection(editing.id, payload);
      message.success('精选集已更新');
    } else {
      await createCollection(payload);
      message.success('精选集已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
    return true;
  };

  const handleDelete = async (row: CollectionListItem) => {
    try {
      await deleteCollection(row.id);
      message.success('精选集已删除');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ProColumns<CollectionListItem>[] = [
    {
      title: '封面',
      dataIndex: 'coverPath',
      width: 100,
      render: (_, row) =>
        row.coverPath ? (
          <img
            src={coverUrl(row.coverPath)}
            alt={row.title}
            style={{
              width: 64,
              height: 36,
              objectFit: 'cover',
              borderRadius: 4,
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          />
        ) : (
          <span style={{ color: '#bbb' }}>无封面</span>
        ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '播客数',
      dataIndex: 'podcastCount',
      width: 80,
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, row) => (
        <AntdTag color={STATUS_COLOR[row.status]}>
          {STATUS_LABEL[row.status]}
        </AntdTag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 120,
      render: (_, row) => [
        <a key="edit" onClick={() => openEdit(row)}>
          {detailLoading && editing?.id === row.id ? '加载中...' : '编辑'}
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该精选集？"
          onConfirm={() => handleDelete(row)}
        >
          <a style={{ color: '#ba1a1a' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<CollectionListItem>
        headerTitle="精选集管理"
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
            新建精选集
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listCollections();
            return { data, success: true, total: data.length };
          } catch (err) {
            message.error(err instanceof Error ? err.message : '加载失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={columns}
        pagination={false}
        options={{ reload: true, density: false, setting: false }}
        tableAlertRender={false}
      />
      <ModalForm<CollectionFormValues>
        title={editing ? '编辑精选集' : '新建精选集'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? {
                title: editing.title,
                description: editing.description ?? '',
                coverPath: editing.coverPath ?? '',
                podcastIds: editingPodcastIds ?? [],
                sort: editing.sort,
                status: editing.status,
              }
            : {
                title: '',
                description: '',
                podcastIds: [],
                sort: 0,
                status: 'ONLINE',
              }
        }
        onFinish={handleSubmit}
        width={640}
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入精选集标题"
          rules={[
            { required: true, message: '请输入标题' },
            { max: 60, message: '不超过 60 个字符' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="精选集描述（可选）"
          fieldProps={{ rows: 3, maxLength: 500 }}
        />
        <ProForm.Item
          name="coverPath"
          label="封面图"
        >
          <ImagePicker width={240} height={135} />
        </ProForm.Item>
        <ProFormSelect
          name="podcastIds"
          label="播客"
          mode="multiple"
          placeholder="选择播客"
          request={async () => {
            const options = await listPodcastOptions();
            return options.map((p) => ({
              label: p.title,
              value: p.id,
            }));
          }}
          rules={[{ required: true, message: '请选择至少一个播客' }]}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProForm.Group>
          <ProFormDigit
            name="sort"
            label="排序"
            tooltip="数值越小越靠前，默认 0"
            min={0}
            fieldProps={{ precision: 0 }}
            rules={[{ required: true, message: '请输入排序值' }]}
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { value: 'ONLINE', label: '上线' },
              { value: 'OFFLINE', label: '下线' },
            ]}
            rules={[{ required: true, message: '请选择状态' }]}
          />
        </ProForm.Group>
      </ModalForm>
    </>
  );
};

export default CollectionsPage;
