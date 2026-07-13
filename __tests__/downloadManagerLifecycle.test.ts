const mockBackendStart = jest.fn(async () => undefined);
const mockBackendCancel = jest.fn(async () => undefined);
const mockBackendCleanup = jest.fn(async () => undefined);

jest.mock('../src/lib/downloadBackends/registry', () => ({
  getDownloadBackend: () => ({
    start: mockBackendStart,
    cancel: mockBackendCancel,
    cleanup: mockBackendCleanup,
  }),
}));

jest.mock('../src/lib/downloadDestination', () => ({
  prepareDownloadDestination: async () => ({
    stagingDirectory: '/cache/downloads/movie',
    stagingPath: '/cache/downloads/movie/Movie.mp4.part',
  }),
  finalizeDownloadOutput: async () => ({
    filePath: 'content://downloads/Movie.mp4',
    finalDocumentUri: 'content://downloads/Movie.mp4',
    size: 100,
  }),
  cleanupDownloadStaging: async () => undefined,
}));

jest.mock('../src/lib/downloadLocation', () => ({
  ensureDownloadLocationAccess: async (location: unknown) => location,
  isSafDownloadLocation: () => true,
}));

jest.mock('../src/lib/services/Notification', () => ({
  notificationService: {
    ensureDownloadPermission: jest.fn(async () => true),
    startForegroundTask: jest.fn(),
    stopForegroundTask: jest.fn(async () => undefined),
    showDownloadStarting: jest.fn(async () => undefined),
    showDownloadProgress: jest.fn(async () => undefined),
    showDownloadComplete: jest.fn(async () => undefined),
    showDownloadFailed: jest.fn(async () => undefined),
    cancelNotification: jest.fn(async () => undefined),
  },
}));

jest.mock('../src/lib/storage', () => ({
  settingsStorage: {
    getDownloadLocationConfig: () => undefined,
    setDownloadLocation: jest.fn(),
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

import {startDownload} from '../src/lib/downloadManager';
import {notificationService} from '../src/lib/services/Notification';
import useDownloadsStore from '../src/lib/zustand/downloadsStore';

const mockStartForegroundTask =
  notificationService.startForegroundTask as jest.Mock;
const mockStopForegroundTask =
  notificationService.stopForegroundTask as jest.Mock;
const mockShowStarting = notificationService.showDownloadStarting as jest.Mock;
const mockShowComplete = notificationService.showDownloadComplete as jest.Mock;
const mockShowFailed = notificationService.showDownloadFailed as jest.Mock;

const location = {
  type: 'saf' as const,
  uri: 'content://downloads/tree',
  label: 'Downloads',
};

const enqueueDownload = () =>
  useDownloadsStore.getState().enqueueDownload({
    id: 'movie_direct_0',
    title: 'Movie',
    type: 'movie',
    url: 'https://example.com/movie.mp4',
    sourceType: 'http',
    videoType: 'mp4',
  });

describe('download manager foreground lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDownloadsStore.setState({downloads: {}});
    mockBackendStart.mockResolvedValue(undefined);
    mockShowStarting.mockResolvedValue(undefined);
  });

  it('releases tracking after successful completion', async () => {
    enqueueDownload();

    await startDownload('movie_direct_0', location);

    expect(mockStartForegroundTask).toHaveBeenCalledWith('movie_direct_0');
    expect(mockShowComplete).toHaveBeenCalledWith(
      'Movie',
      'movie_direct_0',
      'http',
    );
    expect(mockStopForegroundTask).toHaveBeenCalledWith('movie_direct_0');
  });

  it('releases tracking when notification startup fails', async () => {
    enqueueDownload();
    mockShowStarting.mockRejectedValueOnce(new Error('notification failed'));

    await expect(startDownload('movie_direct_0', location)).rejects.toThrow(
      'notification failed',
    );

    expect(mockShowFailed).toHaveBeenCalledWith(
      'Movie',
      'movie_direct_0',
      'http',
    );
    expect(mockStopForegroundTask).toHaveBeenCalledWith('movie_direct_0');
  });
});
