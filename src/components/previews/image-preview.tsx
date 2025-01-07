import { PreviewData } from "@/types";

interface ImagePreviewProps {
  preview: PreviewData;
  alt: string;
  className?: string;
}

export function ImagePreview({ preview, alt, className }: ImagePreviewProps) {
  if (preview.type !== 'image' || !preview.url) return null;

  return (
    <img
      src={preview.url}
      alt={alt}
      className={className}
    />
  );
}
