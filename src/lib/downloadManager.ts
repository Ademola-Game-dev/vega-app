import {
  cleanupDownloadStaging,
  finalizeDownloadOutput,
  prepareDownloadDestination,
} from './downloadDestination';
import {
  DownloadLocationConfig,
  ensureDownloadLocationAccess,
  isSafDownloadLocation,
} from './downloadLocation';
import {notificationService} from './services/Notification';
import useDownloadsStore, {DownloadItem} from './zustand/downloadsStore';
import {getDownloadBackend} from './downloadBackends/registry';
import {settingsStorage} from './storage';
import {
  createDownloadDirectoryName,
  createDownloadSeasonDirectoryName,
} from './downloadId';

const activeDownloads = new Set<string>();
const cancelledDownloads = new Set<string>();
const lastNotificationAt = new Map<string, number>();

const showProgressNotification = async (
  record: DownloadItem,
): Promise<void> => {
  const now = Date.now();
  const previous = lastNotificationAt.get(record.id) || 0;
  if (now - previous < 1000) {
    return;
  }
  lastNotificationAt.set(record.id, now);
  const progress = record.totalBytes
    ? record.downloadedBytes / record.totalBytes
    : 0;
  const downloadedMB = Math.round(record.downloadedBytes / 1024 / 1024);
  const totalMB = Math.round(record.totalBytes / 1024 / 1024);
  await notificationService.showDownloadProgress(
    record.title,
    record.id,
    progress,
    record.totalBytes ? `${downloadedMB} / ${totalMB} MB` : 'Downloading',
    record.sourceType,
  );
};

const getRecord = (downloadId: string): DownloadItem => {
  const record = useDownloadsStore.getState().getDownload(downloadId);
  if (!record) {
    throw new Error(`Download ${downloadId} is not registered`);
  }
  return record;
};

const getOutputName = (record: DownloadItem): string =>
  record.displayFileName?.replace(/\.[^.]+$/, '') || record.title;

export const startDownload = async (
  downloadId: string,
  location: DownloadLocationConfig,
): Promise<void> => {
  if (activeDownloads.has(downloadId)) {
    return;
  }

  const record = getRecord(downloadId);
  const backend = getDownloadBackend(record.sourceType);
  const store = useDownloadsStore.getState();
  await notificationService.ensureDownloadPermission().catch(() => false);
  activeDownloads.add(downloadId);
  cancelledDownloads.delete(downloadId);
  notificationService.startForegroundTask(downloadId);
  let unsubscribe = () => undefined;

  try {
    store.markStarting(downloadId);
    await notificationService.showDownloadStarting(
      record.title,
      downloadId,
      record.sourceType,
    );
    unsubscribe = useDownloadsStore.subscribe(state => {
      const updatedRecord = state.downloads[downloadId];
      if (updatedRecord?.status === 'downloading') {
        showProgressNotification(updatedRecord).catch(() => undefined);
      }
    });
    const destination = await prepareDownloadDestination({
      downloadId,
      location,
      fileName: getOutputName(record),
      fileType: record.videoType || 'mp4',
    });
    store.updateDownload(downloadId, {
      stagingPath: destination.stagingPath,
      downloadLocation: location,
    });
    await backend.start({record, destination});

    if (cancelledDownloads.has(downloadId)) {
      throw new Error('Download cancelled');
    }

    store.markFinalizing(downloadId);
    const output = await finalizeDownloadOutput({
      downloadId,
      location,
      stagingPath: destination.stagingPath,
      fileName: getOutputName(record),
      fileType: record.videoType || 'mp4',
      outputDirectoryNames: [
        createDownloadDirectoryName(record.showName || record.title),
        ...(record.type === 'series'
          ? [createDownloadSeasonDirectoryName(record.seasonTitle)].filter(
              (name): name is string => Boolean(name),
            )
          : []),
      ],
    });
    store.markCompleted(downloadId, {
      filePath: output.filePath,
      finalDocumentUri: output.finalDocumentUri,
      totalBytes: output.size,
    });
    await notificationService.showDownloadComplete(
      record.title,
      downloadId,
      record.sourceType,
    );
  } catch (error) {
    const cancelled = cancelledDownloads.has(downloadId);
    await backend.cleanup(downloadId).catch(() => undefined);
    if (cancelled) {
      store.removeDownload(downloadId);
      await notificationService.cancelNotification(downloadId);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    store.markError(downloadId, {message, retryable: true});
    await notificationService.showDownloadFailed(
      record.title,
      downloadId,
      record.sourceType,
    );
    throw error;
  } finally {
    unsubscribe();
    activeDownloads.delete(downloadId);
    cancelledDownloads.delete(downloadId);
    lastNotificationAt.delete(downloadId);
    await notificationService
      .stopForegroundTask(downloadId)
      .catch(() => undefined);
  }
};

export const cancelDownload = async (downloadId: string): Promise<void> => {
  const record = useDownloadsStore.getState().getDownload(downloadId);
  if (!record) {
    return;
  }

  cancelledDownloads.add(downloadId);
  useDownloadsStore.getState().markCanceling(downloadId);
  const backend = getDownloadBackend(record.sourceType);
  try {
    await backend.cancel(downloadId);
  } finally {
    if (!activeDownloads.has(downloadId)) {
      await cleanupDownloadStaging(downloadId).catch(() => undefined);
      useDownloadsStore.getState().removeDownload(downloadId);
      cancelledDownloads.delete(downloadId);
    }
    await notificationService.cancelNotification(downloadId);
  }
};

export const retryDownload = async (downloadId: string): Promise<void> => {
  const record = useDownloadsStore.getState().getDownload(downloadId);
  if (!record || !record.retryable) {
    return;
  }
  const location = await ensureDownloadLocationAccess(
    record.downloadLocation || settingsStorage.getDownloadLocationConfig(),
  );
  if (!location || !isSafDownloadLocation(location)) {
    return;
  }
  settingsStorage.setDownloadLocation(location);
  useDownloadsStore.getState().updateDownload(downloadId, {
    downloadLocation: location,
    errorCode: undefined,
    errorMessage: undefined,
    retryable: undefined,
    status: 'queued',
  });
  await startDownload(downloadId, location);
};

export const isDownloadActive = (downloadId: string): boolean =>
  activeDownloads.has(downloadId);
