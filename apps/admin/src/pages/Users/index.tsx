/**
 * 用户管理 — admin user list with search, ban/unban, password reset, and
 * user creation (STUDENT/TEACHER).
 *
 * ProTable drives the paginated query (keyword + classId filter). Mutations
 * (ban / unban / reset-password) open a confirm modal, call the API, then
 * reload the table. Reset-password additionally surfaces the generated
 * plaintext password in an info modal so the operator can relay it.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ModalForm,
  ProFormDependency,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, Modal, Popconfirm, Space, Tag, App as AntdApp } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Role, UserStatus } from '@qingmalaya/shared';
import {
  banUser,
  batchDeleteUsers,
  createUser,
  deleteUser,
  getUserManagedClasses,
  listAdminUsers,
  resetUserPassword,
  unbanUser,
  updateUserManagedClasses,
  type AdminUserListItem,
  type CreateUserPayload,
} from '@/api/users';
import { listAdminClasses, type AdminClassListItem } from '@/api/classes';
import { useClassScope } from '@/store/class-scope';

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
  const { classIds, scopeVersion } = useClassScope();
  const [classes, setClasses] = useState<AdminClassListItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<AdminUserListItem | null>(null);

  // Load class options once for the classId search filter + teacher assignment.
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

  // Reload the table whenever the teacher's class scope changes.
  useEffect(() => {
    actionRef.current?.reload();
  }, [scopeVersion]);

  /** Open the managed-classes assignment modal for a teacher row. */
  const handleAssignClasses = (record: AdminUserListItem) => {
    setAssignTeacher(record);
    setAssignOpen(true);
  };

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

  /** Confirm-then-delete a single user, reloading the table on success. */
  const handleDelete = (record: AdminUserListItem) => {
    Modal.confirm({
      title: '删除用户',
      content: `确定要删除「${record.name}（${record.studentId}）」吗？该用户的播客、评论等数据将一并删除，且无法恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(record.id);
          message.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          message.error((e as Error).message || '操作失败');
        }
      },
    });
  };

  /** Batch delete selected users, reporting how many were skipped. */
  const handleBatchDelete = async (): Promise<void> => {
    const ids = selectedRowKeys.map((k) => Number(k));
    try {
      const res = await batchDeleteUsers(ids);
      if (res.skipped > 0) {
        message.success(`已删除 ${res.count} 个用户，跳过 ${res.skipped} 个（超级管理员或自身）`);
      } else {
        message.success(`已删除 ${res.count} 个用户`);
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e) {
      message.error((e as Error).message || '操作失败');
    }
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
      width: 320,
      fixed: 'right',
      hideInSearch: true,
      render: (_: unknown, record: AdminUserListItem) => (
        <Space size="small">
          {record.role === 'TEACHER' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleAssignClasses(record)}
            >
              分配班级
            </Button>
          )}
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
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
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
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        tableAlertOptionRender={() => (
          <Popconfirm
            title={`确认删除选中的 ${selectedRowKeys.length} 个用户？该用户的播客、评论等数据将一并删除，且无法恢复。`}
            onConfirm={handleBatchDelete}
          >
            <Button danger size="small">
              批量删除
            </Button>
          </Popconfirm>
        )}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建用户
          </Button>,
        ]}
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
              classIds,
              // Admins (OPERATOR/SUPER_ADMIN) are managed in /admins, not here.
              roles: 'STUDENT,TEACHER',
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

      <ModalForm<CreateUserPayload>
        title="新建用户"
        open={createOpen}
        onOpenChange={setCreateOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={{ role: 'STUDENT', manageAllClasses: false }}
        onFinish={async (values) => {
          try {
            await createUser(values);
            message.success('已创建用户');
            setCreateOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            message.error((e as Error).message || '创建失败');
            return false;
          }
        }}
      >
        <ProFormText
          name="studentId"
          label="学号"
          placeholder="登录用户名"
          rules={[{ required: true, message: '请输入学号' }]}
        />
        <ProFormText
          name="name"
          label="姓名"
          rules={[{ required: true, message: '请输入姓名' }]}
        />
        <ProFormText.Password
          name="password"
          label="初始密码"
          placeholder="至少 6 位"
          rules={[
            { required: true, message: '请输入初始密码' },
            { min: 6, message: '至少 6 位' },
          ]}
        />
        <ProFormSelect
          name="role"
          label="角色"
          options={[
            { value: 'STUDENT', label: '学生' },
            { value: 'TEACHER', label: '教师' },
          ]}
          rules={[{ required: true, message: '请选择角色' }]}
        />
        <ProFormDependency name={['role']}>
          {({ role }) =>
            role === 'STUDENT' ? (
              <ProFormSelect
                name="classId"
                label="班级"
                placeholder="选择班级（可选）"
                allowClear
                options={classes.map((c) => ({ label: c.name, value: c.id }))}
              />
            ) : role === 'TEACHER' ? (
              <>
                <ProFormSwitch
                  name="manageAllClasses"
                  label="管理所有班级"
                  fieldProps={{ defaultChecked: false }}
                />
                <ProFormDependency name={['manageAllClasses']}>
                  {({ manageAllClasses }) =>
                    !manageAllClasses ? (
                      <ProFormSelect
                        name="managedClassIds"
                        label="管理班级"
                        mode="multiple"
                        placeholder="选择该教师管理的班级"
                        options={classes.map((c) => ({
                          label: c.name,
                          value: c.id,
                        }))}
                      />
                    ) : null
                  }
                </ProFormDependency>
              </>
            ) : null
          }
        </ProFormDependency>
      </ModalForm>

      <ModalForm<{
        manageAllClasses: boolean;
        classIds: number[];
      }>
        title={`分配班级 - ${assignTeacher?.name ?? ''}（${assignTeacher?.studentId ?? ''}）`}
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setAssignTeacher(null);
        }}
        modalProps={{ destroyOnClose: true }}
        initialValues={{ manageAllClasses: false, classIds: [] }}
        request={async () => {
          if (!assignTeacher) return { manageAllClasses: false, classIds: [] };
          try {
            const res = await getUserManagedClasses(assignTeacher.id);
            return {
              manageAllClasses: res.manageAllClasses,
              classIds: res.classes.map((c) => c.id),
            };
          } catch {
            return { manageAllClasses: false, classIds: [] };
          }
        }}
        onFinish={async (values) => {
          if (!assignTeacher) return false;
          try {
            await updateUserManagedClasses(assignTeacher.id, {
              classIds: values.classIds ?? [],
              manageAllClasses: values.manageAllClasses ?? false,
            });
            message.success('已更新班级分配');
            setAssignOpen(false);
            setAssignTeacher(null);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            message.error((e as Error).message || '更新失败');
            return false;
          }
        }}
      >
        <ProFormSwitch name="manageAllClasses" label="管理所有班级" />
        <ProFormDependency name={['manageAllClasses']}>
          {({ manageAllClasses }) =>
            !manageAllClasses ? (
              <ProFormSelect
                name="classIds"
                label="管理班级"
                mode="multiple"
                placeholder="选择该教师管理的班级"
                options={classes.map((c) => ({ label: c.name, value: c.id }))}
              />
            ) : null
          }
        </ProFormDependency>
      </ModalForm>
    </>
  );
};

export default UsersPage;
