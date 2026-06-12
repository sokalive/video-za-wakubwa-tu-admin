import { google, type drive_v3 } from "googleapis";
import type { GaxiosError } from "gaxios";
import { normalizeGoogleDriveUrl } from "@/lib/google-drive";
import { sanitizeEnv } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const SHARED_DRIVE_PARAMS = {
  supportsAllDrives: true,
  supportsTeamDrives: true,
} as const;

const FOLDER_METADATA_FIELDS =
  "id,name,mimeType,driveId,capabilities,owners,parents,shared,ownedByMe,shortcutDetails,teamDriveId,resourceKey";

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

export interface DriveFolderMetadata {
  id: string;
  name: string | null;
  mimeType: string | null;
  driveId: string | null;
  teamDriveId: string | null;
  storageType: "shared_drive" | "my_drive" | "shortcut" | "unknown";
  ownedByMe: boolean | null;
  shared: boolean | null;
  owners: drive_v3.Schema$User[] | null;
  capabilities: drive_v3.Schema$File["capabilities"] | null;
  permissions: drive_v3.Schema$Permission[] | null;
  shortcutDetails: drive_v3.Schema$File["shortcutDetails"] | null;
  parents: string[] | null;
  resolvedParentId: string;
  wasShortcut: boolean;
  originalFolderId: string;
  lookupMethod: "files.get" | "files.list.sharedWithMe" | "shortcut.target";
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

export interface DriveDiagnostics {
  config: DriveConfigStatus;
  auth: {
    emailAddress: string | null;
    displayName: string | null;
    permissionId: string | null;
    tokenObtained: boolean;
    impersonating: string | null;
  };
  folderMetadata: DriveFolderMetadata | null;
  folderLookupTrace: DriveApiTrace | null;
  permissionsTrace: DriveApiTrace | null;
  accessibleSharedFolders: Array<{
    id: string;
    name: string | null;
    mimeType: string | null;
    driveId: string | null;
    shortcutDetails: drive_v3.Schema$File["shortcutDetails"] | null;
    matchesConfiguredId: boolean;
  }>;
  accessibleSharedDrives: Array<{ id: string | null; name: string | null }>;
  uploadSessionTrace: DriveApiTrace | null;
  uploadReady: boolean;
  fixHint: string | null;
  error: string | null;
}

export interface DriveFolderProbe {
  ok: boolean;
  folderId: string;
  resolvedParentId: string;
  serviceAccountEmail: string;
  projectId: string | null;
  httpStatus: number | null;
  folderName: string | null;
  mimeType: string | null;
  driveId: string | null;
  storageType: DriveFolderMetadata["storageType"];
  isSharedDrive: boolean;
  canAddChildren: boolean | null;
  wasShortcut: boolean;
  error: string | null;
  fixHint: string | null;
  apiTrace: DriveApiTrace | null;
  uploadSessionTrace: DriveApiTrace | null;
  metadata: DriveFolderMetadata | null;
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
    return parseJsonServiceAccount(Buffer.from(raw.trim(), "base64").toString("utf8"));
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
  return (
    extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID ?? "") ??
    extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_URL ?? "")
  );
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
    reason = "Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON on Vercel.";
  } else if (!jsonParseOk) {
    reason = "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is invalid JSON.";
  } else if (!folderIdSet) {
    reason = "GOOGLE_DRIVE_FOLDER_ID is missing or could not be parsed.";
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

function getImpersonateEmail(): string | undefined {
  const email = sanitizeEnv(process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL);
  return email || undefined;
}

async function getAuthenticatedDrive(): Promise<{
  drive: drive_v3.Drive;
  creds: ServiceAccountCreds;
  accessToken: string;
  impersonating: string | null;
}> {
  const creds = parseServiceAccount();
  if (!creds) {
    throw new Error(getDriveConfigStatus().reason ?? "Google Drive credentials not configured.");
  }

  const impersonate = getImpersonateEmail();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [DRIVE_SCOPE],
    projectId: creds.project_id ?? undefined,
    subject: impersonate,
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
    impersonating: impersonate ?? null,
  };
}

