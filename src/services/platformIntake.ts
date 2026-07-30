type PlatformFileListener = (files: File[]) => void;

const listeners = new Set<PlatformFileListener>();
let queuedFiles: File[] = [];

export function queuePlatformFiles(files: File[]): void {
  const validFiles = files.filter((file) => file instanceof File);
  if (validFiles.length === 0) {
    return;
  }

  queuedFiles = [...queuedFiles, ...validFiles];
  listeners.forEach((listener) => listener(validFiles));
}

export function consumePlatformFiles(): File[] {
  const files = queuedFiles;
  queuedFiles = [];
  return files;
}

export function hasQueuedPlatformFiles(): boolean {
  return queuedFiles.length > 0;
}

export function subscribePlatformFiles(listener: PlatformFileListener): () => void {
  listeners.add(listener);

  if (queuedFiles.length > 0) {
    listener(queuedFiles);
  }

  return () => {
    listeners.delete(listener);
  };
}