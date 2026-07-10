import {ifExists} from './file/ifExists';
// import {hlsDownloader} from './hlsDownloader';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {Alert} from 'react-native';
import {settingsStorage} from './storage';
import requestStoragePermission from './file/getStoragePermission';
import {hlsDownloader2} from './hlsDownloader2';
import {notificationService} from './services/Notification';
import {
  copyFileToSaf,
  getDownloadFileName,
  isSafDownloadLocation,
} from './downloadLocation';
import {torrentManager} from './torrentManager';

export const activeTorrents = new Map<string, string>();
export const cancelledTorrents = new Set<string>();

export const cancelTorrentDownload = async (fileName: string) => {
  const infoHash = activeTorrents.get(fileName);
  if (infoHash) {
    cancelledTorrents.add(infoHash);
    await torrentManager.deleteTorrent(infoHash, true).catch(() => {});
    activeTorrents.delete(fileName);
  }
};

export const downloadManager = async ({
  title,
  url,
  fileName,
  fileType,
  setDownloadActive,
  setAlreadyDownloaded,
  setDownloadId,
  headers,
  deleteDownload,
}: {
  title: string;
  url: string;
  fileName: string;
  fileType: string;
  setDownloadActive: (value: boolean) => void;
  headers?: any;
  setAlreadyDownloaded: (value: boolean) => void;
  setDownloadId: (value: number) => void;
  deleteDownload: () => void;
}) => {
  await requestStoragePermission();

  await notificationService.showDownloadStarting(title, fileName);
  if (await ifExists(fileName)) {
    console.log('File already exists');
    setAlreadyDownloaded(true);
    setDownloadActive(false);
    return;
  }
  setDownloadActive(true);
  // if (activeDownloads.length > 0) {
  //   notifee.displayNotification({
  //     id: 'downloadQueue',
  //     title: 'Download Queue' + fileName,
  //     body: 'Downloading ' + fileName,
  //     android: {
  //       channelId,
  //       color: primary,
  //     },
  //   });
  //   console.log(
  //     'Downloading:',
  //     activeDownloads[0],
  //     activeDownloads[1],
  //     activeDownloads.length,
  //   );

  //   return;
  // }
  try {
    // downloadFile and save it to download folder
    const downloadLocation = settingsStorage.getDownloadLocationConfig();
    const isSafLocation = isSafDownloadLocation(downloadLocation);

    if (!isSafLocation && !(await RNFS.exists(downloadLocation.path))) {
      await RNFS.mkdir(downloadLocation.path);
    }
    await notificationService.requestPermission();

    if (fileType === 'm3u8') {
      if (isSafLocation) {
        throw new Error(
          'Custom Android download folders do not support HLS yet',
        );
      }

      // hlsDownloader({
      //   videoUrl: url,
      //   downloadStore,
      //   path: `${downloadLocation}/${fileName}.mp4`,
      //   fileName,
      //   title,
      //   setAlreadyDownloaded,
      //   setDownloadId: setDownloadId,
      //   headers,
      // });
      hlsDownloader2({
        videoUrl: url,
        setDownloadActive,
        path: `${downloadLocation.path}/${fileName}.mp4`,
        fileName,
        title,
        setAlreadyDownloaded,
        setDownloadId: setDownloadId,
        headers,
      });
      // ToastAndroid.show(
      //   'Hls video download is not supported, Use external Downloader',
      //   ToastAndroid.LONG,
      // );
      // notifee.cancelNotification(fileName);
      // downloadStore.removeActiveDownload(fileName);
      // setAlreadyDownloaded(false);
      console.log('Downloading HLS');
      return;
    }

    if (fileType === 'torrent' || url.startsWith('magnet:')) {
      console.log('Downloading Torrent');
      
      const targetFolder = isSafLocation ? RNFS.CachesDirectoryPath : downloadLocation.path;
      
      try {
        const addData = await torrentManager.addTorrent(url, {
          output_folder: targetFolder,
          file_name: fileName,
        });
        const infoHash = addData.infoHash;
        activeTorrents.set(fileName, infoHash);
        
        const intervalId = setInterval(async () => {
          if (cancelledTorrents.has(infoHash)) {
            clearInterval(intervalId);
            cancelledTorrents.delete(infoHash);
            setDownloadActive(false);
            return;
          }
          try {
            const stats = await torrentManager.getStats(infoHash);
            if (stats.state === 'downloading' || stats.state === 'finished' || stats.state === 'seeding') {
              const progress = stats.progress;
              const doneMB = Math.round(stats.totalDone / 1024 / 1024);
              const totalMB = Math.round(stats.totalWanted / 1024 / 1024);
              const body = `${doneMB} / ${totalMB} MB`;
              
              notificationService.showDownloadProgress(
                title,
                fileName,
                progress,
                body,
                infoHash
              );

              if (progress >= 1.0 && stats.totalDone > 0) {
                clearInterval(intervalId);
                await torrentManager.deleteTorrent(infoHash, false);

                if (isSafLocation) {
                  try {
                    const files = await RNFS.readDir(targetFolder);
                    const downloadedFile = files.find(fileItem => {
                      const nameWithoutExtension = fileItem.name
                        .split('.')
                        .slice(0, -1)
                        .join('.');
                      return nameWithoutExtension === fileName;
                    });

                    if (downloadedFile) {
                      const ext = downloadedFile.name.split('.').pop() || 'mp4';
                      await copyFileToSaf({
                        fromPath: downloadedFile.path,
                        directoryUri: downloadLocation.uri,
                        fileName: fileName,
                        fileType: ext,
                      });
                      await RNFS.unlink(downloadedFile.path).catch(() => {});
                    }
                  } catch (copyError) {
                    console.error('Failed to copy torrent to SAF location', copyError);
                  }
                }
                activeTorrents.delete(fileName);
                setAlreadyDownloaded(true);
                notificationService.showDownloadComplete(title, fileName);
                setDownloadActive(false);
              }
            }
          } catch (e: any) {
             if (cancelledTorrents.has(infoHash)) {
                clearInterval(intervalId);
                cancelledTorrents.delete(infoHash);
                setDownloadActive(false);
                return;
             }
             clearInterval(intervalId);
             activeTorrents.delete(fileName);
             console.error('Torrent progress error:', e);
             deleteDownload();
             Alert.alert('Download failed', e.message || 'Failed to download');
             notificationService.showDownloadFailed(title, fileName);
             setDownloadActive(false);
             setAlreadyDownloaded(false);
          }
        }, 1000);
      } catch (err: any) {
        console.error('Download init error:', err);
        Alert.alert('Download failed', err.message || 'Failed to download');
        notificationService.showDownloadFailed(title, fileName);
        setDownloadActive(false);
        setAlreadyDownloaded(false);
      }
      return;
    }
    const targetFileName = getDownloadFileName(fileName, fileType);
    const downloadDest = isSafLocation
      ? `${RNFS.CachesDirectoryPath}/${targetFileName}`
      : `${downloadLocation.path}/${targetFileName}`;
    const ret = RNFS.downloadFile({
      fromUrl: url,
      progressInterval: 1000,
      backgroundTimeout: 1000 * 60 * 60,
      progressDivider: 1,
      headers: headers ? headers : {},
      toFile: downloadDest,
      background: true,
      begin: (res: any) => {
        console.log('Download has started', res);
        setDownloadId(ret.jobId);
      },
      progress: (res: any) => {
        const progress = res.bytesWritten / res.contentLength;
        const body =
          res.contentLength < 1024 * 1024 * 1024
            ? Math.round(res.bytesWritten / 1024 / 1024) +
              ' / ' +
              Math.round(res.contentLength / 1024 / 1024) +
              ' MB'
            : parseFloat((res.bytesWritten / 1024 / 1024 / 1024).toFixed(2)) +
              ' / ' +
              parseFloat((res.contentLength / 1024 / 1024 / 1024).toFixed(2)) +
              ' GB';
        notificationService.showDownloadProgress(
          title,
          fileName,
          progress,
          body,
          ret.jobId,
        );
      },
    });
    ret.promise.then(res => {
      const finalizeDownload = async () => {
        console.log('Download complete', res);

        if (isSafLocation) {
          await copyFileToSaf({
            fromPath: downloadDest,
            directoryUri: downloadLocation.uri,
            fileName,
            fileType,
          });
          await RNFS.unlink(downloadDest);
        }

        setAlreadyDownloaded(true);
        notificationService.showDownloadComplete(title, fileName);
        setDownloadActive(false);
      };

      finalizeDownload().catch(async err => {
        deleteDownload();
        console.log('Download finalize error:', err);
        Alert.alert('Download failed', err.message || 'Failed to download');
        notificationService.showDownloadFailed(title, fileName);
        setDownloadActive(false);
        setAlreadyDownloaded(false);

        if (await RNFS.exists(downloadDest)) {
          await RNFS.unlink(downloadDest);
        }
      });
      // downloadManager({
      //   ...activeDownloads[0],
      //   downloadStore,
      //   setAlreadyDownloaded,
      // });
    });
    ret.promise.catch(async err => {
      deleteDownload();
      console.log('Download error:', err);
      Alert.alert('Download failed', err.message || 'Failed to download');
      notificationService.showDownloadFailed(title, fileName);
      setDownloadActive(false);
      setAlreadyDownloaded(false);

      if (isSafLocation && (await RNFS.exists(downloadDest))) {
        await RNFS.unlink(downloadDest);
      }
      // downloadManager({
      //   ...activeDownloads[0],
      //   downloadStore,
      //   setAlreadyDownloaded,
      // });
    });
    return ret.jobId;
  } catch (error: any) {
    console.error('Download error:', error);
    deleteDownload();
    Alert.alert('Download failed', 'Failed to download');
    setDownloadActive(false);
    setAlreadyDownloaded(false);
  }
};
