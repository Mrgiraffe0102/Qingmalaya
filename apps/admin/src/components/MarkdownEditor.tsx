/**
 * Markdown editor with live preview and image insert.
 *
 * Left pane is a textarea, right pane renders the markdown via react-markdown.
 * The toolbar has an "insert image" button that uploads an image and inserts
 * the markdown image syntax at the cursor position.
 */
import React, { useRef, useState } from 'react';
import { App, Button, Modal, Upload, type UploadProps } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UploadedFile } from '@qingmalaya/shared';
import { uploadImage, listUploads } from '@/api/uploads';
import { coverUrl } from '@/utils/file';

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value = '', onChange }) => {
  const { message } = App.useApp();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState<UploadedFile[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange?.(value + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + text + value.slice(end);
    onChange?.(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    });
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const result = await uploadImage(file as File);
      insertAtCursor(`![](${result.path})`);
      onSuccess?.(result);
      message.success('图片已插入');
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
    insertAtCursor(`![](${path})`);
    setLibraryOpen(false);
    message.success('图片已插入');
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Upload
          showUploadList={false}
          customRequest={handleUpload}
          accept="image/jpeg,image/png,image/webp"
        >
          <Button
            size="small"
            icon={<PictureOutlined />}
            loading={uploading}
          >
            插入图片
          </Button>
        </Upload>
        <Button
          size="small"
          type="link"
          onClick={openLibrary}
          style={{ marginLeft: 8 }}
        >
          从图片库选择
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="输入 Markdown 内容..."
          style={{
            flex: 1,
            minHeight: 300,
            padding: 12,
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: 13,
            resize: 'vertical',
          }}
        />
        <div
          style={{
            flex: 1,
            minHeight: 300,
            padding: 12,
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            overflow: 'auto',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {value || '*预览区*'}
          </ReactMarkdown>
        </div>
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

export default MarkdownEditor;
