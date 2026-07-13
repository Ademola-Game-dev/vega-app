const mockCancelDownload = jest.fn(async () => undefined);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async ({id}: {id: string}) => id),
    displayNotification: jest.fn(async () => undefined),
    cancelNotification: jest.fn(async () => undefined),
    cancelAllNotifications: jest.fn(async () => undefined),
    stopForegroundService: jest.fn(async () => undefined),
    getNotificationSettings: jest.fn(async () => ({authorizationStatus: 1})),
    requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
  },
  AndroidImportance: {DEFAULT: 3, HIGH: 4},
  AndroidForegroundServiceType: {
    FOREGROUND_SERVICE_TYPE_DATA_SYNC: 1,
  },
  EventType: {PRESS: 1, ACTION_PRESS: 2},
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

jest.mock('../src/lib/storage', () => ({
  settingsStorage: {getPrimaryColor: () => '#ffffff'},
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: async () => false,
}));

jest.mock('@himanshu8443/react-native-apk-installer', () => ({
  __esModule: true,
  default: {install: jest.fn(async () => undefined)},
}));

jest.mock('../src/lib/downloadManager', () => ({
  cancelDownload: mockCancelDownload,
}));

import {EventType} from '@notifee/react-native';
import notifee from '@notifee/react-native';
import {notificationService} from '../src/lib/services/Notification';

const mockDisplayNotification = notifee.displayNotification as jest.Mock;
const mockStopForegroundService = notifee.stopForegroundService as jest.Mock;
const mockGetNotificationSettings =
  notifee.getNotificationSettings as jest.Mock;
const mockRequestPermission = notifee.requestPermission as jest.Mock;

describe('notification service download lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await notificationService.resetDownloadForegroundState();
    mockStopForegroundService.mockClear();
  });

  it('includes stable download identity and backend in progress payloads', async () => {
    await notificationService.showDownloadProgress(
      'Movie',
      'movie_direct_0',
      0.5,
      '50 / 100 MB',
      'http',
    );

    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'movie_direct_0',
        data: {downloadId: 'movie_direct_0', sourceType: 'http'},
        android: expect.objectContaining({
          actions: [
            expect.objectContaining({pressAction: {id: 'cancel-download'}}),
          ],
        }),
      }),
    );
  });

  it('does not request permission when notifications are already authorized', async () => {
    await expect(notificationService.ensureDownloadPermission()).resolves.toBe(
      true,
    );
    expect(mockGetNotificationSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('requests permission when notifications are not authorized', async () => {
    mockGetNotificationSettings.mockResolvedValueOnce({authorizationStatus: 0});

    await expect(notificationService.ensureDownloadPermission()).resolves.toBe(
      true,
    );

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('keeps the foreground service while another download remains active', async () => {
    await notificationService.startForegroundTask('first');
    await notificationService.startForegroundTask('second');

    expect(mockDisplayNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'downloadForegroundService',
        body: '2 active downloads',
        android: expect.objectContaining({asForegroundService: true}),
      }),
    );

    await notificationService.stopForegroundTask('first');
    expect(mockStopForegroundService).not.toHaveBeenCalled();
    expect(mockDisplayNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'downloadForegroundService',
        body: '1 active download',
      }),
    );

    await notificationService.stopForegroundTask('second');
    expect(mockStopForegroundService).toHaveBeenCalledTimes(1);
  });

  it('keeps simultaneous episode progress notifications separate', async () => {
    await notificationService.showDownloadProgress(
      'Episode 1',
      'show_s1_e1',
      0.25,
      '25 / 100 MB',
      'http',
    );
    await notificationService.showDownloadProgress(
      'Episode 2',
      'show_s1_e2',
      0.5,
      '50 / 100 MB',
      'http',
    );

    expect(mockDisplayNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'show_s1_e1',
        android: expect.objectContaining({asForegroundService: false}),
      }),
    );
    expect(mockDisplayNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'show_s1_e2',
        android: expect.objectContaining({asForegroundService: false}),
      }),
    );
  });

  it('routes stable download cancellation through the global manager', async () => {
    await notificationService.actionHandler({
      type: EventType.ACTION_PRESS,
      detail: {
        pressAction: {id: 'cancel-download'},
        notification: {
          data: {downloadId: 'movie_direct_0', sourceType: 'torrent'},
        },
      } as never,
    });

    expect(mockCancelDownload).toHaveBeenCalledWith('movie_direct_0');
  });

  it('temporarily supports legacy filename cancellation payloads', async () => {
    await notificationService.actionHandler({
      type: EventType.ACTION_PRESS,
      detail: {
        pressAction: {id: 'legacy-file'},
        notification: {
          data: {fileName: 'legacy-file', jobId: 42},
        },
      } as never,
    });

    expect(mockCancelDownload).toHaveBeenCalledWith('legacy-file');
  });
});
