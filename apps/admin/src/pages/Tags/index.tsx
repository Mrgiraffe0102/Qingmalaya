/**
 * 标签管理 (Task 29).
 *
 * ProTable listing all tags ordered by weight desc. Inline ModalForm handles
 * create + edit; delete is guarded against tags still referenced by podcasts
 * (server returns BadRequestException, surfaced as a friendly message).
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Tag as AntdTag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Tag } from '@qingmalaya/shared';
import {
  createTag,
  deleteTag,
  listTags,
  updateTag,
  type TagCreatePayload,
  type TagWithCount,
} from '@/api/tags';

/** TagColor → hex swatch. Mirrors the design-system color tokens. */
const COLOR_HEX: Record<Tag['color'], string> = {
  mint: '#7fb3a6',
  purple: '#8e7ec2',
  orange: '#e0a872',
  rose: '#e88aa8',
  sky: '#7bb8ee',
  teal: '#5fcab0',
  indigo: '#8a9bf5',
  amber: '#d9b441',
};

const COLOR_LABEL: Record<Tag['color'], string> = {
  mint: '薄荷',
  purple: '紫色',
  orange: '橙色',
  rose: '玫红',
  sky: '天蓝',
  teal: '青色',
  indigo: '靛蓝',
  amber: '琥珀',
};

/** All selectable tag colors — drives the form select + random assignment. */
const TAG_COLOR_VALUES: Tag['color'][] = [
  'mint',
  'purple',
  'orange',
  'rose',
  'sky',
  'teal',
  'indigo',
  'amber',
];

function randomTagColor(): Tag['color'] {
  return TAG_COLOR_VALUES[Math.floor(Math.random() * TAG_COLOR_VALUES.length)];
}

interface TagFormValues {
  name: string;
  weight: number;
  color: Tag['color'];
}

const TagsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TagWithCount | null>(null);
  const [createColor, setCreateColor] = useState<Tag['color']>('mint');

  const openCreate = () => {
    setEditing(null);
    // Pre-assign a random color each time the create form opens.
    setCreateColor(randomTagColor());
    setModalOpen(true);
  };

  const openEdit = (row: TagWithCount) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleSubmit = async (values: TagFormValues) => {
    const payload: TagCreatePayload = {
      name: values.name,
      weight: values.weight,
      color: values.color,
    };
    if (editing) {
      await updateTag(editing.id, payload);
      message.success('标签已更新');
    } else {
      await createTag(payload);
      message.success('标签已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
    return true;
  };

  const handleDelete = async (row: TagWithCount) => {
    try {
      await deleteTag(row.id);
      message.success('标签已删除');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ProColumns<TagWithCount>[] = [
    {
      title: '标签名',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '权重',
      dataIndex: 'weight',
      width: 100,
      sorter: (a, b) => a.weight - b.weight,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 140,
      render: (_, row) => (
        <Space>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: COLOR_HEX[row.color],
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          />
          {COLOR_LABEL[row.color]}
        </Space>
      ),
    },
    {
      title: '关联播客',
      dataIndex: 'podcastCount',
      width: 100,
      render: (_, row) => (
        <AntdTag color={row.podcastCount > 0 ? 'blue' : 'default'}>
          {row.podcastCount}
        </AntdTag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (_, row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 140,
      render: (_, row) => [
        <a key="edit" onClick={() => openEdit(row)}>
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该标签？"
          description={
            row.podcastCount > 0
              ? `该标签仍被 ${row.podcastCount} 个播客引用，服务端将拒绝删除`
              : '删除后不可恢复'
          }
          onConfirm={() => handleDelete(row)}
        >
          <a style={{ color: '#ba1a1a' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<TagWithCount>
        headerTitle="标签管理"
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
            新建标签
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listTags();
            return { data, success: true, total: data.length };
          } catch (err) {
            message.error(err instanceof Error ? err.message : '加载失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={columns}
        pagination={false}
        options={{ reload: true, density: false, setting: false }}
      />
      <ModalForm<TagFormValues>
        title={editing ? '编辑标签' : '新建标签'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? { name: editing.name, weight: editing.weight, color: editing.color }
            : { name: '', weight: 0, color: createColor }
        }
        onFinish={handleSubmit}
        width={480}
      >
        <ProFormText
          name="name"
          label="标签名"
          placeholder="请输入标签名"
          rules={[
            { required: true, message: '请输入标签名' },
            { max: 30, message: '不超过 30 个字符' },
          ]}
        />
        <ProFormDigit
          name="weight"
          label="权重"
          tooltip="权重越大越靠前，默认 0"
          min={0}
          fieldProps={{ precision: 0 }}
          rules={[{ required: true, message: '请输入权重' }]}
        />
        <ProFormSelect
          name="color"
          label="颜色"
          options={TAG_COLOR_VALUES.map((c) => ({ value: c, label: COLOR_LABEL[c] }))}
          rules={[{ required: true, message: '请选择颜色' }]}
        />
      </ModalForm>
    </>
  );
};

export default TagsPage;
