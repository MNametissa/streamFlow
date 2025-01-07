import { X } from 'lucide-react';
import { FileItem } from '@/types';
import { formatBytes } from '@/lib/utils';
import { ImagePreview, VideoPreview, PDFPreview, TextPreview } from './previews';
import { SpreadsheetPreview } from './previews/spreadsheet-preview';

interface FilePreviewCardProps {
  file: FileItem;
  onRemove: (fileId: string) => void;
}

export function FilePreviewCard({ file, onRemove }: FilePreviewCardProps) {
  const renderPreview = () => {
    switch (file.preview.type) {
      case 'image':
        return (
          <ImagePreview
            preview={file.preview}
            alt={file.file.name}
            className="h-16 w-16 rounded-lg object-cover"
          />
        );
      case 'video':
        return (
          <VideoPreview
            preview={file.preview}
            className="h-16 w-16 rounded-lg overflow-hidden"
          />
        );
      case 'pdf':
        return (
          <PDFPreview
            preview={file.preview}
            className="h-16 w-16 rounded-lg overflow-hidden"
          />
        );
      case 'text':
        return (
          <TextPreview
            preview={file.preview}
            className="h-16 w-16 rounded-lg overflow-hidden"
          />
        );
      case 'spreadsheet':
        return (
          <SpreadsheetPreview
            preview={file.preview}
            className="h-16 w-16 rounded-lg overflow-hidden"
          />
        );
      default:
        return (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
            <span className="text-xs uppercase text-gray-500">
              {file.file.type.split('/')[1] || 'File'}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="relative rounded-lg border bg-card p-4 shadow-sm">
      <button
        onClick={() => onRemove(file.id)}
        className="absolute right-2 top-2 rounded-full p-1 hover:bg-gray-100"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start space-x-4">
        {renderPreview()}

        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-medium">{file.file.name}</h4>
          <p className="text-xs text-gray-500">{formatBytes(file.file.size)}</p>

          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
              style={{ width: `${file.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span
              className={
                file.status === 'error'
                  ? 'text-destructive'
                  : file.status === 'completed'
                  ? 'text-green-600'
                  : 'text-gray-500'
              }
            >
              {file.status === 'error'
                ? file.error || 'Upload failed'
                : file.status === 'completed'
                ? 'Upload complete'
                : `${Math.round(file.progress)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
