import notifee, {
  AndroidImportance,
  EventDetail,
  EventType,
  AndroidForegroundServiceType,
  AuthorizationStatus,
} from '@notifee/react-native';
import {settingsStorage} from '../storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import RNApkInstaller from '@himanshu8443/react-native-apk-installer';
import type {DownloadSourceType} from '../zustand/downloadsStore';

type NotificationData = Record<string, string | number | boolean>;

interface DownloadNotificationData extends NotificationData {
  downloadId: string;
  sourceType: DownloadSourceType;
}

export interface NotificationOptions {
  id: string;
  title: string;
  body: string;
  data?: NotificationData;
  progress?: {
    max: number;
    current: number;
    indeterminate?: boolean;
  };
  actions?: Array<{
    title: string;
    pressAction: {
      id: string;
    };
  }>;
  onlyAlertOnce?: boolean;
  asForegroundService?: boolean;
}

export interface ChannelOptions {
  id: string;
  name: string;
  importance?: AndroidImportance;
  description?: string;
}

class NotificationService {
  private _defaultChannelId = 'default';
  private _downloadChannelId = 'download';
  private _updateChannelId = 'update';
  private _downloadForegroundId = 'downloadForegroundService';
  private initialized = false;
  private permissionRequest?: Promise<boolean>;

