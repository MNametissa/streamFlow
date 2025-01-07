import { Button } from './ui/button';
import { DropZone } from './drop-zone';
import { FilePreviewCard } from './file-preview-card';
import { useUpload } from '@/hooks/use-upload';
import { StreamFlowProps } from '@/types';
import { cn } from '@/lib/utils';

export function StreamFlow({
  endpoint,
  websocketUrl,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  chunkSize = 1024 * 1024, // 1MB
  allowedFileTypes,
  multiple = true,
  className,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onError,
}: StreamFlowProps) {
  const {
    files,
    isUploading,
    addFiles,
    removeFile,
    startUpload,
    cancelUpload,
  } = useUpload({
    endpoint,
    chunkSize,
    maxFileSize,
    allowedFileTypes,
    onUploadStart,
    onUploadProgress,
    onUploadComplete,
    onError,
  });

  return (
    <div className={cn('space-y-4', className)}>
      <DropZone
        onFilesDrop={addFiles}
        multiple={multiple}
        allowedFileTypes={allowedFileTypes}
        className="min-h-[200px]"
      />

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <FilePreviewCard
                key={file.id}
                file={file}
                onRemove={removeFile}
              />
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={cancelUpload}
              disabled={!isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={startUpload}
              disabled={isUploading || files.length === 0}
            >
              Upload {files.length} {files.length === 1 ? 'file' : 'files'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
