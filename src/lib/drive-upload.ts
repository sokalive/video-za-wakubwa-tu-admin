const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB chunks for resumable upload

export interface DriveUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

function isNetworkFetchError(err: unknown): boolean {
  return err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(err.message);
}

/**
 * Upload a video file directly to Google Drive using a resumable session URL.
 * Bytes go Browser → Google Drive (not through Vercel), supporting large files.
 *
 * The session URL must be created with the browser Origin header so Google allows CORS on PUT.
 */
export async function uploadVideoToDriveResumable(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: DriveUploadProgress) => void
): Promise<string> {
  if (!uploadUrl?.startsWith("https://")) {
    throw new Error("Invalid Google Drive upload session URL.");
  }

  let offset = 0;

  while (offset < file.size) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, chunkEnd);

    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        headers: {
          // Do not set Content-Length — browsers treat it as a forbidden header in fetch().
          "Content-Range": `bytes ${offset}-${chunkEnd - 1}/${file.size}`,
        },
        body: chunk,
      });
    } catch (err) {
      if (isNetworkFetchError(err)) {
        throw new Error(
          "Google Drive upload blocked by browser (CORS/network). The upload session must be created with your admin panel Origin. Redeploy the latest admin build and retry."
        );
      }
      throw err;
    }

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
    if (
      response.status === 403 &&
      /storageQuota|storage quota|do not have storage quota/i.test(text)
    ) {
      throw new Error(
        "HTTP 403: Service accounts do not have storage quota. Move GOOGLE_DRIVE_FOLDER_ID to a Shared Drive folder (storageType=shared_drive), add the service account as Content manager, and redeploy."
      );
    }
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
