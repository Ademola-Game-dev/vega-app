import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
} from 'react-native';
// import pkg from '../../../package.json';
import React, {useState} from 'react';
import {Feather} from '@expo/vector-icons';
import {settingsStorage} from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import {notificationService} from '../../lib/services/Notification';



const deletePartialFile = async (filePath: string) => {
  try {
    if (await RNFS.exists(filePath)) await RNFS.unlink(filePath);
  } catch {}
};

const downloadUpdate = async (url: string, name: string) => {
  console.log('downloading', url, name);
  await notificationService.requestPermission();

  const filePath = `${RNFS.DownloadDirectoryPath}/${name}`;


  let expectedSize = 0;

  const {promise} = RNFS.downloadFile({
    fromUrl: url,
    background: true,
    progressInterval: 1000,
    progressDivider: 1,
    toFile: filePath,
    begin: res => {
      expectedSize = res.contentLength;
      console.log('begin', res.jobId, res.statusCode, res.contentLength);
    },
    progress: res => {
      notificationService.showUpdateProgress(
        'Downloading Update',
        `Version ${Application.nativeApplicationVersion} -> ${name}`,
        {
          current: res.bytesWritten,
          max: res.contentLength,
          indeterminate: false,
        },
      );
    },
  });

  try {
    const res = await promise;
    await notificationService.cancelNotification('updateProgress');

    if (res.statusCode !== 200 || res.bytesWritten < expectedSize) {
      console.log(`[update] Download failed: status=${res.statusCode}, bytes=${res.bytesWritten}/${expectedSize}`);
      await deletePartialFile(filePath);
      ToastAndroid.show('Download failed, please try again', ToastAndroid.SHORT);
      return;
    }

    await notificationService.displayUpdateNotification({
      id: 'downloadComplete',
      title: 'Download Complete',
      body: 'Tap to install',
      data: {name, action: 'install'},
    });
  } catch (error) {
    console.log('[update] Download error:', error);
    await notificationService.cancelNotification('updateProgress');
    await deletePartialFile(filePath);
    ToastAndroid.show('Download failed, please try again', ToastAndroid.SHORT);
  }
};

// handle check for update
export const checkForUpdate = async (
  setUpdateLoading: React.Dispatch<React.SetStateAction<boolean>>,
  autoDownload: boolean,
  showToast: boolean = true,
) => {
  setUpdateLoading(true);
  try {
    const res = await fetch(
      'https://api.github.com/repos/Zenda-Cross/vega-app/releases/latest',
    );
    const data = await res.json();
    const localVersion = Application.nativeApplicationVersion;
    const remoteVersion = Number(
      data.tag_name.replace('v', '')?.split('.').join(''),
    );
    if (compareVersions(localVersion || '', data.tag_name.replace('v', ''))) {
      ToastAndroid.show('New update available', ToastAndroid.SHORT);
      Alert.alert(`Update v${localVersion} -> ${data.tag_name}`, data.body, [
        {text: 'Cancel'},
        {
          text: 'Update',
          onPress: () => {
            // Prioritize the universal APK since we don't check device architecture
            const apkAsset = 
              data?.assets?.find((a: any) => a.name?.endsWith('.apk') && a.name?.toLowerCase().includes('universal')) || 
              data?.assets?.find((a: any) => a.name?.endsWith('.apk'));
            return autoDownload && apkAsset
              ? downloadUpdate(apkAsset.browser_download_url, apkAsset.name)
              : Linking.openURL(data.html_url);
          },
        },
      ]);
      console.log(
        'local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    } else {
      showToast && ToastAndroid.show('App is up to date', ToastAndroid.SHORT);
      console.log(
        'local version',
        localVersion,
        'remote version',
        remoteVersion,
      );
    }
  } catch (error) {
    ToastAndroid.show('Failed to check for update', ToastAndroid.SHORT);
    console.log('Update error', error);
  }
  setUpdateLoading(false);
};

const About = () => {
  const {primary} = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState<boolean>(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );

  return (
    <View className="flex-1 bg-black mt-8">
      <View className="px-4 py-3 border-b border-white/10">
        <Text className="text-2xl font-bold text-white">About</Text>
        <Text className="text-gray-400 mt-1 text-sm">
          App information and updates
        </Text>
      </View>

      <View className="p-4 space-y-4 pb-24">
        {/* Version */}
        <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">Version</Text>
          <Text className="text-white/70">
            v{Application.nativeApplicationVersion}
          </Text>
        </View>

        {!Constants.expoConfig?.extra?.isPlayStore && (
          <>
            {/* Auto Install Updates */}
            <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
              <Text className="text-white text-base">Auto Install Updates</Text>
              <Switch
                value={autoDownload}
                onValueChange={() => {
                  setAutoDownload(!autoDownload);
                  settingsStorage.setAutoDownloadEnabled(!autoDownload);
                }}
                thumbColor={autoDownload ? primary : 'gray'}
              />
            </View>

            {/* Auto Check Updates */}
            <View className="bg-white/10 p-3 rounded-lg flex-row justify-between items-center">
              <View className="flex-1 mr-2">
                <Text className="text-white text-base">Check Updates on Start</Text>
                <Text className="text-gray-400 text-sm">
                  Automatically check for updates when app starts
                </Text>
              </View>
              <Switch
                value={autoCheckUpdate}
                onValueChange={() => {
                  setAutoCheckUpdate(!autoCheckUpdate);
                  settingsStorage.setAutoCheckUpdateEnabled(!autoCheckUpdate);
                }}
                thumbColor={autoCheckUpdate ? primary : 'gray'}
              />
            </View>

            {/* Check Updates Button */}
            <TouchableNativeFeedback
              onPress={() => checkForUpdate(setUpdateLoading, autoDownload, true)}
              disabled={updateLoading}
              background={TouchableNativeFeedback.Ripple('#ffffff20', false)}>
              <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center mt-4">
                <View className="flex-row items-center space-x-3">
                  <MaterialCommunityIcons name="update" size={22} color="white" />
                  <Text className="text-white text-base">Check for Updates</Text>
                </View>
                <Feather name="chevron-right" size={20} color="white" />
              </View>
            </TouchableNativeFeedback>
          </>
        )}
      </View>
    </View>
  );
};

export default About;

function compareVersions(localVersion: string, remoteVersion: string): boolean {
  try {
    // Split versions into arrays and convert to numbers
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    // Compare major version
    if (remote[0] > local[0]) {
      return true;
    }
    if (remote[0] < local[0]) {
      return false;
    }

    // Compare minor version
    if (remote[1] > local[1]) {
      return true;
    }
    if (remote[1] < local[1]) {
      return false;
    }

    // Compare patch version
    if (remote[2] > local[2]) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Invalid version format');
    return false;
  }
}
