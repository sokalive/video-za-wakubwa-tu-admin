import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeEnv } from "@/lib/env";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface R2UploadSession {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  expiresIn: number;
}

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".mpeg", ".mpg"];

export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export function getR2Config(): R2Config | null {
  const accountId = sanitizeEnv(process.env.R2_ACCOUNT_ID);
  const accessKeyId = sanitizeEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = sanitizeEnv(process.env.R2_SECRET_ACCESS_KEY);
  const bucketName = sanitizeEnv(process.env.R2_BUCKET_NAME);
  const publicUrl = sanitizeEnv(process.env.R2_PUBLIC_URL);

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

export function getR2Status() {
  const config = getR2Config();
  return {
    configured: !!config,
    bucketName: config?.bucketName ?? null,
    publicUrl: config?.publicUrl ?? null,
    reason: config
      ? null
      : "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL on Vercel.",
  };
}

function getS3Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "video.mp4";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "video.mp4";
}

function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/mpeg": ".mpeg",
  };
  return map[mimeType] ?? ".mp4";
}

export function buildObjectKey(fileName: string, mimeType: string): string {
  const safeName = sanitizeFileName(fileName);
  const hasExt = ALLOWED_VIDEO_EXTENSIONS.some((ext) => safeName.toLowerCase().endsWith(ext));
  const finalName = hasExt ? safeName : `${safeName}${extensionFromMime(mimeType)}`;
  return `videos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${finalName}`;
}

export function getPublicObjectUrl(objectKey: string): string {
  const config = getR2Config();
  if (!config) throw new Error("R2 is not configured.");
  return `${config.publicUrl.replace(/\/$/, "")}/${objectKey}`;
}

export function isAllowedVideoFile(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  const extOk = ALLOWED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mimeOk =
    ALLOWED_VIDEO_MIME_TYPES.includes(mimeType as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]) ||
    mimeType.startsWith("video/");
  return extOk || mimeOk;
}

export async function deleteR2Object(objectKey: string): Promise<void> {
  const key = objectKey?.trim();
  if (!key) return;

  const config = getR2Config();
  if (!config) {
    throw new Error(getR2Status().reason ?? "R2 is not configured.");
  }

  const client = getS3Client(config);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
}

export async function createR2UploadSession(
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<R2UploadSession> {
  const config = getR2Config();
  if (!config) {
    throw new Error(getR2Status().reason ?? "R2 is not configured.");
  }

  if (!fileSize || fileSize <= 0) {
    throw new Error("fileSize must be greater than 0.");
  }

  if (fileSize > MAX_VIDEO_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_VIDEO_BYTES / (1024 * 1024 * 1024)} GB.`);
  }

  if (!isAllowedVideoFile(fileName, mimeType)) {
    throw new Error("Unsupported video format. Use MP4, WebM, MOV, AVI, or MKV.");
  }

  const objectKey = buildObjectKey(fileName, mimeType);
  const client = getS3Client(config);
  const expiresIn = 3600;

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    ContentType: mimeType || "video/mp4",
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    publicUrl: getPublicObjectUrl(objectKey),
    objectKey,
    expiresIn,
  };
}