  constructor() {
    this.initialize();
  }
  private async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Create default channels
      await this.createDefaultChannels();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  private async createDefaultChannels() {
    // Default channel
    await notifee.createChannel({
      id: this._defaultChannelId,
      name: 'Default Notifications',
      importance: AndroidImportance.DEFAULT,
    });

    // Download channel
    await notifee.createChannel({
      id: this._downloadChannelId,
      name: 'Download Notifications',
      importance: AndroidImportance.HIGH,
      description: 'Notifications for download progress and completion',
    });

    // Update channel
    await notifee.createChannel({
      id: this._updateChannelId,
      name: 'Update Notifications',
      importance: AndroidImportance.DEFAULT,
      description: 'Notifications for app and provider updates',
    });
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<any> {
    await this.ensureInitialized();
    return await notifee.requestPermission();
  }

  async ensureDownloadPermission(): Promise<boolean> {
    if (this.permissionRequest) {
      return this.permissionRequest;
    }

    this.permissionRequest = (async () => {
      await this.ensureInitialized();
      const current = await notifee.getNotificationSettings();
      if (
        current.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        current.authorizationStatus === AuthorizationStatus.PROVISIONAL
      ) {
        return true;
      }
      const requested = await notifee.requestPermission();
      return (
        requested.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        requested.authorizationStatus === AuthorizationStatus.PROVISIONAL
      );
    })();

    try {
      return await this.permissionRequest;
    } finally {
      this.permissionRequest = undefined;
    }
  }

  /**
   * Create a custom channel
   */
  async createChannel(options: ChannelOptions): Promise<string> {
    await this.ensureInitialized();
    return await notifee.createChannel({
      id: options.id,
      name: options.name,
      importance: options.importance || AndroidImportance.DEFAULT,
      description: options.description,
    });
  }

  /**
   * Display a notification with common settings
   */
  async displayNotification(
    options: NotificationOptions,
    channelId?: string,
  ): Promise<void> {
    await this.ensureInitialized();
    const primary = settingsStorage.getPrimaryColor();

    await notifee.displayNotification({
      id: options.id,
      title: options.title,
      body: options.body,
      data: options.data,
      android: {
        smallIcon: 'ic_notification',
        channelId: channelId || this._defaultChannelId,
        color: primary,
        pressAction: {
          id: 'default',
        },

        progress: options.progress,
        actions: options.actions,
        onlyAlertOnce: options.onlyAlertOnce || false,
        asForegroundService: options.asForegroundService ?? false,
        foregroundServiceTypes: options.asForegroundService
          ? [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC]
          : undefined,
      },
    });
  }

  /**
   * Display a download notification
   */
  async displayDownloadNotification(
    options: NotificationOptions,
  ): Promise<void> {
    await this.displayNotification(options, this._downloadChannelId);
  }

  /**
   * Display an update notification
   */
  async displayUpdateNotification(options: NotificationOptions): Promise<void> {
    await this.displayNotification(options, this._updateChannelId);
  }

  /**
   * Cancel a notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await this.ensureInitialized();
    await notifee.cancelNotification(notificationId);
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await this.ensureInitialized();
    await notifee.cancelAllNotifications();
  }

  private readonly _activeForegroundTasks = new Set<string>();

  private async updateDownloadForegroundNotification(): Promise<void> {
    const count = this._activeForegroundTasks.size;
    if (count === 0) {
      return;
    }
    await this.displayDownloadNotification({
      id: this._downloadForegroundId,
      title: count === 1 ? 'Download in progress' : 'Downloads in progress',
      body: count === 1 ? '1 active download' : `${count} active downloads`,
      onlyAlertOnce: true,
      asForegroundService: true,
    });
  }

  async startForegroundTask(downloadId: string): Promise<void> {
    this._activeForegroundTasks.add(downloadId);
    await this.updateDownloadForegroundNotification();
  }

  async stopForegroundTask(downloadId: string) {
    this._activeForegroundTasks.delete(downloadId);
    if (this._activeForegroundTasks.size === 0) {
      await notifee.stopForegroundService();
      return;
    }
    await this.updateDownloadForegroundNotification();
  }

  async resetDownloadForegroundState(): Promise<void> {
    this._activeForegroundTasks.clear();
    await notifee.stopForegroundService();
  }

  private getDownloadData(
    downloadId: string,
    sourceType: DownloadSourceType,
  ): DownloadNotificationData {
    return {downloadId, sourceType};
  }

  /**
   * Helper method to show download starting notification
   */
  async showDownloadStarting(
    title: string,
    downloadId: string,
    sourceType: DownloadSourceType,
  ): Promise<void> {
    await this.displayDownloadNotification({
      id: downloadId,
      title: title,
      body: 'Starting download',
      data: this.getDownloadData(downloadId, sourceType),
      progress: {
        max: 100,
        current: 0,
        indeterminate: true,
      },
    });
  }

  /**
   * Helper method to show download progress notification
   */
  async showDownloadProgress(
    title: string,
    downloadId: string,
    progress: number,
    progressText: string,
    sourceType: DownloadSourceType,
  ): Promise<void> {
    await this.displayDownloadNotification({
      id: downloadId,
      title: title,
      body: progressText,
      data: this.getDownloadData(downloadId, sourceType),
      progress: {
        max: 100,
        current: Math.min(Math.max(progress * 100, 0), 100),
        indeterminate: false,
      },
      actions: [
        {
          title: 'Cancel',
          pressAction: {
            id: 'cancel-download',
          },
        },
      ],
      onlyAlertOnce: true,
    });
  }

  /**
   * Helper method to show download complete notification
   */
  async showDownloadComplete(
    title: string,
    downloadId: string,
    sourceType: DownloadSourceType,
  ): Promise<void> {
    await this.cancelNotification(downloadId);
    await this.displayDownloadNotification({
      id: `downloadComplete${downloadId}`,
      title: 'Download complete',
      body: title,
      data: this.getDownloadData(downloadId, sourceType),
    });
  }

  /**
   * Helper method to show download failed notification
   */
  async showDownloadFailed(
    title: string,
    downloadId: string,
    sourceType: DownloadSourceType,
  ): Promise<void> {
    await this.cancelNotification(downloadId);
    await this.displayDownloadNotification({
      id: `downloadFailed${downloadId}`,
      title: 'Download failed',
      body: title,
      data: this.getDownloadData(downloadId, sourceType),
    });
  }

  /**
   * Helper method to show update available notification
   */
  async showUpdateAvailable(
    title: string,
    body: string,
    actions?: Array<{title: string; pressAction: {id: string}}>,
  ): Promise<void> {
    await this.displayUpdateNotification({
      id: 'updateAvailable',
      title: title,
      body: body,
      actions: actions,
    });
  }

  async actionHandler({type, detail}: {type: EventType; detail: EventDetail}) {
    if (
      type === EventType.ACTION_PRESS &&
      (detail.pressAction?.id === 'cancel-download' ||
        Boolean(detail.notification?.data?.jobId) ||
        (Boolean(detail.notification?.data?.fileName) &&
          detail.pressAction?.id !== 'default'))
    ) {
      const notificationData = detail.notification?.data;
      const downloadId =
        notificationData?.downloadId ||
        notificationData?.fileName ||
        (detail.pressAction?.id !== 'cancel-download'
          ? detail.pressAction?.id
          : undefined);
      if (downloadId) {
        const {cancelDownload} =
          require('../downloadManager') as typeof import('../downloadManager');
        await cancelDownload(String(downloadId));
      }
      return;
    }

    // Handle app update installation - check for both PRESS and ACTION_PRESS
    if (
      (type === EventType.PRESS || type === EventType.ACTION_PRESS) &&
      (detail.pressAction?.id === 'install' ||
        detail.notification?.data?.action === 'install')
    ) {
      console.log('Install action pressed');
      const apkPath = detail.notification?.data?.filePath;
      console.log('APK path:', apkPath);
      const res = apkPath ? await RNFS.exists(apkPath) : false;
      console.log('APK exists:', res);
      if (res) {
        console.log('Starting APK installation...');
        try {
          await RNApkInstaller.install(apkPath!);
          console.log('APK installation initiated successfully');
        } catch (error) {
          console.error('APK installation error:', error);
        }
      } else {
        console.error('APK file not found at path:', apkPath);
      }
    }
  }

  /**
   * Helper method to show update progress notification
   */
  async showUpdateProgress(
    title: string,
    body: string,
    progress?: {max: number; current: number; indeterminate?: boolean},
  ): Promise<void> {
    await this.displayUpdateNotification({
      id: 'updateProgress',
      title: title,
      body: body,
      progress: progress,
    });
  }

  /**
   * Get the default download channel ID
   */
  getDownloadChannelId(): string {
    return this._downloadChannelId;
  }

  /**
   * Get the default update channel ID
   */
  getUpdateChannelId(): string {
    return this._updateChannelId;
  }

  /**
   * Get the default channel ID
   */
  getDefaultChannelId(): string {
    return this._defaultChannelId;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();
export default notificationService;
