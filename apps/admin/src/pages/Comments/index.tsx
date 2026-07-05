/**
 * 评论管理 (Task 28). ProTable with keyword + podcastId + date-range search,
 * row-level delete (with confirm), and batch delete (with confirm).
 *
 * The list shows all comments regardless of status (admins need to see hidden
 * ones too). Soft-hidden comments (status=HIDDEN, content cleared) render as
 * "[已删除]" in the content column.
 */
import React, { useRef, useState } from 'react';
import {
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import {
  App as AntdApp,
  Button,
  Popconfirm,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  batchDeleteAdminComments,
  deleteAdminComment,
  listAdminComments,
  type AdminCommentListItem,
} from '@/api/comments';

const { Text } = Typography;

const formatDate = (iso: string): string =>
  dayjs(iso).format('YYYY-MM-DD HH:mm');

/** Truncate content for the table cell; hidden comments show [已删除]. */
const renderContent = (row: AdminCommentListItem): React.ReactNode => {
  if (row.status === 'HIDDEN' || !row.content) {
    return <Text type="secondary">[已删除]</Text>;
  }
  return row.content;
};

const CommentsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = AntdApp.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // --- Delete single ---
  const handleDelete = async (id: number): Promise<void> => {
    try {
      await deleteAdminComment(id);
      message.success('已删除');
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  // --- Batch delete ---
  const handleBatchDelete = async (): Promise<void> => {
    const ids = selectedRowKeys.map((k) => Number(k));
    try {
      const res = await batchDeleteAdminComments(ids);
      message.success(`已删除 ${res.count} 条评论`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns: ProColumns<AdminCommentListItem>[] = [
    {
      title: '评论内容',
      dataIndex: 'content',
      search: {
        transform: (val: string) => ({ keyword: val }),
      },
      ellipsis: true,
      width: 320,
      render: (_, row) => renderContent(row),
    },
    {
      title: '用户',
      dataIndex: 'user',
      search: false,
      width: 140,
      render: (_, row) => (
        <span>
          {row.user.name}
          <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
            ({row.user.studentId})
          </Text>
        </span>
      ),
    },
    {
      title: '播客',
      dataIndex: 'podcast',
      search: false,
      ellipsis: true,
      width: 200,
      render: (_, row) => row.podcast.title,
    },
    {
      title: '点赞数',
      dataIndex: 'likeCount',
      search: false,
      width: 90,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      width: 160,
      render: (_, row) => formatDate(row.createdAt),
    },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      width: 90,
      render: (_, row) =>
        row.status === 'HIDDEN' ? (
          <Tag color="default">已隐藏</Tag>
        ) : (
          <Tag color="blue">正常</Tag>
        ),
    },
    // --- Search-only fields (hidden from the table) ---
    {
      title: '播客ID',
      dataIndex: 'podcastId',
      valueType: 'digit',
      hideInTable: true,
    },
    {
      title: '日期范围',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: { format: 'YYYY-MM-DD' },
      search: {
        transform: (val) => {
          if (!val || !Array.isArray(val) || val.length < 2) return {};
          const start = dayjs.isDayjs(val[0]) ? val[0].format('YYYY-MM-DD') : val[0];
          const end = dayjs.isDayjs(val[1]) ? val[1].format('YYYY-MM-DD') : val[1];
          return { startDate: start, endDate: end };
        },
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, row) => [
        <Popconfirm
          key="delete"
          title="确认删除该评论？"
          onConfirm={() => handleDelete(row.id)}
        >
          <a style={{ color: '#ba1a1a' }}>
            <DeleteOutlined /> 删除
          </a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<AdminCommentListItem>
      headerTitle="评论管理"
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      scroll={{ x: 1100 }}
      request={async (params) => {
        try {
          const res = await listAdminComments({
            keyword: (params.keyword as string | undefined) || undefined,
            podcastId: params.podcastId ? Number(params.podcastId) : undefined,
            startDate: params.startDate as string | undefined,
            endDate: params.endDate as string | undefined,
            page: params.current,
            pageSize: params.pageSize,
          });
          return {
            data: res.items,
            success: true,
            total: res.total,
          };
        } catch (e) {
          message.error(e instanceof Error ? e.message : '加载失败');
          return { data: [], success: false, total: 0 };
        }
      }}
      rowSelection={{
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
      }}
      tableAlertOptionRender={() => (
        <Popconfirm
          title={`确认删除选中的 ${selectedRowKeys.length} 条评论？`}
          onConfirm={handleBatchDelete}
        >
          <Button danger size="small">
            批量删除
          </Button>
        </Popconfirm>
      )}
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
      }}
      search={{
        labelWidth: 'auto',
      }}
    />
  );
};

export default CommentsPage;
