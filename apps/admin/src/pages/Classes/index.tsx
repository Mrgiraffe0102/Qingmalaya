/**
 * 班级管理 — class CRUD + batch student import + submission status export.
 *
 * ProTable lists all classes (no pagination — the catalog is small). The
 * toolbar exposes a "新建班级" button opening a ModalForm. Each row has
 * edit (ModalForm), delete (confirm modal, rejected server-side if the class
 * still has users), "导入学生" (modal with a TextArea accepting pasted
 * `studentId,name` lines), and "导出" (dropdown: CSV / Excel per-student
 * submission status).
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormText,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App as AntdApp, Button, Checkbox, Dropdown, Input, Modal, Space, Spin, Table } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  createAdminClass,
  deleteAdminClass,
  getStudentAdmins,
  getSubmissionStatus,
  importStudents,
  listAdminClasses,
  setStudentAdmins,
  updateAdminClass,
  type AdminClassListItem,
  type StudentAdminItem,
  type StudentSubmissionStatus,
} from '@/api/classes';

const { TextArea } = Input;

/** Form values shared by the create + edit ModalForms. */
interface ClassFormValues {
  name: string;
  grade?: string;
}

type ExportFormat = 'csv' | 'xlsx';

/** Column labels for the submission-status export. */
const EXPORT_HEADERS = [
  '学号',
  '姓名',
  '是否已提交',
  '已发布播客数',
  '已上传播客',
] as const;

/** Replace characters that are invalid in filenames. */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

/** Build the 2D data array (header + student rows + summary) for export. */
function buildExportRows(
  students: StudentSubmissionStatus[],
): (string | number)[][] {
  const dataRows: (string | number)[][] = students.map((s) => [
    s.studentId,
    s.name,
    s.submitted ? '是' : '否',
    s.published,
    s.podcastTitles.join('、'),
  ]);
  const submittedCount = students.filter((s) => s.submitted).length;
  const totalPublished = students.reduce((sum, s) => sum + s.published, 0);
  const summary: (string | number)[] = [
    '合计',
    `${students.length} 人`,
    `已提交 ${submittedCount}/${students.length}`,
    totalPublished,
    '—',
  ];
  return [[...EXPORT_HEADERS], ...dataRows, summary];
}

/** Trigger a browser download for a Blob. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export submission status as CSV (UTF-8 with BOM for Excel compatibility). */
function exportCsv(className: string, students: StudentSubmissionStatus[]): void {
  const rows = buildExportRows(students);
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(','),
    )
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, `${sanitizeFilename(className)}_提交状况.csv`);
}

/** Export submission status as a real .xlsx file via SheetJS. */
function exportExcel(className: string, students: StudentSubmissionStatus[]): void {
  const rows = buildExportRows(students);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '提交状况');
  XLSX.writeFile(wb, `${sanitizeFilename(className)}_提交状况.xlsx`);
}

const ClassesPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = AntdApp.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminClassListItem | null>(null);
  const [importing, setImporting] = useState<AdminClassListItem | null>(null);
  const [importText, setImportText] = useState('');
  const [importingBusy, setImportingBusy] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const [studentAdminClass, setStudentAdminClass] = useState<AdminClassListItem | null>(null);
  const [studentAdminList, setStudentAdminList] = useState<StudentAdminItem[]>([]);
  const [studentAdminLoading, setStudentAdminLoading] = useState(false);
  const [studentAdminSelected, setStudentAdminSelected] = useState<number[]>([]);
  const [studentAdminSaving, setStudentAdminSaving] = useState(false);

  /** Fetch submission status and trigger a CSV or Excel download. */
  const handleExport = async (
    record: AdminClassListItem,
    format: ExportFormat,
  ) => {
    setExportingId(record.id);
    try {
      const data = await getSubmissionStatus(record.id);
      if (data.students.length === 0) {
        message.warning('该班级暂无学生');
        return;
      }
      if (format === 'csv') {
        exportCsv(data.className, data.students);
      } else {
        exportExcel(data.className, data.students);
      }
      message.success(`已导出 ${data.students.length} 名学生的提交状况`);
    } catch (e) {
      message.error((e as Error).message || '导出失败');
    } finally {
      setExportingId(null);
    }
  };

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

  /** Open the student-admin modal for a class, fetching the current list. */
  const openStudentAdmins = async (record: AdminClassListItem) => {
    setStudentAdminClass(record);
    setStudentAdminList([]);
    setStudentAdminSelected([]);
    setStudentAdminLoading(true);
    try {
      const list = await getStudentAdmins(record.id);
      setStudentAdminList(list);
      setStudentAdminSelected(list.filter((s) => s.isStudentAdmin).map((s) => s.id));
    } catch (e) {
      message.error((e as Error).message || '加载学生列表失败');
    } finally {
      setStudentAdminLoading(false);
    }
  };

  /** Save the selected student admins for the class. */
  const handleStudentAdminSubmit = async () => {
    if (!studentAdminClass) return;
    setStudentAdminSaving(true);
    try {
      await setStudentAdmins(studentAdminClass.id, studentAdminSelected);
      message.success('已更新学生管理员');
      setStudentAdminClass(null);
    } catch (e) {
      message.error((e as Error).message || '保存失败');
    } finally {
      setStudentAdminSaving(false);
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
      width: 380,
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
            onClick={() => void openStudentAdmins(record)}
          >
            学生管理员
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'csv', label: '导出 CSV' },
                { key: 'xlsx', label: '导出 Excel' },
              ],
              onClick: ({ key }) =>
                handleExport(record, key as ExportFormat),
            }}
          >
            <Button
              type="link"
              size="small"
              loading={exportingId === record.id}
            >
              导出 <DownOutlined />
            </Button>
          </Dropdown>
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

      {/* Student admin management */}
      <Modal
        title={`学生管理员 — ${studentAdminClass?.name ?? ''}`}
        open={!!studentAdminClass}
        onCancel={() => setStudentAdminClass(null)}
        onOk={handleStudentAdminSubmit}
        okText="保存"
        cancelText="取消"
        confirmLoading={studentAdminSaving}
        destroyOnClose
        width={560}
      >
        <p style={{ color: '#727879', fontSize: 13, marginBottom: 12 }}>
          勾选要设为学生管理员的成员。学生管理员可在前端审核同班级同学的播客，但无后台登录权限。
        </p>
        {studentAdminLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <Table<StudentAdminItem>
            rowKey="id"
            dataSource={studentAdminList}
            pagination={false}
            size="small"
            scroll={{ y: 360 }}
            columns={[
              { title: '学号', dataIndex: 'studentId', width: 120 },
              { title: '姓名', dataIndex: 'name' },
              {
                title: '学生管理员',
                dataIndex: 'isStudentAdmin',
                width: 100,
                align: 'center',
                render: (_: unknown, row: StudentAdminItem) => (
                  <Checkbox
                    checked={studentAdminSelected.includes(row.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setStudentAdminSelected((prev) => [...prev, row.id]);
                      } else {
                        setStudentAdminSelected((prev) =>
                          prev.filter((id) => id !== row.id),
                        );
                      }
                    }}
                  />
                ),
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
};

export default ClassesPage;
