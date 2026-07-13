import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, Modal, Pressable} from 'react-native';
import {ifExists} from '../lib/file/ifExists';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import {Stream} from '../lib/providers/types';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../lib/zustand/contentStore';
import * as IntentLauncher from 'expo-intent-launcher';
import {cancelDownload} from '../lib/downloadManager';
import {downloadManager} from '../lib/downloader';
import useThemeStore from '../lib/zustand/themeStore';
import DownloadBottomSheet from './DownloadBottomSheet';
import {settingsStorage} from '../lib/storage';
import {providerManager} from '../lib/services/ProviderManager';
import {deleteDownloadedFileByBaseName} from '../lib/downloadLocation';
import {deleteDownloadOutput} from '../lib/downloadDestination';
import {
  createDownloadDirectoryName,
  createDownloadSeasonDirectoryName,
} from '../lib/downloadId';
import useDownloadsStore, {
  CURRENT_DOWNLOAD_STATUSES,
} from '../lib/zustand/downloadsStore';
import {createSubtitleFileName} from '../lib/downloadId';
import {
  selectDownloadLocation,
  validateDownloadLocationAccess,
} from '../lib/downloadLocation';
import DownloadLocationDialog from './DownloadLocationDialog';

type PendingDownload = {
  downloadId: string;
  title: string;
  showName?: string;
  episodeName?: string;
  seasonTitle?: string;
  mediaType: 'movie' | 'series';
  imdbId?: string;
  poster?: string;
  background?: string;
  synopsis?: string;
  provider?: string;
  infoUrl?: string;
  sourceLink?: string;
  url: string;
  fileName: string;
  fileType: string;
  headers?: Record<string, string>;
  subtitles?: Array<{url: string; language: string; format?: string}>;
  deleteDownload: () => void;
};

