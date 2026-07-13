import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockFiles = new Map<string, number>();
const mockDirectories = new Set<string>();
const mockSafFiles = new Map<string, number>();
const mockSafDirectories = new Set<string>();

const getSafChildren = (parent: string) =>
  [
    ...[...mockSafDirectories].filter(uri => uri.startsWith(`${parent}/`)),
    ...[...mockSafFiles.keys()].filter(uri => uri.startsWith(`${parent}/`)),
  ].filter(uri => !uri.slice(parent.length + 1).includes('/'));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: async (path: string) =>
    mockFiles.has(path) || mockDirectories.has(path),
  stat: async (path: string) => ({size: mockFiles.get(path) || 0}),
  unlink: async (path: string) => {
    mockFiles.delete(path);
    mockDirectories.delete(path);
  },
  readDir: async (path: string) =>
    [...mockDirectories]
      .filter(directory => directory.startsWith(`${path}/`))
      .map(directory => ({path: directory, isDirectory: () => true})),
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: async (uri: string) => ({
    exists: mockSafFiles.has(uri),
    size: mockSafFiles.get(uri),
  }),
  StorageAccessFramework: {
    readDirectoryAsync: async (directory: string) => getSafChildren(directory),
    makeDirectoryAsync: async (parent: string, name: string) => {
      const uri = `${parent}/${name}`;
      mockSafDirectories.add(uri);
      return uri;
    },
    deleteAsync: async (uri: string) => {
      mockSafFiles.delete(uri);
      mockSafDirectories.delete(uri);
    },
    createFileAsync: async (directory: string, name: string) => {
      const uri = `${directory}/${name}`;
      mockSafFiles.set(uri, 0);
      return uri;
    },
  },
}));

jest.mock('react-native', () => ({
  NativeModules: {
    SafCopyModule: {
      copyFileToUri: async (from: string, uri: string) =>
        mockSafFiles.set(uri, mockFiles.get(from) || 0),
      getUriSize: async (uri: string) => mockSafFiles.get(uri) || 0,
    },
  },
}));

jest.mock('../src/lib/services/Notification', () => ({
  notificationService: {
    cancelNotification: jest.fn(async () => undefined),
    resetDownloadForegroundState: jest.fn(async () => undefined),
  },
}));

jest.mock('react-native-mmkv-storage', () => ({
  MMKVLoader: class {
    withInstanceID() {
      return this;
    }
    initialize() {
      return {
        getString: () => undefined,
        setString: () => undefined,
        getBool: () => undefined,
        setBool: () => undefined,
        getInt: () => undefined,
        setInt: () => undefined,
        removeItem: () => undefined,
        clearStore: () => undefined,
      };
    }
  },
}));

import {reconcileDownloadState} from '../src/lib/downloadReconciliation';
import {notificationService} from '../src/lib/services/Notification';
import useDownloadsStore from '../src/lib/zustand/downloadsStore';

const mockCancelNotification =
  notificationService.cancelNotification as jest.Mock;
const mockResetForeground =
  notificationService.resetDownloadForegroundState as jest.Mock;

const location = {
  type: 'saf' as const,
  uri: 'content://downloads/tree',
  label: 'Downloads',
};

describe('download startup reconciliation', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockSafFiles.clear();
    mockSafDirectories.clear();
    mockCancelNotification.mockClear();
    mockResetForeground.mockClear();
    useDownloadsStore.setState({downloads: {}});
  });

  it('marks persisted active work as interrupted without resuming it', async () => {
    useDownloadsStore.getState().enqueueDownload({
      id: 'movie_direct_0',
      title: 'Movie',
      type: 'movie',
      url: 'https://example.com/movie.mp4',
      status: 'downloading',
      stagingPath: '/cache/downloads/movie/movie.mp4.part',
    });
    mockFiles.set('/cache/downloads/movie/movie.mp4.part', 100);

    await reconcileDownloadState();

    expect(useDownloadsStore.getState().downloads.movie_direct_0.status).toBe(
      'interrupted',
    );
  });

  it('marks a completed record missing when its SAF document is gone', async () => {
    useDownloadsStore.getState().enqueueDownload({
      id: 'movie_direct_0',
      title: 'Movie',
      type: 'movie',
      url: 'https://example.com/movie.mp4',
      status: 'completed',
      filePath: 'content://downloads/movie.mp4',
    });

    await reconcileDownloadState();

    expect(useDownloadsStore.getState().downloads.movie_direct_0.status).toBe(
      'missing',
    );
  });

  it.each(['queued', 'paused', 'interrupted', 'error'] as const)(
    'preserves an existing %s state',
    async status => {
      useDownloadsStore.getState().enqueueDownload({
        id: 'movie_direct_0',
        title: 'Movie',
        type: 'movie',
        url: 'https://example.com/movie.mp4',
        status,
      });

      await reconcileDownloadState();

      expect(useDownloadsStore.getState().downloads.movie_direct_0.status).toBe(
        status,
      );
    },
  );

  it('finishes a persisted finalizing record from staging', async () => {
    const stagingPath = '/cache/downloads/movie/movie.mp4.part';
    mockFiles.set(stagingPath, 512);
    useDownloadsStore.getState().enqueueDownload({
      id: 'movie_direct_0',
      title: 'Movie',
      type: 'movie',
      url: 'https://example.com/movie.mp4',
      videoType: 'mp4',
      status: 'finalizing',
      stagingPath,
      downloadLocation: location,
    });

    await reconcileDownloadState();

    expect(useDownloadsStore.getState().downloads.movie_direct_0).toMatchObject(
      {
        status: 'completed',
        filePath: 'content://downloads/tree/movie/Movie.mp4',
      },
    );
  });

  it('clears stale foreground notification state', async () => {
    await reconcileDownloadState();
    expect(mockResetForeground).toHaveBeenCalledTimes(1);
  });

  it('removes orphan app-private staging directories', async () => {
    mockDirectories.add('/cache/downloads');
    mockDirectories.add('/cache/downloads/orphan');

    await reconcileDownloadState();

    expect(mockDirectories.has('/cache/downloads/orphan')).toBe(false);
  });
});
