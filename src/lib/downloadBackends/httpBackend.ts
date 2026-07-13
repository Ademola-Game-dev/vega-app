import * as RNFS from '@dr.pogodin/react-native-fs';
import {cleanupDownloadStaging} from '../downloadDestination';
import useDownloadsStore from '../zustand/downloadsStore';
import type {DownloadBackend, DownloadBackendContext} from './types';

const activeJobs = new Map<string, number>();
const cancelledDownloads = new Set<string>();

export const httpDownloadBackend: DownloadBackend = {
  async start({record, destination}: DownloadBackendContext): Promise<void> {
    cancelledDownloads.delete(record.id);
    let previousBytes = 0;
    let previousTime = Date.now();

    const request = RNFS.downloadFile({
      fromUrl: record.url,
      progressInterval: 1000,
      backgroundTimeout: 1000 * 60 * 60,
      progressDivider: 1,
      headers: record.headers || {},
      toFile: destination.stagingPath,
      background: true,
      begin: () => {
        if (cancelledDownloads.has(record.id)) {
          RNFS.stopDownload(request.jobId);
          return;
        }
        activeJobs.set(record.id, request.jobId);
        useDownloadsStore.getState().updateDownload(record.id, {
          backendJobId: request.jobId,
          status: 'downloading',
        });
      },
      progress: progress => {
        if (
          cancelledDownloads.has(record.id) ||
          activeJobs.get(record.id) !== request.jobId
        ) {
          return;
        }
        const currentTime = Date.now();
        const elapsedSeconds = Math.max((currentTime - previousTime) / 1000, 1);
        const speed = Math.max(
          (progress.bytesWritten - previousBytes) / elapsedSeconds,
          0,
        );
        previousBytes = progress.bytesWritten;
        previousTime = currentTime;
        useDownloadsStore
          .getState()
          .updateProgress(
            record.id,
            progress.bytesWritten,
            progress.contentLength,
            speed,
          );
      },
    });

    if (cancelledDownloads.has(record.id)) {
      RNFS.stopDownload(request.jobId);
    } else {
      activeJobs.set(record.id, request.jobId);
      useDownloadsStore.getState().updateDownload(record.id, {
        backendJobId: request.jobId,
        status: 'downloading',
      });
    }

    try {
      await request.promise;
    } finally {
      activeJobs.delete(record.id);
      cancelledDownloads.delete(record.id);
    }
  },

  async cancel(downloadId: string): Promise<void> {
    cancelledDownloads.add(downloadId);
    const jobId = activeJobs.get(downloadId);
    if (jobId != null) {
      RNFS.stopDownload(jobId);
      activeJobs.delete(downloadId);
    }
  },

  async cleanup(downloadId: string): Promise<void> {
    activeJobs.delete(downloadId);
    cancelledDownloads.delete(downloadId);
    await cleanupDownloadStaging(downloadId);
  },
};
