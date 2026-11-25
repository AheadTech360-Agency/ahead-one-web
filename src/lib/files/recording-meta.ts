/**
 * Details of a file that came from the in-app screen recorder. A recording handed to the chat composer is
 * an ordinary File, so its length and voice flag travel beside it here and are sent with the upload, which
 * lets the API store and list it as a recording.
 */
export type RecordingMeta = { duration_secs: number; has_audio: boolean };

const metaByFile = new WeakMap<File, RecordingMeta>();

export function tagRecording(file: File, meta: RecordingMeta): File {
  metaByFile.set(file, meta);
  return file;
}

export function recordingMetaOf(file: File): RecordingMeta | undefined {
  return metaByFile.get(file);
}
