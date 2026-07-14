/**
 * 播客管理 (Task 27). ProTable with keyword + status search, row-level
 * view/edit/takedown/publish actions, batch takedown / batch publish /
 * batch tag, plus a detail drawer with inline audio preview and an audit
 * action panel for PENDING podcasts.
 *
 * Supports deep-linking via ?status=PENDING (linked from the Dashboard
 * "待审核播客" card) to land operators directly on the review queue.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
  type ProFormInstance,
} from '@ant-design/pro-components';
import { useSearchParams } from 'react-router-dom';
import {
  App as AntdApp,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { PodcastWithRelations, Tag as TagType } from '@qingmalaya/shared';
import {
  batchDeleteAdminPodcasts,
  batchPublishAdminPodcasts,
  batchTagAdminPodcasts,
  batchTakedownAdminPodcasts,
  REJECT_REASON_CATEGORIES,
  deleteAdminPodcast,
  listAdminPodcasts,
  listAllTags,
  publishAdminPodcast,
  rejectAdminPodcast,
  takedownAdminPodcast,
  updateAdminPodcast,
} from '@/api/podcasts';
import {
  listAdminComments,
  type AdminCommentListItem,
} from '@/api/comments';
import { useClassScope } from '@/store/class-scope';

const { Paragraph, Text, Title } = Typography;

/** Status → display color + Chinese label. */
const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'orange', text: '待审核' },
  PUBLISHED: { color: 'green', text: '已发布' },
  TAKEN_DOWN: { color: 'red', text: '已下架' },
  FLAGGED: { color: 'volcano', text: '存疑' },
};

/** Prefix a stored relative upload path with /static/ for URL use. */
const coverUrl = (path: string | null | undefined): string =>
  path ? `/static/${path}` : '';

const audioUrl = (path: string): string => `/static/${path}`;

const formatDate = (iso: string): string =>
  dayjs(iso).format('YYYY-MM-DD HH:mm');

/** Format a duration in seconds as m:ss or h:mm:ss. */
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
};

interface EditFormValues {
  title: string;
  description: string;
  coverPath: string;
  tagIds: number[];
}

const PodcastsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const { message } = AntdApp.useApp();
  const { classIds, scopeVersion } = useClassScope();

  // Allow deep-linking with a preset status filter (e.g. from the Dashboard
  // "待审核播客" card → /podcasts?status=PENDING). The value seeds the search
  // form so the operator lands on a pre-filtered list.
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');

  // Detail drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPodcast, setDetailPodcast] = useState<PodcastWithRelations | null>(null);
  const [detailComments, setDetailComments] = useState<AdminCommentListItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editPodcast, setEditPodcast] = useState<PodcastWithRelations | null>(null);

  // Batch tag modal state
  const [batchTagOpen, setBatchTagOpen] = useState(false);
  const [batchTagIds, setBatchTagIds] = useState<number[]>([]);
  const [batchSelectedTags, setBatchSelectedTags] = useState<number[]>([]);

  // Reject modal state
  const [rejectPodcast, setRejectPodcast] = useState<PodcastWithRelations | null>(null);
  const [rejectReasonTags, setRejectReasonTags] = useState<number[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  // Tag options (shared by edit + batch-tag modals)
  const [tags, setTags] = useState<TagType[]>([]);

  // Row selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Load tag options on mount — used by both the edit and batch-tag modals.
  useEffect(() => {
    listAllTags()
      .then(setTags)
      .catch(() => undefined);
  }, []);

  // Reload the table whenever the teacher's class scope changes.
  useEffect(() => {
    actionRef.current?.reload();
  }, [scopeVersion]);

  // --- Detail drawer ---
  const handleViewDetail = async (row: PodcastWithRelations): Promise<void> => {
    setDetailPodcast(row);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailComments([]);
    try {
      const res = await listAdminComments({ podcastId: row.id, pageSize: 50 });
      setDetailComments(res.items);
    } catch {
      message.error('加载评论失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Edit modal ---
  const handleEdit = (row: PodcastWithRelations): void => {
    setEditPodcast(row);
    setEditOpen(true);
  };

  const handleEditSubmit = async (values: EditFormValues): Promise<boolean> => {
    if (!editPodcast) return false;
    try {
      await updateAdminPodcast(editPodcast.id, {
        title: values.title,
        description: values.description,
        coverPath: values.coverPath,
        tagIds: values.tagIds,
      });
      message.success('修改成功');
      actionRef.current?.reload();
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : '修改失败');
      return false;
    }
  };

  // --- Takedown / Publish ---
  const handleTakedown = async (id: number): Promise<boolean> => {
    try {
      await takedownAdminPodcast(id);
      message.success('已下架');
      actionRef.current?.reload();
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
      return false;
    }
  };

  const handlePublish = async (id: number): Promise<boolean> => {
    try {
      await publishAdminPodcast(id);
      message.success('已发布');
      actionRef.current?.reload();
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
      return false;
    }
  };

  // Audit actions from the detail drawer — close the drawer on success so the
  // operator can move on to the next pending podcast.
  const handleDetailPublish = async (id: number): Promise<void> => {
    const ok = await handlePublish(id);
    if (ok) setDetailOpen(false);
  };

  const handleDetailReject = (podcast: PodcastWithRelations): void => {
    openReject(podcast);
  };

  // --- Batch operations ---
  const handleBatchTakedown = async (): Promise<void> => {
    const ids = selectedRowKeys.map((k) => Number(k));
    try {
      const res = await batchTakedownAdminPodcasts(ids);
      message.success(`已下架 ${res.count} 个播客`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleBatchPublish = async (): Promise<void> => {
    const ids = selectedRowKeys.map((k) => Number(k));
    try {
      const res = await batchPublishAdminPodcasts(ids);
      message.success(`已通过审核 ${res.count} 个播客`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleOpenBatchTag = (): void => {
    setBatchTagIds(selectedRowKeys.map((k) => Number(k)));
    setBatchSelectedTags([]);
    setBatchTagOpen(true);
  };

  const handleBatchTagSubmit = async (): Promise<void> => {
    if (batchSelectedTags.length === 0) {
      message.warning('请选择至少一个标签');
      return;
    }
    try {
      const res = await batchTagAdminPodcasts(batchTagIds, batchSelectedTags);
      message.success(`已为 ${res.count} 个播客添加标签`);
      setBatchTagOpen(false);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  // --- Delete (single + batch) ---
  const handleDelete = async (id: number): Promise<boolean> => {
    try {
      await deleteAdminPodcast(id);
      message.success('已删除');
      actionRef.current?.reload();
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
      return false;
    }
  };

  const handleBatchDelete = async (): Promise<void> => {
    const ids = selectedRowKeys.map((k) => Number(k));
    try {
      const res = await batchDeleteAdminPodcasts(ids);
      message.success(`已删除 ${res.count} 个播客`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  // --- Reject with reason modal ---
  const openReject = (podcast: PodcastWithRelations): void => {
    setRejectPodcast(podcast);
    setRejectReasonTags([]);
    setRejectReason('');
  };

  const handleRejectSubmit = async (): Promise<void> => {
    if (!rejectPodcast) return;
    setRejectBusy(true);
    try {
      await rejectAdminPodcast(rejectPodcast.id, {
        reasonTags: rejectReasonTags.length > 0 ? rejectReasonTags : undefined,
        reason: rejectReason.trim() || undefined,
      });
      message.success('已驳回');
      setRejectPodcast(null);
      actionRef.current?.reload();
      setDetailOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setRejectBusy(false);
    }
  };

  const columns: ProColumns<PodcastWithRelations>[] = [
    {
      title: '封面',
      dataIndex: 'coverPath',
      search: false,
      width: 80,
      render: (_, row) => {
        const url = coverUrl(row.coverPath);
        return url
          ? (
            <Image
              src={url}
              width={50}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 6 }}
            />
          )
          : (
            <div
              style={{
                width: 50,
                height: 50,
                background: '#f0f0f0',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text type="secondary" style={{ fontSize: 11 }}>无封面</Text>
            </div>
          );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      search: {
        transform: (val: string) => ({ keyword: val }),
      },
      ellipsis: true,
      width: 200,
    },
    {
      title: '作者',
      dataIndex: 'author',
      search: false,
      width: 120,
      render: (_, row) => row.author.name,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        PENDING: { text: '待审核' },
        PUBLISHED: { text: '已发布' },
        TAKEN_DOWN: { text: '已下架' },
        FLAGGED: { text: '存疑' },
      },
      width: 100,
      render: (_, row) => {
        const c = STATUS_CONFIG[row.status];
        return c ? <Tag color={c.color}>{c.text}</Tag> : row.status;
      },
    },
    {
      title: '播放量',
      dataIndex: 'playCount',
      search: false,
      width: 90,
    },
    {
      title: '点赞数',
      dataIndex: 'likeCount',
      search: false,
      width: 90,
    },
    {
      title: '评论数',
      dataIndex: 'commentCount',
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
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, row) => [
        <a key="view" onClick={() => handleViewDetail(row)}>
          <EyeOutlined /> 详情
        </a>,
        <a key="edit" onClick={() => handleEdit(row)}>
          <EditOutlined /> 编辑
        </a>,
        row.status === 'PUBLISHED' ? (
          <Popconfirm
            key="takedown"
            title="确认下架该播客？"
            onConfirm={() => handleTakedown(row.id)}
          >
            <a style={{ color: '#ba1a1a' }}>
              <StopOutlined /> 下架
            </a>
          </Popconfirm>
        ) : (
          <Popconfirm
            key="publish"
            title={row.status === 'PENDING' ? '确认通过审核并发布该播客？' : '确认重新发布该播客？'}
            onConfirm={() => handlePublish(row.id)}
          >
            <a>
              <CheckCircleOutlined /> {row.status === 'PENDING' ? '通过审核' : '重新发布'}
            </a>
          </Popconfirm>
        ),
        row.status === 'PENDING' || row.status === 'FLAGGED' ? (
          <a
            key="reject"
            style={{ color: '#ba1a1a' }}
            onClick={() => openReject(row)}
          >
            <StopOutlined /> 驳回
          </a>
        ) : null,
        <Popconfirm
          key="delete"
          title="确认彻底删除该播客？删除后无法恢复，相关评论、点赞等数据将一并清除。"
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
      <ProTable<PodcastWithRelations>
        headerTitle="播客管理"
        actionRef={actionRef}
        formRef={formRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1200 }}
        form={{
          // Seed the status filter when arriving via /podcasts?status=PENDING
          // so the review queue is loaded without an extra click.
          initialValues: initialStatus ? { status: initialStatus } : undefined,
        }}
        request={async (params) => {
          try {
            const res = await listAdminPodcasts({
              keyword: (params.keyword as string | undefined) || undefined,
              status: params.status as PodcastWithRelations['status'] | undefined,
              classIds,
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
          <Space>
            <Popconfirm
              title={`确认通过审核选中的 ${selectedRowKeys.length} 个播客？`}
              onConfirm={handleBatchPublish}
            >
              <Button type="primary" size="small">
                批量通过审核
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`确认下架选中的 ${selectedRowKeys.length} 个播客？`}
              onConfirm={handleBatchTakedown}
            >
              <Button danger size="small">
                批量下架
              </Button>
            </Popconfirm>
            <Button size="small" onClick={handleOpenBatchTag}>
              批量打标签
            </Button>
            <Popconfirm
              title={`确认彻底删除选中的 ${selectedRowKeys.length} 个播客？删除后无法恢复，相关评论、点赞等数据将一并清除。`}
              onConfirm={handleBatchDelete}
            >
              <Button danger size="small">
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        )}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
        }}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* Detail drawer */}
      <Drawer
        title="播客详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
        destroyOnClose
      >
        {detailPodcast && (
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              {detailPodcast.title}
            </Title>
            <Space style={{ marginBottom: 16 }} wrap>
              {(() => {
                const c = STATUS_CONFIG[detailPodcast.status];
                return c ? <Tag color={c.color}>{c.text}</Tag> : null;
              })()}
              <Text type="secondary">
                作者: {detailPodcast.author.name}（{detailPodcast.author.studentId}）
              </Text>
              <Text type="secondary">
                时长: {formatDuration(detailPodcast.duration)}
              </Text>
            </Space>

            {coverUrl(detailPodcast.coverPath) && (
              <div style={{ marginBottom: 16 }}>
                <Image
                  src={coverUrl(detailPodcast.coverPath)}
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <audio
                controls
                src={audioUrl(detailPodcast.audioPath)}
                style={{ width: '100%' }}
              />
            </div>

            {detailPodcast.description && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>简介</Text>
                <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {detailPodcast.description}
                </Paragraph>
              </div>
            )}

            {detailPodcast.tags.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>标签</Text>
                <div style={{ marginTop: 8 }}>
                  {detailPodcast.tags.map((t) => (
                    <Tag key={t.id}>{t.name}</Tag>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Text strong>评论 ({detailPodcast.commentCount})</Text>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              ) : detailComments.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  {detailComments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text strong>{c.user.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDate(c.createdAt)}
                        </Text>
                      </div>
                      <div style={{ marginTop: 4 }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无评论" style={{ marginTop: 16 }} />
              )}
            </div>

            {(detailPodcast.status === 'PENDING' || detailPodcast.status === 'FLAGGED') && (
              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  background: '#fafafa',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  <AuditOutlined /> 审核操作
                </Text>
                <Space>
                  <Popconfirm
                    title="确认通过审核并发布该播客？"
                    onConfirm={() => handleDetailPublish(detailPodcast.id)}
                  >
                    <Button type="primary">
                      <CheckCircleOutlined /> 通过审核
                    </Button>
                  </Popconfirm>
                  <Button danger onClick={() => handleDetailReject(detailPodcast)}>
                    <StopOutlined /> 驳回
                  </Button>
                </Space>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Edit modal */}
      <ModalForm<EditFormValues>
        title="编辑播客"
        open={editOpen}
        onOpenChange={setEditOpen}
        onFinish={handleEditSubmit}
        width={520}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editPodcast
            ? {
                title: editPodcast.title,
                description: editPodcast.description,
                coverPath: editPodcast.coverPath,
                tagIds: editPodcast.tags.map((t) => t.id),
              }
            : undefined
        }
      >
        <ProFormText
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        />
        <ProFormTextArea
          name="description"
          label="简介"
          fieldProps={{ maxLength: 500, showCount: true }}
        />
        <ProFormText name="coverPath" label="封面路径" />
        <ProFormSelect
          name="tagIds"
          label="标签"
          mode="multiple"
          options={tags.map((t) => ({ label: t.name, value: t.id }))}
          fieldProps={{ placeholder: '选择标签' }}
        />
      </ModalForm>

      {/* Batch tag modal */}
      <Modal
        title="批量打标签"
        open={batchTagOpen}
        onCancel={() => setBatchTagOpen(false)}
        onOk={handleBatchTagSubmit}
        okText="确定"
        cancelText="取消"
      >
        <Text>
          将为 {batchTagIds.length} 个播客添加以下标签（已有标签保留）：
        </Text>
        <div style={{ marginTop: 12 }}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择标签"
            value={batchSelectedTags}
            onChange={setBatchSelectedTags}
            options={tags.map((t) => ({ label: t.name, value: t.id }))}
          />
        </div>
      </Modal>

      {/* Reject modal with common reasons + free text */}
      <Modal
        title={`驳回播客 — ${rejectPodcast?.title ?? ''}`}
        open={!!rejectPodcast}
        onCancel={() => setRejectPodcast(null)}
        onOk={handleRejectSubmit}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={rejectBusy}
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong>常见原因（可多选）</Text>
          <div style={{ marginTop: 8 }}>
            <Checkbox.Group
              value={rejectReasonTags}
              onChange={(vals) => setRejectReasonTags(vals as number[])}
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              {REJECT_REASON_CATEGORIES.map((cat, catIdx) => {
                let baseIdx = 0;
                for (let i = 0; i < catIdx; i++) {
                  baseIdx += REJECT_REASON_CATEGORIES[i].reasons.length;
                }
                return (
                  <div key={catIdx} style={{ marginTop: catIdx > 0 ? 8 : 0 }}>
                    <Text type='secondary' style={{ fontSize: 12, fontWeight: 600 }}>
                      {cat.title}
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {cat.reasons.map((reason, i) => {
                        const globalIdx = baseIdx + i;
                        return (
                          <Checkbox
                            key={globalIdx}
                            value={globalIdx}
                            style={{ marginLeft: 0, width: '100%' }}
                          >
                            {reason}
                          </Checkbox>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Checkbox.Group>
          </div>
        </div>
        <div>
          <Text strong>其他原因</Text>
          <Input.TextArea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            maxLength={500}
            showCount
            placeholder="请输入驳回原因…"
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </>
  );
};

export default PodcastsPage;