export function getServiceAccountEmail(): string | null {
  return parseServiceAccount()?.client_email ?? getDriveConfigStatus().clientEmail;
}

function inferStorageType(file: drive_v3.Schema$File): DriveFolderMetadata["storageType"] {
  if (file.mimeType === "application/vnd.google-apps.shortcut") return "shortcut";
  if (file.driveId || file.teamDriveId) return "shared_drive";
  if (file.ownedByMe === true) return "my_drive";
  if (file.shared === true) return "my_drive";
  return "unknown";
}

function mapFileToMetadata(
  file: drive_v3.Schema$File,
  originalFolderId: string,
  resolvedParentId: string,
  lookupMethod: DriveFolderMetadata["lookupMethod"],
  wasShortcut: boolean,
  permissions: drive_v3.Schema$Permission[] | null
): DriveFolderMetadata {
  return {
    id: file.id ?? originalFolderId,
    name: file.name ?? null,
    mimeType: file.mimeType ?? null,
    driveId: file.driveId ?? file.teamDriveId ?? null,
    teamDriveId: file.teamDriveId ?? null,
    storageType: inferStorageType(file),
    ownedByMe: file.ownedByMe ?? null,
    shared: file.shared ?? null,
    owners: file.owners ?? null,
    capabilities: file.capabilities ?? null,
    permissions,
    shortcutDetails: file.shortcutDetails ?? null,
    parents: file.parents ?? null,
    resolvedParentId,
    wasShortcut,
    originalFolderId,
    lookupMethod,
  };
}

async function filesGetWithTrace(
  drive: drive_v3.Drive,
  creds: ServiceAccountCreds,
  fileId: string
): Promise<{ data: drive_v3.Schema$File | null; trace: DriveApiTrace }> {
  const queryParams = { ...SHARED_DRIVE_PARAMS, fields: FOLDER_METADATA_FIELDS };
  const trace: DriveApiTrace = {
    operation: "files.get",
    method: "GET",
    url: `https://www.googleapis.com/drive/v3/files/${fileId}`,
    queryParams,
    responseStatus: null,
    responseBody: null,
    folderIdSent: fileId,
    authenticatedEmail: creds.client_email,
    projectId: creds.project_id,
  };

  try {
    const res = await drive.files.get({ fileId, ...queryParams });
    trace.responseStatus = res.status;
    trace.responseBody = res.data;
    return { data: res.data, trace };
  } catch (err) {
    const formatted = formatGaxiosError(err);
    trace.responseStatus = formatted.status;
    trace.responseBody = formatted.body;
    return { data: null, trace };
  }
}

