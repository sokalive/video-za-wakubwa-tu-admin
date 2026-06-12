import { google } from "googleapis";
import { normalizeGoogleDriveUrl } from "@/lib/google-drive";
import { sanitizeEnv } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

export interface DriveConfigStatus {
  configured: boolean;
  serviceAccountJsonSet: boolean;
  folderIdSet: boolean;
  jsonParseOk: boolean;
  clientEmail: string | null;
  folderId: string | null;
  rawFolderIdLength: number;
  reason: string | null;
}

export interface DriveFolderProbe {
  ok: boolean;
  folderId: string;
  serviceAccountEmail: string;
  httpStatus: number | null;
  folderName: string | null;
  mimeType: string | null;
  driveId: string | null;
  isSharedDrive: boolean;
  canAddChildren: boolean | null;
  error: string | null;
  fixHint: string | null;
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

function parseJsonServiceAccount(raw: string): { client_email: string; private_key: string } | null {
  let value = raw.trim();

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

  // https://drive.google.com/drive/folders/ID
  // https://drive.google.com/drive/u/0/folders/ID
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) return foldersMatch[1];

  // https://drive.google.com/open?id=ID
  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];

  // Raw folder ID (Google IDs: letters, digits, hyphen, underscore)
  const raw = trimmed.replace(/\s+/g, "");
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) return raw;

  return null;
}

export function getDriveFolderId(): string | null {
  const fromId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
  if (fromId) return fromId;

  const fromUrl = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_URL ?? "");
  if (fromUrl) return fromUrl;

  return null;
}

export function getRawFolderIdEnvLength(): number {
  return (process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DRIVE_FOLDER_URL ?? "").trim().length;
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
      "GOOGLE_DRIVE_FOLDER_ID is not set or could not be parsed. Use the folder ID from the URL (after /folders/) and redeploy.";
  }

  return {
    configured,
    serviceAccountJsonSet,
    folderIdSet,
    jsonParseOk,
    clientEmail,
    folderId,
    rawFolderIdLength: getRawFolderIdEnvLength(),
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

function driveQuery(params: Record<string, string>): string {
  return new URLSearchParams({
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    ...params,
  }).toString();
}

/** Verify service account can see the target folder before upload. */
export async function probeDriveFolder(folderId?: string): Promise<DriveFolderProbe> {
  const id = folderId ?? getDriveFolderId();
  const creds = parseServiceAccount();

  if (!id || !creds) {
    return {
      ok: false,
      folderId: id ?? "",
      serviceAccountEmail: creds?.client_email ?? "",
      httpStatus: null,
      folderName: null,
      mimeType: null,
      driveId: null,
      isSharedDrive: false,
      canAddChildren: null,
      error: "Missing folder ID or service account credentials.",
      fixHint: getDriveConfigStatus().reason,
    };
  }

  const token = await getAccessToken();
  const fields = "id,name,mimeType,driveId,capabilities(canAddChildren)";
  const url = `${DRIVE_FILES}/${encodeURIComponent(id)}?${driveQuery({ fields })}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    const is404 = res.status === 404;
    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: creds.client_email,
      httpStatus: res.status,
      folderName: null,
      mimeType: null,
      driveId: null,
      isSharedDrive: false,
      canAddChildren: null,
      error: text.slice(0, 400),
      fixHint: is404
        ? `Folder not visible to service account. In Google Drive, open the folder → Share → add "${creds.client_email}" as Editor. If using a Shared Drive, add the service account as Content manager on the Shared Drive (not only the folder). Then redeploy.`
        : `Drive API returned HTTP ${res.status}. Check credentials and folder ID.`,
    };
  }

  const data = (await res.json()) as {
    id?: string;
    name?: string;
    mimeType?: string;
    driveId?: string;
    capabilities?: { canAddChildren?: boolean };
  };

  const isFolder = data.mimeType === "application/vnd.google-apps.folder";
  const canAdd = data.capabilities?.canAddChildren ?? null;

  if (!isFolder) {
    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: creds.client_email,
      httpStatus: res.status,
      folderName: data.name ?? null,
      mimeType: data.mimeType ?? null,
      driveId: data.driveId ?? null,
      isSharedDrive: !!data.driveId,
      canAddChildren: canAdd,
      error: `ID resolves to "${data.name}" (${data.mimeType}), not a folder.`,
      fixHint: "GOOGLE_DRIVE_FOLDER_ID must be a folder ID, not a file ID. Copy the ID from a folder URL.",
    };
  }

  if (canAdd === false) {
    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: creds.client_email,
      httpStatus: res.status,
      folderName: data.name ?? null,
      mimeType: data.mimeType ?? null,
      driveId: data.driveId ?? null,
      isSharedDrive: !!data.driveId,
      canAddChildren: false,
      error: `Service account can see folder "${data.name}" but cannot add files (canAddChildren=false).`,
      fixHint: `Share the folder (or Shared Drive) with "${creds.client_email}" as Editor / Content manager.`,
    };
  }

  return {
    ok: true,
    folderId: id,
    serviceAccountEmail: creds.client_email,
    httpStatus: res.status,
    folderName: data.name ?? null,
    mimeType: data.mimeType ?? null,
    driveId: data.driveId ?? null,
    isSharedDrive: !!data.driveId,
    canAddChildren: canAdd,
    error: null,
    fixHint: null,
  };
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

  const probe = await probeDriveFolder(folderId);
  if (!probe.ok) {
    throw new Error(
      probe.fixHint ??
        probe.error ??
        `Cannot access Google Drive folder ${folderId}. Share it with ${probe.serviceAccountEmail}.`
    );
  }

  const token = await getAccessToken();

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?${driveQuery({ uploadType: "resumable" })}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive session failed (HTTP ${res.status}): ${text.slice(0, 400)}`);
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

  const res = await fetch(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?${driveQuery({})}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set Drive permissions (HTTP ${res.status}): ${text.slice(0, 400)}`);
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
