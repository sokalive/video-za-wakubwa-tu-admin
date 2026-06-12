import { google, type drive_v3 } from "googleapis";
import type { GaxiosError } from "gaxios";
import { normalizeGoogleDriveUrl } from "@/lib/google-drive";
import { sanitizeEnv } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const SHARED_DRIVE_PARAMS = {
  supportsAllDrives: true,
  supportsTeamDrives: true,
} as const;

export interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  project_id: string | null;
}

export interface DriveApiTrace {
  operation: string;
  method: string;
  url: string;
  queryParams: Record<string, string | boolean | undefined>;
  requestBody?: unknown;
  responseStatus: number | null;
  responseBody: unknown;
  folderIdSent: string | null;
  authenticatedEmail: string | null;
  projectId: string | null;
}

export interface DriveConfigStatus {
  configured: boolean;
  serviceAccountJsonSet: boolean;
  folderIdSet: boolean;
  jsonParseOk: boolean;
  clientEmail: string | null;
  projectId: string | null;
  folderId: string | null;
  rawFolderIdEnv: string | null;
  rawFolderIdLength: number;
  reason: string | null;
}

export interface DriveFolderProbe {
  ok: boolean;
  folderId: string;
  serviceAccountEmail: string;
  projectId: string | null;
  httpStatus: number | null;
  folderName: string | null;
  mimeType: string | null;
  driveId: string | null;
  isSharedDrive: boolean;
  canAddChildren: boolean | null;
  error: string | null;
  fixHint: string | null;
  apiTrace: DriveApiTrace | null;
  uploadSessionTrace: DriveApiTrace | null;
}

function normalizePrivateKey(key: string): string {
  let normalized = key.replace(/\\n/g, "\n").trim();
  if (normalized.includes("BEGIN PRIVATE KEY") && !normalized.endsWith("\n")) {
    normalized += "\n";
  }
  return normalized;
}

function parseJsonServiceAccount(raw: string): ServiceAccountCreds | null {
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
    const parsed = JSON.parse(value) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email.trim(),
      private_key: normalizePrivateKey(parsed.private_key),
      project_id: parsed.project_id?.trim() ?? null,
    };
  } catch {
    return null;
  }
}

function parseBase64ServiceAccount(raw: string): ServiceAccountCreds | null {
  try {
    const decoded = Buffer.from(raw.trim(), "base64").toString("utf8");
    return parseJsonServiceAccount(decoded);
  } catch {
    return null;
  }
}

function parseSplitServiceAccount(): ServiceAccountCreds | null {
  const email = sanitizeEnv(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
  if (!email || !key) return null;
  return {
    client_email: email,
    private_key: normalizePrivateKey(key),
    project_id: sanitizeEnv(process.env.GOOGLE_DRIVE_PROJECT_ID) || null,
  };
}

export function parseServiceAccount(): ServiceAccountCreds | null {
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

function cleanDriveId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function extractFolderId(value: string): string | null {
  const trimmed = sanitizeEnv(value);
  if (!trimmed) return null;

  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) return cleanDriveId(foldersMatch[1]);

  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return cleanDriveId(openMatch[1]);

  const raw = cleanDriveId(trimmed.replace(/\s+/g, ""));
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) return raw;

  return null;
}

export function getRawFolderIdEnv(): string | null {
  const raw = process.env.GOOGLE_DRIVE_FOLDER_ID ?? process.env.GOOGLE_DRIVE_FOLDER_URL ?? "";
  return raw.trim() || null;
}

export function getDriveFolderId(): string | null {
  const fromId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
  if (fromId) return fromId;

  const fromUrl = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_URL ?? "");
  if (fromUrl) return fromUrl;

  return null;
}

export function getDriveConfigStatus(): DriveConfigStatus {
  const creds = parseServiceAccount();
  const jsonRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  const b64Raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const splitEmail = sanitizeEnv(process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const splitKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim();

  const serviceAccountJsonSet = !!(jsonRaw || b64Raw || (splitEmail && splitKey));
  const jsonParseOk = !!creds;
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
    clientEmail: creds?.client_email ?? null,
    projectId: creds?.project_id ?? null,
    folderId,
    rawFolderIdEnv: getRawFolderIdEnv(),
    rawFolderIdLength: getRawFolderIdEnv()?.length ?? 0,
    reason,
  };
}

export function isGoogleDriveUploadConfigured(): boolean {
  return getDriveConfigStatus().configured;
}

function formatGaxiosError(err: unknown): { status: number | null; body: unknown; message: string } {
  const gaxios = err as GaxiosError;
  return {
    status: gaxios.response?.status ?? null,
    body: gaxios.response?.data ?? gaxios.message,
    message: gaxios.message,
  };
}