async function listPermissionsWithTrace(
  drive: drive_v3.Drive,
  creds: ServiceAccountCreds,
  fileId: string
): Promise<{ permissions: drive_v3.Schema$Permission[] | null; trace: DriveApiTrace }> {
  const queryParams = {
    ...SHARED_DRIVE_PARAMS,
    fields: "permissions(id,type,emailAddress,role,displayName,domain,deleted)",
  };
  const trace: DriveApiTrace = {
    operation: "permissions.list",
    method: "GET",
    url: `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    queryParams,
    responseStatus: null,
    responseBody: null,
    folderIdSent: fileId,
    authenticatedEmail: creds.client_email,
    projectId: creds.project_id,
  };

  try {
    const res = await drive.permissions.list({ fileId, ...queryParams });
    trace.responseStatus = res.status;
    trace.responseBody = res.data;
    return { permissions: res.data.permissions ?? [], trace };
  } catch (err) {
    const formatted = formatGaxiosError(err);
    trace.responseStatus = formatted.status;
    trace.responseBody = formatted.body;
    return { permissions: null, trace };
  }
}

async function listAccessibleSharedFolders(
  drive: drive_v3.Drive,
  configuredFolderId: string | null
): Promise<DriveDiagnostics["accessibleSharedFolders"]> {
  const results: DriveDiagnostics["accessibleSharedFolders"] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: "sharedWithMe and trashed=false and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut')",
      fields: "nextPageToken,files(id,name,mimeType,driveId,shortcutDetails)",
      pageSize: 100,
      pageToken,
      ...SHARED_DRIVE_PARAMS,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });

    for (const file of res.data.files ?? []) {
      results.push({
        id: file.id ?? "",
        name: file.name ?? null,
        mimeType: file.mimeType ?? null,
        driveId: file.driveId ?? null,
        shortcutDetails: file.shortcutDetails ?? null,
        matchesConfiguredId: !!configuredFolderId && file.id === configuredFolderId,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && results.length < 200);

  return results;
}

async function listAccessibleSharedDrives(
  drive: drive_v3.Drive
): Promise<DriveDiagnostics["accessibleSharedDrives"]> {
  try {
    const res = await drive.drives.list({ pageSize: 20 });
    return (res.data.drives ?? []).map((d) => ({ id: d.id ?? null, name: d.name ?? null }));
  } catch {
    return [];
  }
}

/** Resolve configured folder ID to a real upload parent (handles shortcuts + list fallback). */
async function resolveUploadFolder(
  drive: drive_v3.Drive,
  creds: ServiceAccountCreds,
  folderId: string
): Promise<{
  metadata: DriveFolderMetadata | null;
  lookupTrace: DriveApiTrace;
  permissionsTrace: DriveApiTrace | null;
  accessibleSharedFolders: DriveDiagnostics["accessibleSharedFolders"];
  fixHint: string | null;
}> {
  const accessibleSharedFolders = await listAccessibleSharedFolders(drive, folderId);

  let { data, trace: lookupTrace } = await filesGetWithTrace(drive, creds, folderId);

  if (!data) {
    const fromList = accessibleSharedFolders.find((f) => f.id === folderId);
    if (fromList) {
      const retry = await filesGetWithTrace(drive, creds, folderId);
      data = retry.data;
      lookupTrace = retry.trace;
    }
  }

  if (!data) {
    const configuredVisible = accessibleSharedFolders.some((f) => f.matchesConfiguredId);
    const hint = configuredVisible
      ? "Folder appears in sharedWithMe list but files.get still fails. Try GOOGLE_DRIVE_IMPERSONATE_EMAIL with the folder owner's Workspace email, or move folder to a Shared Drive."
      : accessibleSharedFolders.length === 0
        ? `Service account "${creds.client_email}" cannot see ANY shared folders. Re-share the folder with that exact email as Editor (not a group). For Shared Drives, add the SA as Content manager on the drive.`
        : `Folder ID ${folderId} is NOT in the service account's accessible folders list. You may have shared a different account, or the ID is from a URL shortcut. Accessible folder IDs: ${accessibleSharedFolders.map((f) => f.id).join(", ")}`;

    return {
      metadata: null,
      lookupTrace,
      permissionsTrace: null,
      accessibleSharedFolders,
      fixHint: hint,
    };
  }

  let wasShortcut = false;
  let resolvedParentId = folderId;
  let lookupMethod: DriveFolderMetadata["lookupMethod"] = "files.get";
  let workingFile = data;

  if (data.mimeType === "application/vnd.google-apps.shortcut") {
    wasShortcut = true;
    const targetId = data.shortcutDetails?.targetId;
    const targetMime = data.shortcutDetails?.targetMimeType;
    if (!targetId) {
      return {
        metadata: null,
        lookupTrace,
        permissionsTrace: null,
        accessibleSharedFolders,
        fixHint: "Configured ID is a shortcut without a target. Use the real folder ID from shortcutDetails.targetId.",
      };
    }
    if (targetMime !== "application/vnd.google-apps.folder") {
      return {
        metadata: null,
        lookupTrace,
        permissionsTrace: null,
        accessibleSharedFolders,
        fixHint: `Shortcut points to ${targetMime}, not a folder. Use a folder ID.`,
      };
    }
    const targetGet = await filesGetWithTrace(drive, creds, targetId);
    lookupTrace = targetGet.trace;
    if (!targetGet.data) {
      return {
        metadata: null,
        lookupTrace,
        permissionsTrace: null,
        accessibleSharedFolders,
        fixHint: `Shortcut target folder ${targetId} not accessible. Share the target folder with ${creds.client_email}.`,
      };
    }
    workingFile = targetGet.data;
    resolvedParentId = targetId;
    lookupMethod = "shortcut.target";
  } else if (data.mimeType !== "application/vnd.google-apps.folder") {
    return {
      metadata: null,
      lookupTrace,
      permissionsTrace: null,
      accessibleSharedFolders,
      fixHint: `ID is "${data.name}" (${data.mimeType}), not a folder. Use a folder ID from the folder URL.`,
    };
  }

  const { permissions, trace: permissionsTrace } = await listPermissionsWithTrace(
    drive,
    creds,
    resolvedParentId
  );

  const metadata = mapFileToMetadata(
    workingFile,
    folderId,
    resolvedParentId,
    lookupMethod,
    wasShortcut,
    permissions
  );

  if (metadata.capabilities?.canAddChildren === false) {
    return {
      metadata,
      lookupTrace,
      permissionsTrace,
      accessibleSharedFolders,
      fixHint: `Folder "${metadata.name}" visible but canAddChildren=false. Grant Editor to ${creds.client_email}.`,
    };
  }

  return { metadata, lookupTrace, permissionsTrace, accessibleSharedFolders, fixHint: null };
}

