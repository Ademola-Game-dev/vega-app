import React, {useState} from 'react';
import {
  Platform,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as FileSystem from 'expo-file-system/legacy';
import {defaultDownloadFolder} from '../../../lib/constants';
import {getDownloadLocationDisplayValue} from '../../../lib/downloadLocation';
import {settingsStorage} from '../../../lib/storage';

type DownloadLocationPreferenceProps = {
  primary: string;
};

const DownloadLocationPreference = ({
  primary,
}: DownloadLocationPreferenceProps) => {
  const [downloadLocation, setDownloadLocation] = useState(
    settingsStorage.getDownloadLocation(),
  );
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const saveDownloadLocation = (
    location:
      | string
      | {
          type: 'saf';
          uri: string;
          label: string;
        },
  ) => {
    if (typeof location === 'string' && !location.trim()) {
      ToastAndroid.show('Invalid download location', ToastAndroid.SHORT);
      return;
    }

    settingsStorage.setDownloadLocation(location);
    const nextLocation =
      typeof location === 'string'
        ? location.trim()
        : getDownloadLocationDisplayValue(location);
    setDownloadLocation(nextLocation);
    ToastAndroid.show('Download location updated', ToastAndroid.SHORT);
  };

  const getAndroidDirectoryLabel = (directoryUri: string) => {
    const treeMarker = '/tree/';
    const treeIndex = directoryUri.indexOf(treeMarker);
    if (treeIndex === -1) {
      return 'Custom folder';
    }

    const documentId = decodeURIComponent(
      directoryUri.slice(treeIndex + treeMarker.length),
    );
    const [volume, relativePath = ''] = documentId.split(':');

    if (!relativePath) {
      return volume === 'primary' ? 'Internal storage' : volume;
    }

    return `${volume === 'primary' ? 'Internal storage' : volume}/${relativePath}`;
  };

  const pickDownloadLocation = async () => {
    if (isPickingFolder) {
      return;
    }

    setIsPickingFolder(true);
    try {
      if (Platform.OS === 'android') {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
          ToastAndroid.show('No folder selected', ToastAndroid.SHORT);
          return;
        }

        saveDownloadLocation({
          type: 'saf',
          uri: permissions.directoryUri,
          label: getAndroidDirectoryLabel(permissions.directoryUri),
        });
        return;
      }

      const pickedFolders = await RNFS.pickFile({pickerType: 'folder'});
      const pickedFolder = pickedFolders[0];
      if (pickedFolder) {
        saveDownloadLocation(pickedFolder.replace(/^file:\/\//, ''));
        return;
      }

      ToastAndroid.show('No folder selected', ToastAndroid.SHORT);
    } catch (error) {
      console.log('Error picking download folder:', error);
      ToastAndroid.show('Unable to open folder picker', ToastAndroid.SHORT);
    } finally {
      setIsPickingFolder(false);
    }
  };

  return (
    <View className="mb-6">
      <Text className="text-gray-400 text-sm mb-3">Downloads</Text>
      <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
        <View className="p-4 border-b border-[#262626]">
          <Text className="text-white text-base mb-3">Download Location</Text>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-gray-300 text-sm flex-1" numberOfLines={2}>
              {downloadLocation}
            </Text>
            <TouchableOpacity
              onPress={pickDownloadLocation}
              disabled={isPickingFolder}
              className="p-2 rounded-lg bg-[#262626]">
              <MaterialCommunityIcons
                name="folder-open-outline"
                size={22}
                color={primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            settingsStorage.resetDownloadLocation();
            setDownloadLocation(defaultDownloadFolder);
            ToastAndroid.show('Download location reset', ToastAndroid.SHORT);
          }}
          className="flex-row items-center justify-between p-4">
          <Text className="text-white text-base flex-1">
            Reset Download Location
          </Text>
          <MaterialCommunityIcons name="restore" size={24} color={primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default DownloadLocationPreference;
