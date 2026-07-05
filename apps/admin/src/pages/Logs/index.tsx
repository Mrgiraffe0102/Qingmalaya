/**
 * 操作日志 (Task 33). OPERATOR+.
 *
 * Paginated audit log table with filters (adminId, action keyword, date
 * range). The `detail` JSON is shown in an expandable row.
 */
import React from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { App as AntdApp, DatePicker, Input } from 'antd';
import type { Dayjs } from 'dayjs';
import type { AdminLogItem, LogsQuery } from '@/api/logs';
import { listLogs } from '@/api/logs';

const { RangePicker } = DatePicker;

/** Search-form values. `adminId` arrives as a string from the digit input. */
interface LogSearchForm {
  adminId?: string | number;
  action?: string;
  dateRange?: [Dayjs, Dayjs];
}

const LogsPage: React.FC = () => {
  const { message } = AntdApp.useApp();

  const displayColumns: ProColumns<AdminLogItem>[] = [
    { title: '动作', dataIndex: 'action', width: 160 },
    { title: '操作人', dataIndex: 'adminName', width: 120 },
    { title: '目标类型', dataIndex: 'targetType', width: 120 },
    { title: '目标 ID', dataIndex: 'targetId', width: 90 },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (_, r) => new Date(r.createdAt).toLocaleString('zh-CN'),
    },
  ];

  return (
    <ProTable<AdminLogItem, LogSearchForm>
      headerTitle="操作日志"
      rowKey="id"
      scroll={{ x: 800 }}
      search={{ labelWidth: 'auto' }}
      options={{ density: false, fullScreen: false, reload: true, setting: false }}
      request={async (params) => {
        const query: LogsQuery = {
          page: params.current,
          pageSize: params.pageSize,
        };
        if (params.adminId !== undefined && params.adminId !== null) {
          const adminIdNum = Number(params.adminId);
          if (!Number.isNaN(adminIdNum)) query.adminId = adminIdNum;
        }
        if (params.action && params.action.trim() !== '') {
          query.action = params.action.trim();
        }
        if (params.dateRange && params.dateRange.length === 2) {
          query.startDate = params.dateRange[0].startOf('day').toISOString();
          query.endDate = params.dateRange[1].endOf('day').toISOString();
        }
        try {
          const res = await listLogs(query);
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
          title: '管理员 ID',
          dataIndex: 'adminId',
          valueType: 'digit',
          hideInTable: true,
          renderFormItem: () => (
            <Input type="number" placeholder="按管理员 ID 精确过滤" />
          ),
        },
        {
          title: '动作',
          dataIndex: 'action',
          hideInTable: true,
          renderFormItem: () => <Input placeholder="动作关键字" />,
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

export default LogsPage;