export interface ResumableSessionOptions {
  /** Browser origin (e.g. https://admin.example.com). Required for client-side PUT uploads — Google binds CORS to this origin. */
  browserOrigin?: string | null;
  fileSize?: number;
}

/** Resolve the admin panel origin for Google resumable-upload CORS binding. */
export function resolveBrowserUploadOrigin(
  request: Request,
  bodyOrigin?: string | null
): string {
  const fromBody = sanitizeEnv(bodyOrigin ?? "");
  if (fromBody) {
    try {
      return new URL(fromBody).origin;
    } catch {
      return fromBody;
    }
  }

  const fromHeader = sanitizeEnv(request.headers.get("origin") ?? "");
  if (fromHeader) return fromHeader;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore invalid referer
    }
  }

  const appUrl = sanitizeEnv(process.env.NEXT_PUBLIC_APP_URL);
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      return appUrl;
    }
  }

  const vercel = sanitizeEnv(process.env.VERCEL_URL);
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  return "";
}

async function createResumableUploadSessionRaw(
  accessToken: string,
  creds: ServiceAccountCreds,
  metadata: DriveFolderMetadata,
  fileName: string,
  mimeType: string,
  options: ResumableSessionOptions = {}
): Promise<{ uploadUrl: string | null; trace: DriveApiTrace }> {
  const queryParams: Record<string, string> = {
    uploadType: "resumable",
    supportsAllDrives: "true",
    supportsTeamDrives: "true",
  };

  // Required when uploading into a Shared Drive folder
  if (metadata.driveId) {
    queryParams.driveId = metadata.driveId;
  }

  const requestBody = {
    name: fileName,
    parents: [metadata.resolvedParentId],
  };

  const url = `https://www.googleapis.com/upload/drive/v3/files?${new URLSearchParams(queryParams).toString()}`;

  const browserOrigin = sanitizeEnv(options.browserOrigin ?? "");

  const trace: DriveApiTrace = {
    operation: "files.create.resumable",
    method: "POST",
    url,
    queryParams: {
      uploadType: "resumable",
      supportsAllDrives: true,
      supportsTeamDrives: true,
      driveId: metadata.driveId ?? undefined,
      browserOrigin: browserOrigin || undefined,
    },
    requestBody,
    responseStatus: null,
    responseBody: null,
    folderIdSent: metadata.resolvedParentId,
    authenticatedEmail: creds.client_email,
    projectId: creds.project_id,
  };

  const initHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Upload-Content-Type": mimeType || "video/mp4",
  };

  if (options.fileSize && options.fileSize > 0) {
    initHeaders["X-Upload-Content-Length"] = String(options.fileSize);
  }

  // Google binds CORS on the resumable session to the Origin of this init request.
  // Server-side diagnostics omit this; browser uploads must pass the panel origin.
  if (browserOrigin) {
    initHeaders.Origin = browserOrigin;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: initHeaders,
    body: JSON.stringify(requestBody),
  });

  trace.responseStatus = res.status;
  const text = await res.text();
  try {
    trace.responseBody = text ? JSON.parse(text) : { location: res.headers.get("Location") };
  } catch {
    trace.responseBody = text.slice(0, 800);
  }

  if (!res.ok) {
    return { uploadUrl: null, trace };
  }

  return { uploadUrl: res.headers.get("Location"), trace };
}

