/**
 * Image picker form component.
 *
 * Uploads an image via POST /upload/image and stores the relative path in the
 * form field. Also supports selecting from the image library via a modal.
 */
import React, { useState } from 'react';
import { App, Button, Modal, Upload, type UploadProps } from 'antd';
import { PictureOutlined, FolderOpenOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadedFile } from '@qingmalaya/shared';
import { uploadImage, listUploads } from '@/api/uploads';
import { coverUrl } from '@/utils/file';

interface ImagePickerProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  width?: number;
  height?: number;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
  width = 200,
  height = 112,
}) => {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState<UploadedFile[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const result = await uploadImage(file as File);
      onChange?.(result.path);
      onSuccess?.(result);
      message.success('上传成功');
    } catch (err) {
      onError?.(err as Error);
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const openLibrary = async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const res = await listUploads(1, 48);
      setLibraryImages(res.items);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载图片库失败');
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleSelectFromLibrary = (path: string) => {
    onChange?.(path);
    setLibraryOpen(false);
  };

  const handleDelete = () => {
    onChange?.(undefined);
  };

  return (
    <div>
      {value ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={coverUrl(value)}
            alt="preview"
            style={{
              width,
              height,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={handleDelete}
            style={{ position: 'absolute', top: 4, right: 4 }}
          />
        </div>
      ) : (
        <Upload
          listType="picture-card"
          showUploadList={false}
          customRequest={handleUpload}
          accept="image/jpeg,image/png,image/webp"
        >
          <div style={{ padding: 8 }}>
            <PictureOutlined style={{ fontSize: 24, color: '#999' }} />
            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
              {uploading ? '上传中...' : '点击上传'}
            </div>
          </div>
        </Upload>
      )}
      <div style={{ marginTop: 8 }}>
        <Button
          size="small"
          type="link"
          icon={<FolderOpenOutlined />}
          onClick={openLibrary}
        >
          从图片库选择
        </Button>
      </div>
      <Modal
        title="图片素材库"
        open={libraryOpen}
        onCancel={() => setLibraryOpen(false)}
        footer={null}
        width={720}
      >
        {libraryLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            加载中...
          </div>
        ) : libraryImages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无图片
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {libraryImages.map((img) => (
              <div
                key={img.id}
                onClick={() => handleSelectFromLibrary(img.path)}
                style={{
                  cursor: 'pointer',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={coverUrl(img.path)}
                  alt={img.originalName}
                  style={{
                    width: '100%',
                    height: 100,
                    objectFit: 'cover',
                  }}
                />
                <div
                  style={{
                    padding: '4px 6px',
                    fontSize: 11,
                    color: '#999',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {img.originalName}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ImagePicker;
