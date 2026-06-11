const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB chunks for resumable upload

export interface DriveUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Upload a video file directly to Google Drive using a resumable session URL.
 * Bytes go Browser → Google Drive (not through Vercel), supporting large files.
 */
export async function uploadVideoToDriveResumable(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: DriveUploadProgress) => void
): Promise<string> {
  let offset = 0;

  while (offset < file.size) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, chunkEnd);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.size),
        "Content-Range": `bytes ${offset}-${chunkEnd - 1}/${file.size}`,
      },
      body: chunk,
    });

    if (response.status === 308) {
      offset = chunkEnd;
      onProgress?.({
        loaded: offset,
        total: file.size,
        percent: Math.round((offset / file.size) * 100),
      });
      continue;
    }

    if (response.status === 200 || response.status === 201) {
      const data = (await response.json()) as { id?: string };
      if (data?.id) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        return data.id;
      }
    }

    const text = await response.text().catch(() => "");
    throw new Error(`Google Drive upload failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  throw new Error("Google Drive upload did not return a file ID.");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