export async function runDriveDiagnostics(): Promise<DriveDiagnostics> {
  const config = getDriveConfigStatus();
  if (!config.configured || !config.folderId) {
    return {
      config,
      auth: { emailAddress: null, displayName: null, permissionId: null, tokenObtained: false, impersonating: null },
      folderMetadata: null,
      folderLookupTrace: null,
      permissionsTrace: null,
      accessibleSharedFolders: [],
      accessibleSharedDrives: [],
      uploadSessionTrace: null,
      uploadReady: false,
      fixHint: config.reason,
      error: config.reason,
    };
  }

  const { drive, creds, accessToken, impersonating } = await getAuthenticatedDrive();

  let about: { user?: drive_v3.Schema$User | null } | null = null;
  try {
    const aboutRes = await drive.about.get({ fields: "user" });
    about = aboutRes.data;
  } catch {
    about = null;
  }

  const resolved = await resolveUploadFolder(drive, creds, config.folderId);
  const accessibleSharedDrives = await listAccessibleSharedDrives(drive);

  if (!resolved.metadata) {
    return {
      config,
      auth: {
        emailAddress: about?.user?.emailAddress ?? creds.client_email,
        displayName: about?.user?.displayName ?? null,
        permissionId: null,
        tokenObtained: true,
        impersonating,
      },
      folderMetadata: null,
      folderLookupTrace: resolved.lookupTrace,
      permissionsTrace: resolved.permissionsTrace,
      accessibleSharedFolders: resolved.accessibleSharedFolders,
      accessibleSharedDrives,
      uploadSessionTrace: null,
      uploadReady: false,
      fixHint: resolved.fixHint,
      error: JSON.stringify(resolved.lookupTrace.responseBody),
    };
  }

  const uploadSession = await createResumableUploadSessionRaw(
    accessToken,
    creds,
    resolved.metadata,
    `vzw-probe-${Date.now()}.mp4`,
    "video/mp4"
  );

  const uploadReady = uploadSession.uploadUrl !== null;
  let fixHint = resolved.fixHint;
  if (!uploadReady) {
    fixHint =
      resolved.metadata.storageType === "my_drive"
        ? `Upload to My Drive shared folder failed (HTTP ${uploadSession.trace.responseStatus}). Personal Gmail folders often block service-account uploads. Move videos folder to a Shared Drive, add ${creds.client_email} as Content manager, update GOOGLE_DRIVE_FOLDER_ID, redeploy. Or set GOOGLE_DRIVE_IMPERSONATE_EMAIL to the folder owner's Workspace email.`
        : `Resumable upload failed (HTTP ${uploadSession.trace.responseStatus}): ${JSON.stringify(uploadSession.trace.responseBody)}`;
  }

  return {
    config,
    auth: {
      emailAddress: about?.user?.emailAddress ?? creds.client_email,
      displayName: about?.user?.displayName ?? null,
      permissionId: null,
      tokenObtained: true,
      impersonating,
    },
    folderMetadata: resolved.metadata,
    folderLookupTrace: resolved.lookupTrace,
    permissionsTrace: resolved.permissionsTrace,
    accessibleSharedFolders: resolved.accessibleSharedFolders,
    accessibleSharedDrives,
    uploadSessionTrace: uploadSession.trace,
    uploadReady,
    fixHint: uploadReady ? null : fixHint,
    error: uploadReady ? null : JSON.stringify(uploadSession.trace.responseBody),
  };
}

