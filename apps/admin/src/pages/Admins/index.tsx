/**
 * 管理员账号管理 (Task 32). SUPER_ADMIN only.
 *
 * Lists every SUPER_ADMIN account with create / edit / delete
 * actions. The page guards itself against non-SUPER_ADMIN access (the menu
 * is also hidden for them, but we double-guard here).
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App as AntdApp, Button, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { User } from '@qingmalaya/shared';
import { Role } from '@qingmalaya/shared';
import { getRole } from '@/store/auth';
import {
  createAdmin,
  deleteAdmin,
  listAdmins,
  updateAdmin,
  type AdminRole,
  type CreateAdminPayload,
  type UpdateAdminPayload,
} from '@/api/admins';

const roleTagColor: Record<AdminRole, string> = {
  SUPER_ADMIN: 'gold',
};

const roleLabel: Record<AdminRole, string> = {
  SUPER_ADMIN: '超级管理员',
};

const AdminsPage: React.FC = () => {
  const role = getRole();
  const { message } = AntdApp.useApp();
  const actionRef = useRef<ActionType>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  if (role !== Role.SUPER_ADMIN) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#727879' }}>
        权限不足：仅超级管理员可访问此页面。
      </div>
    );
  }

  const reload = (): void => {
    actionRef.current?.reload();
  };

  const handleDelete = async (record: User): Promise<void> => {
    try {
      await deleteAdmin(record.id);
      message.success('已删除管理员');
      reload();
    } catch (e) {
      message.error((e as Error).message || '删除失败');
    }
  };

  const columns: ProColumns<User>[] = [
    { title: '用户名', dataIndex: 'studentId', width: 140 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (_, r) => <Tag color={roleTagColor[r.role as AdminRole]}>{roleLabel[r.role as AdminRole]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, r) =>
        r.status === 'ACTIVE' ? (
          <Tag color="green">正常</Tag>
        ) : (
          <Tag color="red">封禁</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (_, r) => new Date(r.createdAt).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <a
            onClick={() => {
              setEditing(r);
            }}
          >
            编辑
          </a>
          <Popconfirm
            title="确认删除该管理员？"
            description={
              r.role === Role.SUPER_ADMIN
                ? '该账号为超级管理员，删除后需确保至少仍有一位超级管理员。'
                : undefined
            }
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleDelete(r)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ProTable<User>
        headerTitle="管理员账号"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        scroll={{ x: 900 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建管理员
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listAdmins();
            return { data, success: true, total: data.length };
          } catch (e) {
            message.error((e as Error).message || '加载失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={columns}
      />

      <ModalForm<CreateAdminPayload>
        title="新建管理员"
        open={createOpen}
        onOpenChange={setCreateOpen}
        modalProps={{ destroyOnClose: true }}
        onFinish={async (values) => {
          try {
            await createAdmin({ ...values, role: 'SUPER_ADMIN' });
            message.success('已创建管理员');
            setCreateOpen(false);
            reload();
            return true;
          } catch (e) {
            message.error((e as Error).message || '创建失败');
            return false;
          }
        }}
      >
        <ProFormText
          name="studentId"
          label="用户名"
          placeholder="登录用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
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
      </ModalForm>

      <ModalForm<UpdateAdminPayload & { password?: string }>
        title="编辑管理员"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? { name: editing.name }
            : undefined
        }
        onFinish={async (values) => {
          if (!editing) return false;
          const payload: UpdateAdminPayload = {};
          if (values.name !== undefined) payload.name = values.name;
          if (values.password && values.password.length > 0) {
            payload.password = values.password;
          }
          try {
            await updateAdmin(editing.id, payload);
            message.success('已更新管理员');
            setEditing(null);
            reload();
            return true;
          } catch (e) {
            message.error((e as Error).message || '更新失败');
            return false;
          }
        }}
      >
        <ProFormText
          name="name"
          label="姓名"
          rules={[{ required: true, message: '请输入姓名' }]}
        />
        <ProFormText.Password
          name="password"
          label="重置密码"
          placeholder="留空则不修改密码"
        />
      </ModalForm>
    </>
  );
};

export default AdminsPage;
