/**
 * Google Drive URL utilities for video playback.
 * Videos are stored on Google Drive; only links are saved in the database.
 */

export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function normalizeGoogleDriveUrl(url: string): string | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function getGoogleDriveEmbedUrl(url: string): string | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function isValidGoogleDriveUrl(url: string): boolean {
  return extractGoogleDriveFileId(url) !== null;
}