export async function probeDriveFolder(folderId?: string): Promise<DriveFolderProbe> {
  const id = folderId ?? getDriveFolderId();
  const creds = parseServiceAccount();

  if (!id || !creds) {
    return {
      ok: false,
      folderId: id ?? "",
      resolvedParentId: id ?? "",
      serviceAccountEmail: creds?.client_email ?? "",
      projectId: creds?.project_id ?? null,
      httpStatus: null,
      folderName: null,
      mimeType: null,
      driveId: null,
      storageType: "unknown",
      isSharedDrive: false,
      canAddChildren: null,
      wasShortcut: false,
      error: "Missing folder ID or credentials.",
      fixHint: getDriveConfigStatus().reason,
      apiTrace: null,
      uploadSessionTrace: null,
      metadata: null,
    };
  }

  const diagnostics = await runDriveDiagnostics();
  const meta = diagnostics.folderMetadata;

  return {
    ok: diagnostics.uploadReady,
    folderId: id,
    resolvedParentId: meta?.resolvedParentId ?? id,
    serviceAccountEmail: diagnostics.auth.emailAddress ?? creds.client_email,
    projectId: creds.project_id,
    httpStatus: diagnostics.folderLookupTrace?.responseStatus ?? null,
    folderName: meta?.name ?? null,
    mimeType: meta?.mimeType ?? null,
    driveId: meta?.driveId ?? null,
    storageType: meta?.storageType ?? "unknown",
    isSharedDrive: meta?.storageType === "shared_drive",
    canAddChildren: meta?.capabilities?.canAddChildren ?? null,
    wasShortcut: meta?.wasShortcut ?? false,
    error: diagnostics.error,
    fixHint: diagnostics.fixHint,
    apiTrace: diagnostics.folderLookupTrace,
    uploadSessionTrace: diagnostics.uploadSessionTrace,
    metadata: meta,
  };
}

export async function createResumableUploadSession(
  fileName: string,
  mimeType: string,
  options: ResumableSessionOptions = {}
): Promise<string> {
  const folderId = getDriveFolderId();
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured.");

  const { drive, creds, accessToken } = await getAuthenticatedDrive();
  const resolved = await resolveUploadFolder(drive, creds, folderId);

  if (!resolved.metadata) {
    throw new Error(resolved.fixHint ?? "Folder not accessible.");
  }

  const session = await createResumableUploadSessionRaw(
    accessToken,
    creds,
    resolved.metadata,
    fileName,
    mimeType || "video/mp4",
    options
  );

  if (!session.uploadUrl) {
    throw new Error(
      `Google Drive session failed (HTTP ${session.trace.responseStatus}): ${JSON.stringify(session.trace.responseBody)}`
    );
  }

  return session.uploadUrl;
}

export async function finalizeDriveUpload(fileId: string): Promise<string> {
  const { drive } = await getAuthenticatedDrive();
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    ...SHARED_DRIVE_PARAMS,
  });
  const normalized = normalizeGoogleDriveUrl(`https://drive.google.com/file/d/${fileId}/view`);
  if (!normalized) throw new Error("Failed to build shareable Google Drive URL.");
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
