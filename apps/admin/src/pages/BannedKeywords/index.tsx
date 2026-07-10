/**
 * 评论拦截 — 关键词黑名单管理。
 *
 * ProTable 列出所有违禁词（按添加时间倒序）。ModalForm 含 textarea 支持批量
 * 添加（一行一个词）；删除走 Popconfirm 确认。命中违禁词的评论会被
 * CommentService.createComment 在写入前拒绝（BadRequestException）。
 */
import React, { useRef, useState } from 'react';
import {
  ModalForm,
  ProFormTextArea,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag as AntdTag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createBannedKeywords,
  deleteBannedKeyword,
  listBannedKeywords,
  type BannedKeyword,
} from '@/api/bannedKeywords';

const BannedKeywordsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSubmit = async (values: { keywords: string }) => {
    const keywords = values.keywords
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (keywords.length === 0) {
      message.warning('请输入至少一个关键词');
      return false;
    }
    try {
      const res = await createBannedKeywords(keywords);
      message.success(`已添加 ${res.count} 个关键词`);
      setModalOpen(false);
      actionRef.current?.reload();
      return true;
    } catch (err) {
      message.error(err instanceof Error ? err.message : '添加失败');
      return false;
    }
  };

  const handleDelete = async (row: BannedKeyword) => {
    try {
      await deleteBannedKeyword(row.id);
      message.success('已删除');
      actionRef.current?.reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ProColumns<BannedKeyword>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      render: (_, row) => <AntdTag color='red'>{row.keyword}</AntdTag>,
    },
    {
      title: '添加时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (_, row) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      valueType: 'option',
      key: 'option',
      width: 100,
      render: (_, row) => [
        <Popconfirm
          key='delete'
          title='确认删除该关键词？'
          description='删除后包含该词的评论将不再被拦截'
          onConfirm={() => handleDelete(row)}
        >
          <a style={{ color: '#ba1a1a' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<BannedKeyword>
        headerTitle='评论拦截 · 关键词黑名单'
        actionRef={actionRef}
        rowKey='id'
        search={false}
        toolBarRender={() => [
          <Button
            key='create'
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            添加关键词
          </Button>,
        ]}
        request={async () => {
          try {
            const data = await listBannedKeywords();
            return { data, success: true, total: data.length };
          } catch (err) {
            message.error(err instanceof Error ? err.message : '加载失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={columns}
        pagination={false}
        options={{ reload: true, density: false, setting: false }}
      />
      <ModalForm<{ keywords: string }>
        title='添加关键词'
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalProps={{ destroyOnClose: true }}
        initialValues={{ keywords: '' }}
        onFinish={handleSubmit}
        width={520}
      >
        <ProFormTextArea
          name='keywords'
          label='关键词'
          placeholder='一行一个关键词，例如：&#10;广告&#10;spam&#10;违禁词'
          fieldProps={{ autoSize: { minRows: 5, maxRows: 12 } }}
          rules={[
            { required: true, message: '请输入至少一个关键词' },
          ]}
        />
      </ModalForm>
    </>
  );
};

export default BannedKeywordsPage;
