import React, {useState} from 'react';
import {Text, ToastAndroid, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  getDownloadLocationDisplayValue,
  selectDownloadLocation,
} from '../../../lib/downloadLocation';
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
    location: NonNullable<
      ReturnType<typeof settingsStorage.getDownloadLocationConfig>
    >,
  ) => {
    settingsStorage.setDownloadLocation(location);
    setDownloadLocation(getDownloadLocationDisplayValue(location));
    ToastAndroid.show('Download location updated', ToastAndroid.SHORT);
  };

  const pickDownloadLocation = async () => {
    if (isPickingFolder) {
      return;
    }

    setIsPickingFolder(true);
    try {
      const pickedLocation = await selectDownloadLocation();
      if (pickedLocation) {
        saveDownloadLocation(pickedLocation);
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
            setDownloadLocation('Select a download folder');
            ToastAndroid.show('Download location cleared', ToastAndroid.SHORT);
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
