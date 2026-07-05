/**
 * Admin dashboard (Task 25).
 *
 * Fetches aggregate stats from GET /admin/dashboard/stats and renders:
 *   - 5 stat cards (总用户 / 总播客 / 今日上传 / 今日播放 / 总点赞)
 *   - 2 line charts: 30-day upload trend + play trend (side by side)
 *   - Class activity horizontal bar chart (podcasts per class)
 *   - Top-10 podcasts table (rank, cover, title, author, plays, likes)
 *
 * The backend returns raw data (no envelope); the request interceptor unwraps
 * any { code, data } wrapper if present, so we receive DashboardStats directly.
 */
import React, { useEffect, useState } from 'react';
import { ProCard } from '@ant-design/pro-components';
import { Typography, Spin, App as AntdApp, Table, Image, Badge } from 'antd';
import { Statistic } from 'antd';
import { Line, Bar } from '@ant-design/charts';
import {
  TeamOutlined,
  SoundOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  HeartOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getDashboardStats,
  type DashboardStats,
  type DashboardTopPodcast,
} from '@/api/dashboard';

const { Title } = Typography;

const PRIMARY = '#4d6265';

const DashboardPage: React.FC = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getDashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : '加载仪表盘数据失败';
          message.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message]);

  if (loading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const cards = stats?.cards;
  const uploadTrend = stats?.uploadTrend ?? [];
  const playTrend = stats?.playTrend ?? [];
  const classActivity = stats?.classActivity ?? [];
  const topPodcasts = stats?.topPodcasts ?? [];

  // Shared line-chart config: x = date, y = count.
  const buildLineConfig = (data: { date: string; count: number }[]) => ({
    data,
    xField: 'date',
    yField: 'count',
    height: 280,
    padding: 'auto',
    axis: {
      x: {
        labelAutoRotate: true,
        labelAutoEllipsis: true,
      },
      y: {
        labelFormatter: (v: string) => String(v),
      },
    },
    style: {
      stroke: PRIMARY,
      lineWidth: 2,
    },
    smooth: true,
    tooltip: {
      items: [{ name: '数量', field: 'count' }],
    },
  });

  // Horizontal bar: className on Y-axis, podcastCount on X-axis.
  const barConfig = {
    data: classActivity,
    xField: 'podcastCount',
    yField: 'className',
    height: Math.max(280, classActivity.length * 36),
    padding: 'auto',
    color: PRIMARY,
    label: {
      text: 'podcastCount',
      position: 'right' as const,
    },
    axis: {
      x: { title: '播客数' },
      y: { title: false },
    },
  };

  const topColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 64,
      render: (_: unknown, __: DashboardTopPodcast, index: number) => index + 1,
    },
    {
      title: '封面',
      dataIndex: 'coverPath',
      key: 'cover',
      width: 72,
      render: (coverPath: string | null) =>
        coverPath ? (
          <Image
            src={coverPath}
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 6 }}
            fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIvPg=="
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 6,
              background: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bbb',
            }}
          >
            <SoundOutlined />
          </div>
        ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '作者',
      dataIndex: 'authorName',
      key: 'authorName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '播放量',
      dataIndex: 'playCount',
      key: 'playCount',
      width: 100,
      sorter: (a: DashboardTopPodcast, b: DashboardTopPodcast) =>
        a.playCount - b.playCount,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '点赞数',
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: 100,
      render: (v: number) => v.toLocaleString(),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stat cards */}
      <ProCard ghost gutter={[16, 16]} wrap>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }}>
          <Statistic
            title="总用户"
            value={cards?.totalUsers ?? 0}
            prefix={<TeamOutlined style={{ color: PRIMARY }} />}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }}>
          <Statistic
            title="总播客"
            value={cards?.totalPodcasts ?? 0}
            prefix={<SoundOutlined style={{ color: PRIMARY }} />}
          />
        </ProCard>
        <ProCard
          colSpan={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/podcasts?status=PENDING')}
        >
          <Statistic
            title="待审核播客"
            value={cards?.pendingReview ?? 0}
            prefix={<AuditOutlined style={{ color: '#fa8c16' }} />}
            valueStyle={
              (cards?.pendingReview ?? 0) > 0
                ? { color: '#fa8c16' }
                : undefined
            }
          />
          {(cards?.pendingReview ?? 0) > 0 && (
            <div style={{ marginTop: 4 }}>
              <Badge status="warning" text={<Typography.Link>去审核 →</Typography.Link>} />
            </div>
          )}
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }}>
          <Statistic
            title="今日上传"
            value={cards?.todayUploads ?? 0}
            prefix={<UploadOutlined style={{ color: PRIMARY }} />}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }}>
          <Statistic
            title="今日播放"
            value={cards?.todayPlays ?? 0}
            prefix={<PlayCircleOutlined style={{ color: PRIMARY }} />}
          />
        </ProCard>
        <ProCard colSpan={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }}>
          <Statistic
            title="总点赞"
            value={cards?.totalLikes ?? 0}
            prefix={<HeartOutlined style={{ color: PRIMARY }} />}
          />
        </ProCard>
      </ProCard>

      {/* Trend line charts */}
      <ProCard ghost gutter={[16, 16]} wrap>
        <ProCard
          title="近 30 天上传趋势"
          headerBordered
          bordered
          colSpan={{ xs: 24, lg: 12 }}
        >
          <Line {...buildLineConfig(uploadTrend)} />
        </ProCard>
        <ProCard
          title="近 30 天播放趋势"
          headerBordered
          bordered
          colSpan={{ xs: 24, lg: 12 }}
        >
          <Line {...buildLineConfig(playTrend)} />
        </ProCard>
      </ProCard>

      {/* Class activity bar chart */}
      <ProCard title="班级播客活跃度" headerBordered bordered>
        {classActivity.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#727879', padding: 32 }}>
            暂无班级数据
          </div>
        ) : (
          <Bar {...barConfig} />
        )}
      </ProCard>

      {/* Top-10 podcasts */}
      <ProCard
        title={
          <Title level={5} style={{ margin: 0, color: PRIMARY }}>
            热门播客 Top 10
          </Title>
        }
        headerBordered
        bordered
      >
        <Table<DashboardTopPodcast>
          rowKey="id"
          columns={topColumns}
          dataSource={topPodcasts}
          pagination={false}
          size="middle"
        />
      </ProCard>
    </div>
  );
};

export default DashboardPage;
