/*
 * Client-side mirror of the API's upload rules (ALLOWED_MIME, validate_upload and max_bytes_for in
 * crates/platform/src/storage.rs). Pure functions only, so they are unit tested.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

export const ALLOWED_MIME: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/rtf",
  "application/json",
  "application/zip",
  "application/x-7z-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
];

const BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  markdown: "text/markdown",
  rtf: "application/rtf",
  json: "application/json",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

/** For a file picker: mime types plus extensions (some browsers leave `type` empty). */
export const ACCEPT = [...ALLOWED_MIME, ...Object.keys(BY_EXT).map((e) => `.${e}`)].join(",");

export function isMedia(mime: string): boolean {
  return mime.startsWith("video/") || mime.startsWith("audio/");
}

export function maxBytesFor(mime: string): number {
  return isMedia(mime) ? MAX_MEDIA_BYTES : MAX_FILE_BYTES;
}

/** Strips codec parameters: "video/webm;codecs=vp9,opus" becomes "video/webm". */
export function baseMime(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

/** The mime to send for a file, or "" when it can't be determined. */
export function mimeForFile(file: { name: string; type: string }): string {
  if (file.type) {
    const t = baseMime(file.type);
    return t === "application/x-zip-compressed" ? "application/zip" : t;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXT[ext] ?? "";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** A reason the file can't be attached, or null when it is fine. */
export function checkFile(file: { name: string; type: string; size: number }): string | null {
  const mime = mimeForFile(file);
  if (!ALLOWED_MIME.includes(mime)) {
    return `${file.name} can't be attached. Use an image, PDF, Office file, CSV, text, ZIP, video or audio file.`;
  }
  if (file.size <= 0) return `${file.name} is empty.`;
  const max = maxBytesFor(mime);
  if (file.size > max) {
    return isMedia(mime)
      ? `${file.name} is over 100 MB. Trim or compress it.`
      : `${file.name} is over 25 MB. Compress it or share a link instead.`;
  }
  if (file.name.length > 255 || /[\\/\0]/.test(file.name)) return `Rename ${file.name} to something shorter, without slashes.`;
  return null;
}
