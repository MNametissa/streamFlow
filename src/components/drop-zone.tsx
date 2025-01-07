import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFilesDrop: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
  allowedFileTypes?: string[];
}

export function DropZone({
  onFilesDrop,
  multiple = true,
  className,
  allowedFileTypes,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (!multiple && files.length > 1) {
        files.splice(1);
      }

      onFilesDrop(files);
    },
    [multiple, onFilesDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!multiple && files.length > 1) {
        files.splice(1);
      }
      onFilesDrop(files);
      e.target.value = '';
    },
    [multiple, onFilesDrop]
  );

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-dashed border-gray-300 p-6 transition-colors',
        isDragging && 'border-primary bg-primary/5',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="absolute inset-0 cursor-pointer opacity-0"
        multiple={multiple}
        accept={allowedFileTypes?.join(',')}
        onChange={handleFileInput}
      />
      <div className="flex flex-col items-center justify-center space-y-2 text-center">
        <Upload className="h-8 w-8 text-gray-400" />
        <div className="text-sm">
          <span className="font-semibold text-primary">Click to upload</span> or drag
          and drop
        </div>
        {allowedFileTypes && (
          <p className="text-xs text-gray-500">
            Allowed types: {allowedFileTypes.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
