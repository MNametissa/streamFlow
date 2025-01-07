import { PreviewData } from "@/types";

interface VideoPreviewProps {
  preview: PreviewData;
  className?: string;
}

export function VideoPreview({ preview, className }: VideoPreviewProps) {
  if (preview.type !== 'video' || !preview.url) return null;

  return (
    <div className={className}>
      {preview.thumbnail ? (
        <div className="group relative">
          <img
            src={preview.thumbnail}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      ) : (
        <video
          src={preview.url}
          controls
          className="w-full h-full object-cover"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}
