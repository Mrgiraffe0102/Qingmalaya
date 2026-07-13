/**
 * 评论管理 (Task 28). ProTable with keyword + podcastId + date-range search,
 * row-level delete (with confirm), and batch delete (with confirm).
 *
 * The list shows all comments regardless of status (admins need to see hidden
 * ones too). Soft-hidden comments (status=HIDDEN, content cleared) render as
 * "[已删除]" in the content column.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import {
  App as AntdApp,
  Button,
  Card,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ReportedCommentItem } from '@qingmalaya/shared';
import {
  batchDeleteAdminComments,
  deleteAdminComment,
  listAdminComments,
  listReportedComments,
  resolveReport,
  type AdminCommentListItem,
} from '@/api/comments';
import { useClassScope } from '@/store/class-scope';

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
  const { classIds, scopeVersion } = useClassScope();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Reported comments state
  const [reported, setReported] = useState<ReportedCommentItem[]>([]);
  const [reportedLoading, setReportedLoading] = useState(false);

  const fetchReported = async () => {
    setReportedLoading(true);
    try {
      const data = await listReportedComments(classIds);
      setReported(data);
    } catch {
      // best-effort
    } finally {
      setReportedLoading(false);
    }
  };

  // Reload the table + reported comments whenever the teacher's class scope changes.
  useEffect(() => {
    actionRef.current?.reload();
    void fetchReported();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeVersion]);

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

  // --- Resolve reported comment ---
  const handleResolveReport = async (
    commentId: number,
    action: 'delete' | 'dismiss',
  ): Promise<void> => {
    try {
      await resolveReport(commentId, { action });
      message.success(action === 'delete' ? '已删除评论' : '已忽略举报');
      void fetchReported();
      if (action === 'delete') actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
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
    <>
      {/* Reported comments section — only shown when there are pending reports */}
      {reportedLoading ? (
        reported.length === 0 ? null : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        )
      ) : reported.length > 0 ? (
        <Card
          title={
            <span>
              被举报评论 <Tag color="volcano">{reported.length}</Tag>
            </span>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {reported.map((r) => (
              <div
                key={r.reportId}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 4,
                  }}
                >
                  <Space size="small" wrap>
                    <Tag color="orange">举报</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      举报人: {r.reporter.name}（{r.reporter.studentId}）
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(r.createdAt)}
                    </Text>
                  </Space>
                  <Space size="small">
                    <Popconfirm
                      title="确认删除该评论并解除举报？"
                      onConfirm={() => handleResolveReport(r.comment.id, 'delete')}
                    >
                      <Button type="link" danger size="small">
                        删除评论
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title="确认忽略该举报？"
                      onConfirm={() => handleResolveReport(r.comment.id, 'dismiss')}
                    >
                      <Button type="link" size="small">
                        忽略
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
                <Text style={{ color: '#ba1a1a', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  举报原因: {r.reason}
                </Text>
                <div style={{ background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  <Space size="small" style={{ marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 13 }}>
                      {r.comment.user.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({r.comment.user.studentId})
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      《{r.comment.podcast.title}》
                    </Text>
                  </Space>
                  <Text style={{ display: 'block', fontSize: 13 }}>
                    {r.comment.content}
                  </Text>
                </div>
              </div>
            ))}
          </Space>
        </Card>
      ) : null}

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
              classIds,
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
    </>
  );
};

export default CommentsPage;
