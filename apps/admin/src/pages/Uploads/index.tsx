/**
 * 图片素材库 (Image library).
 *
 * Paginated grid of uploaded images. Supports uploading new images and
 * deleting images that are no longer referenced by any Banner/Podcast/Collection.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Modal, Pagination, Popconfirm, Typography, Upload, type UploadProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadedFile } from '@qingmalaya/shared';
import { deleteUpload, listUploads, uploadImage } from '@/api/uploads';
import { coverUrl } from '@/utils/file';

const { Paragraph, Text } = Typography;
const PAGE_SIZE = 24;

const UploadsPage: React.FC = () => {
  const { message } = App.useApp();
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImg, setPreviewImg] = useState<UploadedFile | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await listUploads(p, PAGE_SIZE);
      setImages(res.items);
      setTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      await uploadImage(file as File);
      onSuccess?.({});
      message.success('上传成功');
      await load(page);
    } catch (err) {
      onError?.(err as Error);
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUpload(id);
      message.success('图片已删除');
      if (images.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await load(page);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>图片素材库</h2>
        <Upload
          showUploadList={false}
          customRequest={handleUpload}
          accept="image/jpeg,image/png,image/webp"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={uploading}
          >
            上传图片
          </Button>
        </Upload>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          加载中...
        </div>
      ) : images.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          暂无图片，点击右上角上传
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <img
                  src={coverUrl(img.path)}
                  alt={img.originalName}
                  onClick={() => setPreviewImg(img)}
                  style={{
                    width: '100%',
                    height: 140,
                    objectFit: 'cover',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                />
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: 12,
                    color: '#666',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={img.originalName}
                  >
                    {img.originalName}
                  </span>
                  <Popconfirm
                    title="确认删除该图片？"
                    description="被 Banner/播客/精选集引用的图片无法删除"
                    onConfirm={() => handleDelete(img.id)}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      style={{ flexShrink: 0, padding: '0 4px' }}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
              showTotal={(t) => `共 ${t} 张图片`}
              size="small"
            />
          </div>
        </>
      )}

      <Modal
        title="图片路径"
        open={!!previewImg}
        onCancel={() => setPreviewImg(null)}
        footer={null}
        width={560}
      >
        {previewImg && (
          <div>
            <img
              src={coverUrl(previewImg.path)}
              alt={previewImg.originalName}
              style={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'contain',
                borderRadius: 6,
                marginBottom: 16,
              }}
            />
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                相对路径（用于表单字段 / Markdown）
              </Text>
              <Paragraph copyable style={{ margin: '4px 0 0' }}>
                {previewImg.path}
              </Paragraph>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                完整 URL
              </Text>
              <Paragraph copyable style={{ margin: '4px 0 0' }}>
                {coverUrl(previewImg.path)}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UploadsPage;
