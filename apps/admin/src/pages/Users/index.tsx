/**
 * 用户管理 — admin user list with search, ban/unban, and password reset.
 *
 * ProTable drives the paginated query (keyword + classId filter). Mutations
 * (ban / unban / reset-password) open a confirm modal, call the API, then
 * reload the table. Reset-password additionally surfaces the generated
 * plaintext password in an info modal so the operator can relay it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Modal, Space, Tag, App as AntdApp } from 'antd';
import dayjs from 'dayjs';
import type { Role, UserStatus } from '@qingmalaya/shared';
import {
  banUser,
  listAdminUsers,
  resetUserPassword,
  unbanUser,
  type AdminUserListItem,
} from '@/api/users';
import { listAdminClasses, type AdminClassListItem } from '@/api/classes';

/** Role → Chinese label map for the table column + tag color. */
const ROLE_LABEL: Record<Role, { text: string; color: string }> = {
  STUDENT: { text: '学生', color: 'default' },
  TEACHER: { text: '教师', color: 'blue' },
  OPERATOR: { text: '运营', color: 'orange' },
  SUPER_ADMIN: { text: '超级管理员', color: 'red' },
};

/** Status → Chinese label + tag color. */
const STATUS_LABEL: Record<UserStatus, { text: string; color: string }> = {
  ACTIVE: { text: '正常', color: 'green' },
  BANNED: { text: '已封禁', color: 'red' },
};

const UsersPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = AntdApp.useApp();
  const [classes, setClasses] = useState<AdminClassListItem[]>([]);

  // Load class options once for the classId search filter.
  useEffect(() => {
    let cancelled = false;
    listAdminClasses()
      .then((rows) => {
        if (!cancelled) setClasses(rows);
      })
      .catch(() => {
        /* class filter is best-effort; leave options empty on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Confirm-then-ban a user, reloading the table on success. */
  const handleBan = (record: AdminUserListItem) => {
    Modal.confirm({
      title: '封禁用户',
      content: `确定要封禁「${record.name}（${record.studentId}）」吗？封禁后该用户将无法登录。`,
      okText: '封禁',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await banUser(record.id);
          message.success('已封禁');
          actionRef.current?.reload();
        } catch (e) {
          message.error((e as Error).message || '操作失败');
        }
      },
    });
  };

  /** Confirm-then-unban a user, reloading the table on success. */
  const handleUnban = (record: AdminUserListItem) => {
    Modal.confirm({
      title: '解封用户',
      content: `确定要解封「${record.name}（${record.studentId}）」吗？`,
      okText: '解封',
      cancelText: '取消',
      onOk: async () => {
        try {
          await unbanUser(record.id);
          message.success('已解封');
          actionRef.current?.reload();
        } catch (e) {
          message.error((e as Error).message || '操作失败');
        }
      },
    });
  };

  /** Confirm-then-reset password, surfacing the new password in an info modal. */
  const handleResetPassword = (record: AdminUserListItem) => {
    Modal.confirm({
      title: '重置密码',
      content: `确定要将「${record.name}（${record.studentId}）」的密码重置为默认密码吗？`,
      okText: '重置',
      cancelText: '取消',
      onOk: async () => {
        try {
          const { newPassword } = await resetUserPassword(record.id);
          Modal.info({
            title: '密码已重置',
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p style={{ margin: 0 }}>
                  用户「{record.name}（{record.studentId}）」的新密码为：
                </p>
                <p style={{ margin: '8px 0', fontSize: 18, fontWeight: 600 }}>
                  {newPassword}
                </p>
                <p style={{ margin: 0, color: '#727879', fontSize: 12 }}>
                  请通知用户尽快登录后修改密码。
                </p>
              </div>
            ),
            okText: '知道了',
          });
        } catch (e) {
          message.error((e as Error).message || '操作失败');
        }
      },
    });
  };

  const columns: ProColumns<AdminUserListItem>[] = [
    {
      title: '学号',
      dataIndex: 'studentId',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '搜索学号或姓名' },
    },
    {
      title: '班级',
      dataIndex: 'classId',
      width: 120,
      hideInSearch: false,
      renderText: (_: unknown, record: AdminUserListItem) =>
        record.className ?? '—',
      // Search-only select populated from the classes API.
      valueType: 'select',
      fieldProps: {
        allowClear: true,
        placeholder: '选择班级',
        options: classes.map((c) => ({ label: c.name, value: c.id })),
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 100,
      hideInSearch: true,
      render: (_: unknown, record: AdminUserListItem) => {
        const meta = ROLE_LABEL[record.role] ?? { text: record.role, color: 'default' };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      hideInSearch: true,
      render: (_: unknown, record: AdminUserListItem) => {
        const meta = STATUS_LABEL[record.status] ?? { text: record.status, color: 'default' };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '播客数',
      dataIndex: 'totalPodcasts',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '总收听',
      dataIndex: 'totalListens',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '总点赞',
      dataIndex: 'totalLikes',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 160,
      hideInSearch: true,
      renderText: (val: string) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_: unknown, record: AdminUserListItem) => (
        <Space size="small">
          {record.status === 'ACTIVE' ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleBan(record)}
            >
              封禁
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => handleUnban(record)}
            >
              解封
            </Button>
          )}
          <Button
            type="link"
            size="small"
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ProTable<AdminUserListItem>
      actionRef={actionRef}
      rowKey="id"
      columns={columns}
      scroll={{ x: 1200 }}
      search={{ labelWidth: 'auto', defaultCollapsed: false }}
      options={{ density: false, fullScreen: false, reload: true, setting: false }}
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
      }}
      request={async (params) => {
        try {
          const { current, pageSize, keyword, classId } = params;
          const res = await listAdminUsers({
            page: current,
            pageSize,
            keyword: keyword as string | undefined,
            classId: classId !== undefined && classId !== null
              ? Number(classId)
              : undefined,
          });
          return {
            data: res.items,
            success: true,
            total: res.total,
          };
        } catch (e) {
          message.error((e as Error).message || '加载用户列表失败');
          return { data: [], success: false, total: 0 };
        }
      }}
    />
  );
};

export default UsersPage;
