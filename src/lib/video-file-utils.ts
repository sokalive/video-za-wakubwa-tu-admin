const DUPLICATE_MESSAGE = "Video already exists.";

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function extractVideoThumbnail(
  file: File,
  seekSeconds = 1
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Failed to read video for thumbnail"));
      video.src = objectUrl;
    });

    const duration = Number.isFinite(video.duration) ? video.duration : seekSeconds;
    video.currentTime = Math.min(Math.max(seekSeconds, 0.1), Math.max(duration * 0.1, 0.1));

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas not supported");

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });

    if (!blob) throw new Error("Failed to generate thumbnail");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
    return new File([blob], `${baseName}-thumb.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function resolveUploadThumbnail(
  videoFile: File,
  customThumbnail?: File | null
): Promise<File> {
  if (customThumbnail) return customThumbnail;
  return extractVideoThumbnail(videoFile);
}

export { DUPLICATE_MESSAGE };