const DownloadComponent = ({
  link,
  downloadId,
  fileName,
  type,
  mediaType,
  providerValue,
  title,
  showName,
  episodeName,
  seasonTitle,
  imdbId,
  poster,
  background,
  synopsis,
  infoUrl,
}: {
  link: string;
  downloadId: string;
  fileName: string;
  type: string;
  mediaType: 'movie' | 'series';
  providerValue: string;
  title: string;
  showName?: string;
  episodeName?: string;
  seasonTitle?: string;
  imdbId?: string;
  poster?: string;
  background?: string;
  synopsis?: string;
  infoUrl?: string;
}) => {
  const {primary} = useThemeStore(state => state);
  const {provider} = useContentStore(state => state);
  const download = useDownloadsStore(state => state.downloads[downloadId]);
  const removeDownload = useDownloadsStore(state => state.removeDownload);
  const [legacyDownloadedFile, setLegacyDownloadedFile] = useState<
    string | boolean
  >(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [downloadModal, setDownloadModal] = useState(false);
  const [longPressModal, setLongPressModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [servers, setServers] = useState<Stream[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingDownload, setPendingDownload] =
    useState<PendingDownload | null>(null);
  const [locationDialogVisible, setLocationDialogVisible] = useState(false);
  const [selectingLocation, setSelectingLocation] = useState(false);
  const downloadActive = Boolean(
    download && CURRENT_DOWNLOAD_STATUSES.has(download.status),
  );
  const alreadyDownloaded =
    download?.status === 'completed' || Boolean(legacyDownloadedFile);

  const startDownloadWithLocation = async (request: PendingDownload) => {
    const currentLocation = settingsStorage.getDownloadLocationConfig();
    if (await validateDownloadLocationAccess(currentLocation)) {
      await downloadManager(request);
      return;
    }
    setPendingDownload(request);
    setLocationDialogVisible(true);
  };

  const selectLocationAndContinue = async () => {
    if (!pendingDownload || selectingLocation) {
      return;
    }
    setSelectingLocation(true);
    try {
      const location = await selectDownloadLocation();
      if (!location || !(await validateDownloadLocationAccess(location))) {
        return;
      }
      settingsStorage.setDownloadLocation(location);
      const request = pendingDownload;
      setPendingDownload(null);
      setLocationDialogVisible(false);
      await downloadManager(request);
    } finally {
      setSelectingLocation(false);
    }
  };

  useEffect(() => {
    if (download) {
      return;
    }
    const checkIfDownloaded = async () => {
      const exists = await ifExists(fileName);
      setLegacyDownloadedFile(exists);
    };
    checkIfDownloaded();
  }, [download, fileName]);

  // handle download deletion
  const deleteDownload = async () => {
    try {
      const deleted = download?.filePath
        ? await deleteDownloadOutput(download.filePath, {
            downloadLocation: download.downloadLocation,
            outputDirectoryNames: [
              createDownloadDirectoryName(download.showName || download.title),
              ...(download.type === 'series'
                ? [
                    createDownloadSeasonDirectoryName(download.seasonTitle),
                  ].filter((name): name is string => Boolean(name))
                : []),
            ],
          })
        : await deleteDownloadedFileByBaseName(
            settingsStorage.getDownloadLocationConfig(),
            fileName,
          );

      if (deleted) {
        removeDownload(downloadId);
        setLegacyDownloadedFile(false);
        setDeleteModal(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // choose server
  useEffect(() => {
    const controller = new AbortController();
    if (!downloadModal && !longPressModal) {
      return;
    }
    const getServer = async () => {
      setServerLoading(true);
      setServerError(null);
      try {
        const availableServers = await providerManager.getStream({
          link,
          type,
          signal: controller.signal,
          providerValue: providerValue || provider.value,
        });
        const filteredServers = availableServers;
        // .filter(
        //   server =>
        //     !manifest[
        //       providerValue || provider.value
        //     ].nonDownloadableServer?.includes(server.server),
        // );
        setServers(filteredServers);
      } catch (error: any) {
        console.error('Error fetching servers:', error);
        const errorMessage = error?.message || 'Failed to fetch servers';
        setServerError(errorMessage);
        setServers([]);
      } finally {
        setServerLoading(false);
      }
    };
    getServer();

    return () => {
      controller.abort();
    };
  }, [downloadModal, longPressModal]);

  // on holdPress external downloader
  const longPressDownload = async (targetLink: string, targetType?: string) => {
    try {
      const isTorrent =
        targetType === 'torrent' || targetLink.startsWith('magnet:');
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: targetLink,
        type: isTorrent ? undefined : targetType || 'video/*',
      });
    } catch (error) {
      console.log(error);
    }
  };

  const animatedStyles = useAnimatedStyle(() => ({
    opacity: withRepeat(withTiming(0.5, {duration: 500}), -1, true),
  }));

  return (
    <>
      <View className="flex-row items-center mt-1 justify-between rounded-full bg-white/30 p-1">
        {downloadActive ? (
          <Animated.View
            style={[
              {
                marginHorizontal: 4,
              },
              animatedStyles,
            ]}>
            <TouchableOpacity
              onPress={() => {
                setCancelModal(prev => !prev);
                console.log('pressed');
              }}>
              <MaterialIcons name="downloading" size={27} color={primary} />
            </TouchableOpacity>
          </Animated.View>
        ) : alreadyDownloaded ? (
          <TouchableOpacity
            onPress={() => setDeleteModal(true)}
            className="mx-1">
            <MaterialIcons name="delete-outline" size={27} color="#c1c4c9" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              if (
                settingsStorage.getBool('alwaysExternalDownloader') === true
              ) {
                setLongPressModal(true);
              } else {
                setDownloadModal(true);
              }
            }}
            onLongPress={() => {
              if (settingsStorage.getBool('hapticFeedback') !== false) {
                ReactNativeHapticFeedback.trigger('effectHeavyClick', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }
              setLongPressModal(true);
            }}
            className="mx-2">
            <Octicons name="download" size={25} color="#c1c4c9" />
          </TouchableOpacity>
        )}
        {/* delete modal */}
        {
          <Modal animationType="fade" visible={deleteModal} transparent={true}>
            <View className="flex-1 bg-black/10 justify-center items-center p-4">
              <View className="bg-tertiary p-3 w-80 rounded-md justify-center items-center">
                <Text className="text-2xl font-semibold my-3 text-white">
                  Confirm to delete
                </Text>
                <View className="flex-row items-center justify-evenly w-full my-5">
                  <TouchableOpacity
                    onPress={deleteDownload}
                    className="p-2 rounded-md m-1 px-3"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDeleteModal(false)}
                    className="p-2 px-4 rounded-md m-1"
                    style={{backgroundColor: primary}}>
                    <Text className="text-white font-semibold text-base rounded-md capitalize px-1">
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        }
        {/* download modal */}
        <DownloadBottomSheet
          setModal={setDownloadModal}
          showModal={downloadModal}
          data={servers}
          loading={serverLoading}
          error={serverError}
          title="Select Server To Download"
          onPressVideo={(server: Stream) => {
            startDownloadWithLocation({
              downloadId,
              title: title,
              showName,
              episodeName,
              seasonTitle,
              mediaType,
              imdbId,
              poster,
              background,
              synopsis,
              provider: providerValue || provider.value,
              infoUrl,
              sourceLink: link,
              url: server.link,
              fileName: fileName,
              fileType: server.type,
              headers: server?.headers,
              subtitles: server.subtitles?.map(subtitle => ({
                url: subtitle.uri,
                language: subtitle.language || 'Unknown',
                format: subtitle.type === 'text/vtt' ? 'vtt' : 'srt',
              })),
              deleteDownload: deleteDownload,
            });
          }}
          onPressSubs={(sub: {link: string; type: string; title: string}) => {
            startDownloadWithLocation({
              downloadId: `${downloadId}_subtitle_${sub.title}`,
              title: title + ' ' + sub.title + ' Subtitle ',
              showName,
              episodeName,
              seasonTitle,
              mediaType,
              imdbId,
              poster,
              background,
              synopsis,
              provider: providerValue || provider.value,
              infoUrl,
              sourceLink: link,
              url: sub.link,
              fileName: createSubtitleFileName(fileName, sub.title),
              fileType: sub.type,
              deleteDownload: () => {},
            });
          }}
        />
        <DownloadLocationDialog
          visible={locationDialogVisible}
          primary={primary}
          selecting={selectingLocation}
          onCancel={() => {
            if (selectingLocation) {
              return;
            }
            setPendingDownload(null);
            setLocationDialogVisible(false);
          }}
          onSelectFolder={() => {
            selectLocationAndContinue().catch(console.error);
          }}
        />
        {/* long press modal */}
        <DownloadBottomSheet
          setModal={setLongPressModal}
          showModal={longPressModal}
          data={servers}
          loading={serverLoading}
          error={serverError}
          title="Select Server To Open"
          onPressVideo={(server: Stream) => {
            longPressDownload(server.link);
          }}
          onPressSubs={(sub: {link: string; type: string; title: string}) => {
            longPressDownload(sub.link, 'text/vtt');
          }}
        />
      </View>
      {cancelModal && download && (
        <Pressable
          onPress={async () => {
            setCancelModal(false);
            try {
              await cancelDownload(downloadId);
            } catch (error) {
              console.log('Error cancelling download', error);
            }
          }}
          className="absolute right-12 bg-quaternary/80 bottom-3 rounded-md px-2">
          <Text className="text-lg text-white">Cancel</Text>
        </Pressable>
      )}
    </>
  );
};

export default DownloadComponent;
