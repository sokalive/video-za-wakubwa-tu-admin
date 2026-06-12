export interface R2UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/** Upload video bytes directly to Cloudflare R2 via presigned PUT URL. */
export async function uploadVideoToR2(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: R2UploadProgress) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        resolve();
        return;
      }
      reject(new Error(`R2 upload failed (HTTP ${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "R2 upload failed (network/CORS). Configure CORS on your R2 bucket to allow PUT from the admin panel origin."
        )
      );
    };

    xhr.send(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
