import { google } from "googleapis";
import { normalizeGoogleDriveUrl } from "@/lib/google-drive";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export function isGoogleDriveUploadConfigured(): boolean {
  return !!(parseServiceAccount() && process.env.GOOGLE_DRIVE_FOLDER_ID?.trim());
}

function parseServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function getDriveFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured.");
  }
  return folderId;
}

async function getAccessToken(): Promise<string> {
  const creds = parseServiceAccount();
  if (!creds) {
    throw new Error(
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is missing or invalid. Add your service account JSON to Vercel env vars."
    );
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [DRIVE_SCOPE],
  });

  const { token: accessToken } = await auth.getAccessToken();
  if (!accessToken) {
    throw new Error("Failed to obtain Google Drive access token.");
  }
  return accessToken;
}

export function getServiceAccountEmail(): string | null {
  return parseServiceAccount()?.client_email ?? null;
}

/** Creates a resumable upload session; client uploads bytes directly to Google (bypasses Vercel body limits). */
export async function createResumableUploadSession(
  fileName: string,
  mimeType: string
): Promise<string> {
  const folderId = getDriveFolderId();
  const token = await getAccessToken();

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fileName,
      parents: [folderId],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive session failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Google Drive did not return a resumable upload URL.");
  }

  return uploadUrl;
}

/** Makes the file viewable by anyone with the link and returns the normalized share URL. */
export async function finalizeDriveUpload(fileId: string): Promise<string> {
  const token = await getAccessToken();

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set Drive permissions (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const normalized = normalizeGoogleDriveUrl(`https://drive.google.com/file/d/${fileId}/view`);
  if (!normalized) {
    throw new Error("Failed to build shareable Google Drive URL.");
  }

  return normalized;
}

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
  "application/octet-stream",
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".mpg"];

export function isAllowedVideoFile(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  const extOk = ALLOWED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mimeOk =
    ALLOWED_VIDEO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]) ||
    mimeType.startsWith("video/");
  return extOk || mimeOk;
}

export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;