async function getAuthenticatedDrive(): Promise<{
  drive: drive_v3.Drive;
  creds: ServiceAccountCreds;
  accessToken: string;
}> {
  const creds = parseServiceAccount();
  if (!creds) {
    const status = getDriveConfigStatus();
    throw new Error(status.reason ?? "Google Drive credentials are not configured.");
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [DRIVE_SCOPE],
    projectId: creds.project_id ?? undefined,
  });

  const tokenResponse = await auth.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) {
    throw new Error("Failed to obtain Google Drive access token.");
  }

  return {
    drive: google.drive({ version: "v3", auth }),
    creds,
    accessToken,
  };
}

export function getServiceAccountEmail(): string | null {
  return parseServiceAccount()?.client_email ?? getDriveConfigStatus().clientEmail;
}

/** files.get — folder metadata lookup (no includeItemsFromAllDrives; invalid on get). */
async function filesGetFolderTrace(
  drive: drive_v3.Drive,
  creds: ServiceAccountCreds,
  folderId: string
): Promise<{ data: drive_v3.Schema$File | null; trace: DriveApiTrace; error: string | null }> {
  const queryParams = {
    ...SHARED_DRIVE_PARAMS,
    fields: "id,name,mimeType,driveId,capabilities",
  };

  const trace: DriveApiTrace = {
    operation: "files.get",
    method: "GET",
    url: `https://www.googleapis.com/drive/v3/files/${folderId}`,
    queryParams,
    responseStatus: null,
    responseBody: null,
    folderIdSent: folderId,
    authenticatedEmail: creds.client_email,
    projectId: creds.project_id,
  };

  try {
    const res = await drive.files.get({
      fileId: folderId,
      ...queryParams,
    });

    trace.responseStatus = res.status;
    trace.responseBody = res.data;

    return { data: res.data, trace, error: null };
  } catch (err) {
    const formatted = formatGaxiosError(err);
    trace.responseStatus = formatted.status;
    trace.responseBody = formatted.body;
    return { data: null, trace, error: formatted.message };
  }
}

async function createResumableUploadSessionRaw(
  accessToken: string,
  creds: ServiceAccountCreds,
  folderId: string,
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string | null; trace: DriveApiTrace }> {
  const queryParams = {
    uploadType: "resumable",
    supportsAllDrives: "true",
    supportsTeamDrives: "true",
  };

  const requestBody = {
    name: fileName,
    parents: [folderId],
  };

  const url = `https://www.googleapis.com/upload/drive/v3/files?${new URLSearchParams(queryParams).toString()}`;

  const trace: DriveApiTrace = {
    operation: "files.create.resumable",
    method: "POST",
    url,
    queryParams: {
      uploadType: "resumable",
      supportsAllDrives: true,
      supportsTeamDrives: true,
    },
    requestBody,
    responseStatus: null,
    responseBody: null,
    folderIdSent: folderId,
    authenticatedEmail: creds.client_email,
    projectId: creds.project_id,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": mimeType || "video/mp4",
    },
    body: JSON.stringify(requestBody),
  });

  trace.responseStatus = res.status;
  const text = await res.text();
  try {
    trace.responseBody = text ? JSON.parse(text) : { location: res.headers.get("Location") };
  } catch {
    trace.responseBody = text.slice(0, 500);
  }

  if (!res.ok) {
    return { uploadUrl: null, trace };
  }

  return { uploadUrl: res.headers.get("Location"), trace };
}

