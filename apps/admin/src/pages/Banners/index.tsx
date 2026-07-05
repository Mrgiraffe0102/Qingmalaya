/**
 * Banner 管理 (Task 30).
 *
 * ProTable listing all banners ordered by sort asc. ModalForm handles create
 * + edit (title, coverPath, linkType, linkTarget, sort, status, startAt,
 * endAt). Up/down buttons call the /sort endpoint to swap adjacent sort
 * values.
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag as AntdTag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Banner } from '@qingmalaya/shared';
import {
  createBanner,
  deleteBanner,
  listBanners,
  updateBanner,
  updateBannerSort,
  type BannerCreatePayload,
} from '@/api/banners';

const LINK_TYPE_LABEL: Record<Banner['linkType'], string> = {
  PODCAST: '播客详情',
  PODCAST_LIST: '播客列表',
  NONE: '无跳转',
};

const STATUS_LABEL: Record<Banner['status'], string> = {
  ONLINE: '上线',
  OFFLINE: '下线',
};

const STATUS_COLOR: Record<Banner['status'], string> = {
  ONLINE: 'green',
  OFFLINE: 'default',
};

interface BannerFormValues {
  title: string;
  coverPath: string;
  linkType: Banner['linkType'];
  linkTarget?: string;
  sort: number;
  status: Banner['status'];
  startAt?: dayjs.Dayjs;
  endAt?: dayjs.Dayjs;
}

const BannersPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [rows, setRows] = useState<Banner[]>([]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: Banner) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleSubmit = async (values: BannerFormValues) => {
    const payload: BannerCreatePayload = {
      title: values.title,
      coverPath: values.coverPath,
      linkType: values.linkType,
      linkTarget: values.linkTarget || undefined,
      sort: values.sort,
      status: values.status,
      startAt: values.startAt?.toISOString(),
      endAt: values.endAt?.toISOString(),
    };
    if (editing) {
      await updateBanner(editing.id, payload);
      message.success('Banner 已更新');
    } else {
      await createBanner(payload);
      message.success('Banner 已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
    return true;
  };

  const handleDelete = async (row: Banner) => {
    try {
      await deleteBanner(row.id);
      message.success('Banner 已删除');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleSort = async (row: Banner, direction: 'up' | 'down') => {
    const idx = rows.findIndex((r) => r.id === row.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const target = rows[swapIdx];
    try {
      // Swap sort values between the two adjacent rows.
      await updateBannerSort(row.id, target.sort);
      await updateBannerSort(target.id, row.sort);
      message.success('排序已更新');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '排序失败');
    }
  };

  const columns: ProColumns<Banner>[] = [
    {
      title: '封面',
      dataIndex: 'coverPath',
      width: 120,
      render: (_, row) =>
        row.coverPath ? (
          <img
            src={row.coverPath}
            alt={row.title}
            style={{
              width: 80,
              height: 45,
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
      title: '跳转类型',
      dataIndex: 'linkType',
      width: 110,
      render: (_, row) => LINK_TYPE_LABEL[row.linkType],
    },
    {
      title: '跳转目标',
      dataIndex: 'linkTarget',
      width: 140,
      ellipsis: true,
      render: (_, row) => row.linkTarget || '-',
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
      title: '生效时间',
      dataIndex: 'startAt',
      width: 180,
      render: (_, row) => {
        const start = row.startAt
          ? dayjs(row.startAt).format('YYYY-MM-DD HH:mm')
          : '-';
        const end = row.endAt
          ? dayjs(row.endAt).format('YYYY-MM-DD HH:mm')
          : '-';
        return (
          <span style={{ fontSize: 12 }}>
            {start} ~ {end}
          </span>
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 220,
      render: (_, row) => [
        <a key="up" onClick={() => handleSort(row, 'up')}>
          上移
        </a>,
        <a key="down" onClick={() => handleSort(row, 'down')}>
          下移
        </a>,
        <a key="edit" onClick={() => openEdit(row)}>
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确认删除该 Banner？"
          onConfirm={() => handleDelete(row)}
        >
          <a style={{ color: '#ba1a1a' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<Banner>
        headerTitle="Banner 管理"
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
            新建 Banner
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listBanners();
            setRows(data);
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
      <ModalForm<BannerFormValues>
        title={editing ? '编辑 Banner' : '新建 Banner'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? {
                title: editing.title,
                coverPath: editing.coverPath,
                linkType: editing.linkType,
                linkTarget: editing.linkTarget ?? '',
                sort: editing.sort,
                status: editing.status,
                startAt: editing.startAt ? dayjs(editing.startAt) : undefined,
                endAt: editing.endAt ? dayjs(editing.endAt) : undefined,
              }
            : {
                title: '',
                coverPath: '',
                linkType: 'NONE',
                linkTarget: '',
                sort: 0,
                status: 'ONLINE',
              }
        }
        onFinish={handleSubmit}
        width={560}
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入 Banner 标题"
          rules={[
            { required: true, message: '请输入标题' },
            { max: 60, message: '不超过 60 个字符' },
          ]}
        />
        <ProFormText
          name="coverPath"
          label="封面路径"
          placeholder="上传后返回的相对路径，如 2026/07/xxx.jpg"
          rules={[{ required: true, message: '请输入封面路径' }]}
        />
        <ProFormSelect
          name="linkType"
          label="跳转类型"
          options={[
            { value: 'PODCAST', label: '播客详情' },
            { value: 'PODCAST_LIST', label: '播客列表' },
            { value: 'NONE', label: '无跳转' },
          ]}
          rules={[{ required: true, message: '请选择跳转类型' }]}
        />
        <ProFormText
          name="linkTarget"
          label="跳转目标"
          placeholder="播客 ID 或标签 ID（跳转类型为无时留空）"
        />
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
        <ProForm.Group>
          <ProFormDatePicker
            name="startAt"
            label="生效时间"
            fieldProps={{
              showTime: true,
              format: 'YYYY-MM-DD HH:mm',
              style: { width: '100%' },
            }}
          />
          <ProFormDatePicker
            name="endAt"
            label="失效时间"
            fieldProps={{
              showTime: true,
              format: 'YYYY-MM-DD HH:mm',
              style: { width: '100%' },
            }}
          />
        </ProForm.Group>
      </ModalForm>
    </>
  );
};

export default BannersPage;
