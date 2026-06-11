import { google } from "googleapis";
import { normalizeGoogleDriveUrl } from "@/lib/google-drive";
import { sanitizeEnv } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export interface DriveConfigStatus {
  configured: boolean;
  serviceAccountJsonSet: boolean;
  folderIdSet: boolean;
  jsonParseOk: boolean;
  clientEmail: string | null;
  folderId: string | null;
  reason: string | null;
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

function parseJsonServiceAccount(raw: string): { client_email: string; private_key: string } | null {
  let value = raw.trim();

  // Vercel sometimes stores JSON wrapped in extra quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      value = JSON.parse(value) as string;
    } catch {
      value = value.slice(1, -1).trim();
    }
  }

  try {
    const parsed = JSON.parse(value) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email.trim(),
      private_key: normalizePrivateKey(parsed.private_key),
    };
  } catch {
    return null;
  }
}

function parseBase64ServiceAccount(raw: string): { client_email: string; private_key: string } | null {
  try {
    const decoded = Buffer.from(raw.trim(), "base64").toString("utf8");
    return parseJsonServiceAccount(decoded);
  } catch {
    return null;
  }
}

function parseSplitServiceAccount(): { client_email: string; private_key: string } | null {
  const email = sanitizeEnv(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
  if (!email || !key) return null;
  return {
    client_email: email,
    private_key: normalizePrivateKey(key),
  };
}

export function parseServiceAccount(): { client_email: string; private_key: string } | null {
  const jsonRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = parseJsonServiceAccount(jsonRaw);
    if (parsed) return parsed;
  }

  const b64Raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64Raw) {
    const parsed = parseBase64ServiceAccount(b64Raw);
    if (parsed) return parsed;
  }

  return parseSplitServiceAccount();
}

function extractFolderId(value: string): string | null {
  const trimmed = sanitizeEnv(value);
  if (!trimmed) return null;

  // Full folder URL pasted by mistake
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  // Raw folder ID
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  return null;
}

export function getDriveFolderId(): string | null {
  const fromId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
  if (fromId) return fromId;

  const fromUrl = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_URL ?? "");
  if (fromUrl) return fromUrl;

  return null;
}

export function getDriveConfigStatus(): DriveConfigStatus {
  const jsonRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  const b64Raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const splitEmail = sanitizeEnv(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const splitKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();

  const serviceAccountJsonSet = !!(jsonRaw || b64Raw || (splitEmail && splitKey));

  let jsonParseOk = false;
  let clientEmail: string | null = null;

  if (jsonRaw) {
    const parsed = parseJsonServiceAccount(jsonRaw);
    jsonParseOk = !!parsed;
    clientEmail = parsed?.client_email ?? null;
  } else if (b64Raw) {
    const parsed = parseBase64ServiceAccount(b64Raw);
    jsonParseOk = !!parsed;
    clientEmail = parsed?.client_email ?? null;
  } else if (splitEmail && splitKey) {
    jsonParseOk = true;
    clientEmail = splitEmail;
  }

  const folderId = getDriveFolderId();
  const folderIdSet = !!folderId;

  const configured = jsonParseOk && folderIdSet;

  let reason: string | null = null;
  if (!serviceAccountJsonSet) {
    reason =
      "Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (or GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY) on Vercel.";
  } else if (!jsonParseOk) {
    reason =
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is set but invalid JSON. Paste minified single-line JSON with \\n in private_key, or use GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64.";
  } else if (!folderIdSet) {
    reason =
      "GOOGLE_DRIVE_FOLDER_ID is not set. Add your Google Drive folder ID (from the folder URL) to Vercel and redeploy.";
  }

  return {
    configured,
    serviceAccountJsonSet,
    folderIdSet,
    jsonParseOk,
    clientEmail,
    folderId,
    reason,
  };
}

export function isGoogleDriveUploadConfigured(): boolean {
  return getDriveConfigStatus().configured;
}

async function getAccessToken(): Promise<string> {
  const creds = parseServiceAccount();
  if (!creds) {
    const status = getDriveConfigStatus();
    throw new Error(status.reason ?? "Google Drive credentials are not configured.");
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
  return parseServiceAccount()?.client_email ?? getDriveConfigStatus().clientEmail;
}

/** Creates a resumable upload session; client uploads bytes directly to Google (bypasses Vercel body limits). */
export async function createResumableUploadSession(
  fileName: string,
  mimeType: string
): Promise<string> {
  const folderId = getDriveFolderId();
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured.");
  }

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
