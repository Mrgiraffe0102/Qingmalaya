/**
 * 公告管理 (Task 31).
 *
 * ProTable listing all announcements newest-first. ModalForm handles create
 * + edit (title, content TextArea, status select). The server stamps
 * publishedAt on the first PUBLISHED transition.
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag as AntdTag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Announcement } from '@qingmalaya/shared';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  type AnnouncementCreatePayload,
} from '@/api/announcements';

const STATUS_LABEL: Record<Announcement['status'], string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
};

const STATUS_COLOR: Record<Announcement['status'], string> = {
  DRAFT: 'default',
  PUBLISHED: 'green',
};

interface AnnouncementFormValues {
  title: string;
  content: string;
  status: Announcement['status'];
}

const AnnouncementsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: Announcement) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleSubmit = async (values: AnnouncementFormValues) => {
    const payload: AnnouncementCreatePayload = {
      title: values.title,
      content: values.content,
      status: values.status,
    };
    if (editing) {
      await updateAnnouncement(editing.id, payload);
      message.success('公告已更新');
    } else {
      await createAnnouncement(payload);
      message.success('公告已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
    return true;
  };

  const handleDelete = async (row: Announcement) => {
    try {
      await deleteAnnouncement(row.id);
      message.success('公告已删除');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ProColumns<Announcement>[] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 280,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_, row) => (
        <AntdTag color={STATUS_COLOR[row.status]}>
          {STATUS_LABEL[row.status]}
        </AntdTag>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 180,
      render: (_, row) =>
        row.publishedAt
          ? dayjs(row.publishedAt).format('YYYY-MM-DD HH:mm')
          : '-',
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
      fixed: 'right',
      render: (_, row) => [
        <a key="edit" onClick={() => openEdit(row)}>
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该公告？"
          onConfirm={() => handleDelete(row)}
        >
          <a style={{ color: '#ba1a1a' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<Announcement>
        headerTitle="公告管理"
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
            新建公告
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listAnnouncements();
            return { data, success: true, total: data.length };
          } catch (err) {
            message.error(err instanceof Error ? err.message : '加载失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={columns}
        pagination={false}
        scroll={{ x: 890 }}
        options={{ reload: true, density: false, setting: false }}
      />
      <ModalForm<AnnouncementFormValues>
        title={editing ? '编辑公告' : '新建公告'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? {
                title: editing.title,
                content: editing.content,
                status: editing.status,
              }
            : {
                title: '',
                content: '',
                status: 'DRAFT',
              }
        }
        onFinish={handleSubmit}
        width={560}
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入公告标题"
          rules={[
            { required: true, message: '请输入标题' },
            { max: 120, message: '不超过 120 个字符' },
          ]}
        />
        <ProFormTextArea
          name="content"
          label="正文"
          placeholder="请输入公告正文"
          fieldProps={{ autoSize: { minRows: 5, maxRows: 12 } }}
          rules={[{ required: true, message: '请输入正文' }]}
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { value: 'DRAFT', label: '草稿' },
            { value: 'PUBLISHED', label: '已发布' },
          ]}
          rules={[{ required: true, message: '请选择状态' }]}
        />
      </ModalForm>
    </>
  );
};

export default AnnouncementsPage;
