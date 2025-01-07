import { PreviewData } from '@/types';
import { FileText } from 'lucide-react';

interface PDFPreviewProps {
  preview: PreviewData;
  className?: string;
}

export function PDFPreview({ preview, className }: PDFPreviewProps) {
  if (preview.type !== 'pdf') return null;

  return (
    <div className={className}>
      {preview.url ? (
        <object
          data={preview.url}
          type="application/pdf"
          className="w-full h-full min-h-[200px]"
        >
          <div className="flex flex-col items-center justify-center w-full h-full bg-gray-100 rounded-lg">
            <FileText className="w-8 h-8 text-gray-400" />
            <span className="mt-2 text-sm text-gray-500">PDF Preview</span>
          </div>
        </object>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-100 rounded-lg">
          <FileText className="w-8 h-8 text-gray-400" />
          <span className="mt-2 text-sm text-gray-500">PDF Preview</span>
        </div>
      )}
    </div>
  );
}
