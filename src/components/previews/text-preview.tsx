import { PreviewData } from "@/types";

interface TextPreviewProps {
  preview: PreviewData;
  className?: string;
}

export function TextPreview({ preview, className }: TextPreviewProps) {
  if (preview.type !== 'text' || !preview.content) return null;

  return (
    <div className={className}>
      <pre className="w-full h-full p-2 bg-gray-50 rounded-lg text-xs overflow-auto">
        {preview.content}
        {preview.content.length >= 500 && ' ...'}
      </pre>
    </div>
  );
}
