/**
 * 播客管理 (Task 27). ProTable with keyword + status search, row-level
 * view/edit/takedown/publish actions, and batch takedown / batch tag.
 *
 * The detail drawer shows the cover, an inline <audio> player for online
 * preview, the full description, tags, and the podcast's comment list
 * (fetched via the admin comments API with a podcastId filter).
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
} from '@ant-design/pro-components';
import {
  App as AntdApp,
  Button,
  Drawer,
  Empty,
  Image,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { PodcastWithRelations, Tag as TagType } from '@qingmalaya/shared';
import {
  batchTagAdminPodcasts,
  batchTakedownAdminPodcasts,
  listAdminPodcasts,
  listAllTags,
  publishAdminPodcast,
  takedownAdminPodcast,
  updateAdminPodcast,
} from '@/api/podcasts';
import {
  listAdminComments,
  type AdminCommentListItem,
} from '@/api/comments';

const { Paragraph, Text, Title } = Typography;

/** Status → display color + Chinese label. */
const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'orange', text: '待发布' },
  PUBLISHED: { color: 'green', text: '已发布' },
  TAKEN_DOWN: { color: 'red', text: '已下架' },
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
  const { message } = AntdApp.useApp();

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
  const handleTakedown = async (id: number): Promise<void> => {
    try {
      await takedownAdminPodcast(id);
      message.success('已下架');
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handlePublish = async (id: number): Promise<void> => {
    try {
      await publishAdminPodcast(id);
      message.success('已发布');
      actionRef.current?.reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
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
        PENDING: { text: '待发布' },
        PUBLISHED: { text: '已发布' },
        TAKEN_DOWN: { text: '已下架' },
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
      width: 220,
      fixed: 'right',
      render: (_, row) => [
        <a key="view" onClick={() => handleViewDetail(row)}>
          <EyeOutlined /> 详情
        </a>,
        <a key="edit" onClick={() => handleEdit(row)}>
          <EditOutlined /> 编辑
        </a>,
        row.status === 'TAKEN_DOWN' ? (
          <Popconfirm
            key="publish"
            title="确认发布该播客？"
            onConfirm={() => handlePublish(row.id)}
          >
            <a>
              <CheckCircleOutlined /> 发布
            </a>
          </Popconfirm>
        ) : (
          <Popconfirm
            key="takedown"
            title="确认下架该播客？"
            onConfirm={() => handleTakedown(row.id)}
          >
            <a style={{ color: '#ba1a1a' }}>
              <StopOutlined /> 下架
            </a>
          </Popconfirm>
        ),
      ],
    },
  ];

  return (
    <>
      <ProTable<PodcastWithRelations>
        headerTitle="播客管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1200 }}
        request={async (params) => {
          try {
            const res = await listAdminPodcasts({
              keyword: (params.keyword as string | undefined) || undefined,
              status: params.status as PodcastWithRelations['status'] | undefined,
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
    </>
  );
};

export default PodcastsPage;
