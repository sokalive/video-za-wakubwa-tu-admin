/** Client-safe video upload limits (keep in sync with src/lib/r2-client.ts). */
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".mpg"];

export const ALLOWED_VIDEO_MIME_PREFIX = "video/";

export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024; // 10 MB

export const BULK_UPLOAD_CONCURRENCY = 3;

export function isAllowedVideoFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  const extOk = ALLOWED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mimeOk = file.type.startsWith(ALLOWED_VIDEO_MIME_PREFIX) || file.type === "";
  return extOk || mimeOk;
}

export function validateVideoFile(file: File): string | null {
  if (!isAllowedVideoFile(file)) {
    return "Unsupported format. Use MP4, WebM, MOV, AVI, or MKV.";
  }
  if (file.size <= 0) return "File is empty.";
  if (file.size > MAX_VIDEO_BYTES) {
    return `File exceeds ${MAX_VIDEO_BYTES / (1024 * 1024 * 1024)} GB limit.`;
  }
  return null;
}

export function validateThumbnailFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Thumbnail must be an image file.";
  if (file.size > MAX_THUMBNAIL_BYTES) return "Thumbnail exceeds 10 MB limit.";
  return null;
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Untitled Video";
}

export function uniqueQueueId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
