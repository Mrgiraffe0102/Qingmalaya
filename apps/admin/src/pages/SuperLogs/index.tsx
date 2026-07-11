/**
 * 超级日志 — SUPER_ADMIN only.
 *
 * Paginated user activity log table with filters (userId, action, targetType,
 * date range). Each row shows the action type as a colored tag, the acting
 * user's name/studentId/role, the target entity, and the timestamp. The
 * `detail` JSON is shown in an expandable row.
 */
import React from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { App as AntdApp, DatePicker, Input, Select, Tag } from 'antd';
import type { Dayjs } from 'dayjs';
import type { SuperLogItem, SuperLogsQuery } from '@/api/superLogs';
import { listSuperLogs } from '@/api/superLogs';

const { RangePicker } = DatePicker;

interface SuperLogSearchForm {
  userId?: string | number;
  action?: string;
  targetType?: string;
  dateRange?: [Dayjs, Dayjs];
}

const ACTION_OPTIONS = [
  { label: '播放播客', value: 'PLAY' },
  { label: '点赞播客', value: 'LIKE_PODCAST' },
  { label: '取消点赞播客', value: 'UNLIKE_PODCAST' },
  { label: '收藏播客', value: 'FAVORITE' },
  { label: '取消收藏播客', value: 'UNFAVORITE' },
  { label: '点赞评论', value: 'LIKE_COMMENT' },
  { label: '取消点赞评论', value: 'UNLIKE_COMMENT' },
  { label: '发表评论', value: 'CREATE_COMMENT' },
  { label: '删除评论', value: 'DELETE_COMMENT' },
  { label: '创建播客', value: 'CREATE_PODCAST' },
  { label: '更新播客', value: 'UPDATE_PODCAST' },
  { label: '删除播客', value: 'DELETE_PODCAST' },
  { label: '更新资料', value: 'UPDATE_PROFILE' },
];

const TARGET_TYPE_OPTIONS = [
  { label: '播客', value: 'Podcast' },
  { label: '评论', value: 'Comment' },
  { label: '用户', value: 'User' },
];

const ACTION_TAG_COLORS: Record<string, string> = {
  PLAY: 'blue',
  LIKE_PODCAST: 'red',
  UNLIKE_PODCAST: 'red',
  FAVORITE: 'orange',
  UNFAVORITE: 'orange',
  LIKE_COMMENT: 'green',
  UNLIKE_COMMENT: 'green',
  CREATE_COMMENT: 'green',
  DELETE_COMMENT: 'volcano',
  CREATE_PODCAST: 'purple',
  UPDATE_PODCAST: 'purple',
  DELETE_PODCAST: 'magenta',
  UPDATE_PROFILE: 'default',
};

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  ACTION_OPTIONS.map((o) => [o.value, o.label]),
);

const ROLE_LABELS: Record<string, string> = {
  STUDENT: '学生',
  TEACHER: '教师',
  OPERATOR: '运营',
  SUPER_ADMIN: '超级管理员',
};

const ROLE_TAG_COLORS: Record<string, string> = {
  STUDENT: 'default',
  TEACHER: 'cyan',
  OPERATOR: 'gold',
  SUPER_ADMIN: 'red',
};

const SuperLogsPage: React.FC = () => {
  const { message } = AntdApp.useApp();

  const displayColumns: ProColumns<SuperLogItem>[] = [
    {
      title: '操作',
      dataIndex: 'action',
      width: 140,
      render: (_, r) => {
        const label = ACTION_LABELS[r.action] ?? r.action;
        const color = ACTION_TAG_COLORS[r.action] ?? 'default';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    { title: '用户名', dataIndex: 'userName', width: 100 },
    { title: '学号', dataIndex: 'studentId', width: 110 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 90,
      render: (_, r) => (
        <Tag color={ROLE_TAG_COLORS[r.role] ?? 'default'}>
          {ROLE_LABELS[r.role] ?? r.role}
        </Tag>
      ),
    },
    { title: '目标类型', dataIndex: 'targetType', width: 90 },
    { title: '目标 ID', dataIndex: 'targetId', width: 80 },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (_, r) => new Date(r.createdAt).toLocaleString('zh-CN'),
    },
  ];

  return (
    <ProTable<SuperLogItem, SuperLogSearchForm>
      headerTitle="超级日志"
      rowKey="id"
      scroll={{ x: 900 }}
      search={{ labelWidth: 'auto' }}
      options={{ density: false, fullScreen: false, reload: true, setting: false }}
      request={async (params) => {
        const query: SuperLogsQuery = {
          page: params.current,
          pageSize: params.pageSize,
        };
        if (params.userId !== undefined && params.userId !== null) {
          const userIdNum = Number(params.userId);
          if (!Number.isNaN(userIdNum)) query.userId = userIdNum;
        }
        if (params.action && params.action.trim() !== '') {
          query.action = params.action.trim();
        }
        if (params.targetType && params.targetType.trim() !== '') {
          query.targetType = params.targetType.trim();
        }
        if (params.dateRange && params.dateRange.length === 2) {
          query.startDate = params.dateRange[0].startOf('day').toISOString();
          query.endDate = params.dateRange[1].endOf('day').toISOString();
        }
        try {
          const res = await listSuperLogs(query);
          return { data: res.items, success: true, total: res.total };
        } catch (e) {
          message.error((e as Error).message || '加载失败');
          return { data: [], success: false, total: 0 };
        }
      }}
      expandable={{
        expandedRowRender: (record) => (
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: '#fafafa',
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {record.detail
              ? JSON.stringify(record.detail, null, 2)
              : '(无详情)'}
          </pre>
        ),
        rowExpandable: () => true,
      }}
      columns={[
        {
          title: '用户 ID',
          dataIndex: 'userId',
          valueType: 'digit',
          hideInTable: true,
          renderFormItem: () => (
            <Input type="number" placeholder="按用户 ID 精确过滤" />
          ),
        },
        {
          title: '操作类型',
          dataIndex: 'action',
          hideInTable: true,
          renderFormItem: () => (
            <Select
              placeholder="选择操作类型"
              allowClear
              options={ACTION_OPTIONS}
            />
          ),
        },
        {
          title: '目标类型',
          dataIndex: 'targetType',
          hideInTable: true,
          renderFormItem: () => (
            <Select
              placeholder="选择目标类型"
              allowClear
              options={TARGET_TYPE_OPTIONS}
            />
          ),
        },
        {
          title: '时间范围',
          dataIndex: 'dateRange',
          hideInTable: true,
          renderFormItem: () => (
            <RangePicker
              showTime
              style={{ width: '100%' }}
              placeholder={['开始时间', '结束时间']}
            />
          ),
        },
        ...displayColumns,
      ]}
    />
  );
};

export default SuperLogsPage;
