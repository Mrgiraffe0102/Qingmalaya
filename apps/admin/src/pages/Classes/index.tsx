/**
 * 班级管理 — class CRUD + batch student import.
 *
 * ProTable lists all classes (no pagination — the catalog is small). The
 * toolbar exposes a "新建班级" button opening a ModalForm. Each row has
 * edit (ModalForm), delete (confirm modal, rejected server-side if the class
 * still has users), and "导入学生" (modal with a TextArea accepting pasted
 * `studentId,name` lines).
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App as AntdApp, Button, Input, Modal, Space } from 'antd';
import dayjs from 'dayjs';
import {
  createAdminClass,
  deleteAdminClass,
  importStudents,
  listAdminClasses,
  updateAdminClass,
  type AdminClassListItem,
} from '@/api/classes';

const { TextArea } = Input;

/** Form values shared by the create + edit ModalForms. */
interface ClassFormValues {
  name: string;
  grade?: string;
  department?: string;
}

const ClassesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = AntdApp.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminClassListItem | null>(null);
  const [importing, setImporting] = useState<AdminClassListItem | null>(null);
  const [importText, setImportText] = useState('');
  const [importingBusy, setImportingBusy] = useState(false);

  /** Delete a class after confirmation. Server rejects if it still has users. */
  const handleDelete = (record: AdminClassListItem) => {
    Modal.confirm({
      title: '删除班级',
      content: `确定要删除班级「${record.name}」吗？该操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAdminClass(record.id);
          message.success('已删除');
          actionRef.current?.reload();
        } catch (e) {
          message.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  /** Open the import modal for a class, resetting the textarea. */
  const openImport = (record: AdminClassListItem) => {
    setImportText('');
    setImporting(record);
  };

  /** Submit the import: POST the pasted lines, then surface the result. */
  const handleImportSubmit = async () => {
    if (!importing) return;
    if (!importText.trim()) {
      message.warning('请输入至少一行「学号,姓名」');
      return;
    }
    setImportingBusy(true);
    try {
      const result = await importStudents(importing.id, importText);
      const parts = [
        `新增 ${result.created} 人`,
        `跳过 ${result.skipped} 人`,
      ];
      if (result.errors.length > 0) {
        parts.push(`错误 ${result.errors.length} 行`);
      }
      message.success(parts.join('，'));
      if (result.errors.length > 0) {
        Modal.info({
          title: '导入完成（含错误）',
          width: 560,
          content: (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {result.errors.map((err, idx) => (
                <p key={idx} style={{ margin: '4px 0', color: '#ba1a1a' }}>
                  {err}
                </p>
              ))}
            </div>
          ),
          okText: '知道了',
        });
      }
      setImporting(null);
      actionRef.current?.reload();
    } catch (e) {
      message.error((e as Error).message || '导入失败');
    } finally {
      setImportingBusy(false);
    }
  };

  const columns: ProColumns<AdminClassListItem>[] = [
    {
      title: '班级名称',
      dataIndex: 'name',
      width: 160,
      hideInSearch: true,
    },
    {
      title: '年级',
      dataIndex: 'grade',
      width: 100,
      hideInSearch: true,
      renderText: (val: string) => val || '—',
    },
    {
      title: '院系',
      dataIndex: 'department',
      width: 160,
      hideInSearch: true,
      renderText: (val: string) => val || '—',
    },
    {
      title: '学生数',
      dataIndex: 'userCount',
      width: 90,
      hideInSearch: true,
    },
    {
      title: '播客数',
      dataIndex: 'podcastCount',
      width: 90,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      hideInSearch: true,
      renderText: (val: string) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      hideInSearch: true,
      render: (_: unknown, record: AdminClassListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => setEditing(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => openImport(record)}
          >
            导入学生
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
      <ProTable<AdminClassListItem>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 1000 }}
        search={false}
        options={{ density: false, fullScreen: false, reload: true, setting: false }}
        pagination={false}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => setCreateOpen(true)}
          >
            新建班级
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listAdminClasses();
            return { data, success: true, total: data.length };
          } catch (e) {
            message.error((e as Error).message || '加载班级列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />

      {/* Create class */}
      <ModalForm<ClassFormValues>
        title="新建班级"
        open={createOpen}
        onOpenChange={setCreateOpen}
        modalProps={{ destroyOnClose: true }}
        onFinish={async (values) => {
          try {
            await createAdminClass(values);
            message.success('已创建');
            actionRef.current?.reload();
            return true;
          } catch (e) {
            message.error((e as Error).message || '创建失败');
            return false;
          }
        }}
      >
        <ProFormText
          name="name"
          label="班级名称"
          placeholder="请输入班级名称"
          rules={[{ required: true, message: '请输入班级名称' }]}
        />
        <ProFormText name="grade" label="年级" placeholder="如 2024" />
        <ProFormText name="department" label="院系" placeholder="如 计算机学院" />
      </ModalForm>

      {/* Edit class — `key` forces remount so initialValues reapply per row */}
      <ModalForm<ClassFormValues>
        key={editing?.id ?? 'none'}
        title="编辑班级"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        modalProps={{ destroyOnClose: true }}
        initialValues={
          editing
            ? {
                name: editing.name,
                grade: editing.grade || undefined,
                department: editing.department || undefined,
              }
            : undefined
        }
        onFinish={async (values) => {
          if (!editing) return false;
          try {
            await updateAdminClass(editing.id, values);
            message.success('已更新');
            actionRef.current?.reload();
            return true;
          } catch (e) {
            message.error((e as Error).message || '更新失败');
            return false;
          }
        }}
      >
        <ProFormText
          name="name"
          label="班级名称"
          placeholder="请输入班级名称"
          rules={[{ required: true, message: '请输入班级名称' }]}
        />
        <ProFormText name="grade" label="年级" placeholder="如 2024" />
        <ProFormText name="department" label="院系" placeholder="如 计算机学院" />
      </ModalForm>

      {/* Import students */}
      <Modal
        title={`导入学生 — ${importing?.name ?? ''}`}
        open={!!importing}
        onCancel={() => setImporting(null)}
        onOk={handleImportSubmit}
        okText="开始导入"
        cancelText="取消"
        confirmLoading={importingBusy}
        destroyOnClose
        width={560}
      >
        <p style={{ color: '#727879', fontSize: 13, marginBottom: 8 }}>
          每行一条，格式为「学号,姓名」（逗号或制表符分隔），例如：
        </p>
        <pre
          style={{
            background: '#f5f3f3',
            padding: 8,
            borderRadius: 6,
            fontSize: 12,
            margin: '0 0 12px',
          }}
        >
          2024001,张三{'\n'}2024002,李四
        </pre>
        <TextArea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={10}
          placeholder="粘贴学生数据，每行一条…"
        />
      </Modal>
    </>
  );
};

export default ClassesPage;
