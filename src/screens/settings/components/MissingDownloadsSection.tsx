import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import useDownloadsStore, {
  selectMissingDownloads,
} from '../../../lib/zustand/downloadsStore';

const MissingDownloadsSection = ({primary}: {primary: string}) => {
  const missing = useDownloadsStore(selectMissingDownloads);
  const removeDownload = useDownloadsStore(state => state.removeDownload);

  if (missing.length === 0) {
    return null;
  }

  return (
    <View className="mb-5">
      <Text className="mb-3 text-lg font-semibold text-white">
        Missing Downloads
      </Text>
      {missing.map(item => (
        <View
          key={item.id}
          className="mb-2 flex-row items-center rounded-lg bg-[#161616] p-3">
          <MaterialCommunityIcons
            name="file-alert-outline"
            size={26}
            color="#f87171"
          />
          <View className="ml-3 flex-1">
            <Text className="font-medium text-white" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="mt-1 text-xs text-red-400">
              {item.errorMessage}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => removeDownload(item.id)}
            className="rounded-lg bg-white/10 px-3 py-2">
            <Text className="text-sm font-medium" style={{color: primary}}>
              Remove
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

export default MissingDownloadsSection;
