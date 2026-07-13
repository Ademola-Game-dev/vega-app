import React from 'react';
import {Text, View} from 'react-native';
import {cancelDownload, retryDownload} from '../../../lib/downloadManager';
import useDownloadsStore, {
  selectCurrentDownloads,
} from '../../../lib/zustand/downloadsStore';
import CurrentDownloadRow from './CurrentDownloadRow';

const CurrentDownloadsSection = ({primary}: {primary: string}) => {
  const downloads = useDownloadsStore(selectCurrentDownloads).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  if (downloads.length === 0) {
    return null;
  }

  return (
    <View className="mb-5">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-white">
          Current Downloads
        </Text>
        <Text className="text-sm text-gray-400">{downloads.length}</Text>
      </View>
      {downloads.map(item => (
        <CurrentDownloadRow
          key={item.id}
          item={item}
          primary={primary}
          onCancel={() => cancelDownload(item.id).catch(console.error)}
          onRetry={() => retryDownload(item.id).catch(console.error)}
        />
      ))}
    </View>
  );
};

export default CurrentDownloadsSection;