/** Verify service account can see the target folder and can open an upload session. */
export async function probeDriveFolder(folderId?: string): Promise<DriveFolderProbe> {
  const id = folderId ?? getDriveFolderId();
  const creds = parseServiceAccount();

  if (!id || !creds) {
    return {
      ok: false,
      folderId: id ?? "",
      serviceAccountEmail: creds?.client_email ?? "",
      projectId: creds?.project_id ?? null,
      httpStatus: null,
      folderName: null,
      mimeType: null,
      driveId: null,
      isSharedDrive: false,
      canAddChildren: null,
      error: "Missing folder ID or service account credentials.",
      fixHint: getDriveConfigStatus().reason,
      apiTrace: null,
      uploadSessionTrace: null,
    };
  }

  const { drive, creds: authenticatedCreds, accessToken } = await getAuthenticatedDrive();

  const getResult = await filesGetFolderTrace(drive, authenticatedCreds, id);

  if (!getResult.data) {
    const is404 = getResult.trace.responseStatus === 404;
    const bodyStr = JSON.stringify(getResult.trace.responseBody ?? "");

    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: authenticatedCreds.client_email,
      projectId: authenticatedCreds.project_id,
      httpStatus: getResult.trace.responseStatus,
      folderName: null,
      mimeType: null,
      driveId: null,
      isSharedDrive: false,
      canAddChildren: null,
      error: bodyStr.slice(0, 500),
      fixHint: is404
        ? `files.get returned 404 for folder ${id}. Authenticated as "${authenticatedCreds.client_email}" (project: ${authenticatedCreds.project_id ?? "unknown"}). Share the folder with THAT exact email from GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON — not a different service account.`
        : getResult.error,
      apiTrace: getResult.trace,
      uploadSessionTrace: null,
    };
  }

  const data = getResult.data;
  const isFolder = data.mimeType === "application/vnd.google-apps.folder";
  const canAdd = data.capabilities?.canAddChildren ?? null;

  if (!isFolder) {
    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: authenticatedCreds.client_email,
      projectId: authenticatedCreds.project_id,
      httpStatus: getResult.trace.responseStatus,
      folderName: data.name ?? null,
      mimeType: data.mimeType ?? null,
      driveId: data.driveId ?? null,
      isSharedDrive: !!data.driveId,
      canAddChildren: canAdd,
      error: `ID resolves to "${data.name}" (${data.mimeType}), not a folder.`,
      fixHint: "GOOGLE_DRIVE_FOLDER_ID must be a folder ID, not a file ID.",
      apiTrace: getResult.trace,
      uploadSessionTrace: null,
    };
  }

  const uploadSessionResult = await createResumableUploadSessionRaw(
    accessToken,
    authenticatedCreds,
    id,
    `vzw-upload-probe-${Date.now()}.mp4`,
    "video/mp4"
  );
  const uploadSessionTrace = uploadSessionResult.trace;
  const uploadOk = uploadSessionResult.uploadUrl !== null;

  if (!uploadOk) {
    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: authenticatedCreds.client_email,
      projectId: authenticatedCreds.project_id,
      httpStatus: uploadSessionTrace.responseStatus,
      folderName: data.name ?? null,
      mimeType: data.mimeType ?? null,
      driveId: data.driveId ?? null,
      isSharedDrive: !!data.driveId,
      canAddChildren: canAdd,
      error: JSON.stringify(uploadSessionTrace.responseBody).slice(0, 500),
      fixHint: `Folder metadata OK but resumable upload session failed (HTTP ${uploadSessionTrace.responseStatus}). Check supportsAllDrives and parent folder permissions.`,
      apiTrace: getResult.trace,
      uploadSessionTrace,
    };
  }

  if (canAdd === false) {
    return {
      ok: false,
      folderId: id,
      serviceAccountEmail: authenticatedCreds.client_email,
      projectId: authenticatedCreds.project_id,
      httpStatus: getResult.trace.responseStatus,
      folderName: data.name ?? null,
      mimeType: data.mimeType ?? null,
      driveId: data.driveId ?? null,
      isSharedDrive: !!data.driveId,
      canAddChildren: false,
      error: `Service account can see folder "${data.name}" but cannot add files.`,
      fixHint: `Grant Editor on folder "${data.name}" to "${authenticatedCreds.client_email}".`,
      apiTrace: getResult.trace,
      uploadSessionTrace,
    };
  }

  return {
    ok: true,
    folderId: id,
    serviceAccountEmail: authenticatedCreds.client_email,
    projectId: authenticatedCreds.project_id,
    httpStatus: getResult.trace.responseStatus,
    folderName: data.name ?? null,
    mimeType: data.mimeType ?? null,
    driveId: data.driveId ?? null,
    isSharedDrive: !!data.driveId,
    canAddChildren: canAdd,
    error: null,
    fixHint: null,
    apiTrace: getResult.trace,
    uploadSessionTrace,
  };
}

/** Creates a resumable upload session; client uploads bytes directly to Google. */
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
    const detail = probe.uploadSessionTrace
      ? ` Upload API: ${JSON.stringify(probe.uploadSessionTrace.responseBody)}`
      : probe.apiTrace
        ? ` files.get: ${JSON.stringify(probe.apiTrace.responseBody)}`
        : "";
    throw new Error((probe.fixHint ?? probe.error ?? "Folder not accessible.") + detail);
  }

  const { accessToken, creds } = await getAuthenticatedDrive();

  const session = await createResumableUploadSessionRaw(
    accessToken,
    creds,
    folderId,
    fileName,
    mimeType || "video/mp4"
  );

  if (!session.uploadUrl) {
    throw new Error(
      `Google Drive session failed (HTTP ${session.trace.responseStatus}): ${JSON.stringify(session.trace.responseBody)}`
    );
  }

  return session.uploadUrl;
}

/** Makes the file viewable by anyone with the link and returns the normalized share URL. */
export async function finalizeDriveUpload(fileId: string): Promise<string> {
  const { drive } = await getAuthenticatedDrive();

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    ...SHARED_DRIVE_PARAMS,
  });

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
