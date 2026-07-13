import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {Image, Text, TouchableOpacity, View} from 'react-native';
import {
  formatDownloadBytes,
  formatDownloadSpeed,
} from '../../../lib/downloadFormatting';
import type {
  DownloadItem,
  DownloadStatus,
} from '../../../lib/zustand/downloadsStore';
import DownloadProgressBar from './DownloadProgressBar';

const statusLabels: Record<DownloadStatus, string> = {
  queued: 'Queued',
  starting: 'Starting',
  downloading: 'Downloading',
  pausing: 'Pausing',
  paused: 'Paused',
  finalizing: 'Finalizing',
  completed: 'Completed',
  interrupted: 'Interrupted',
  error: 'Failed',
  missing: 'Missing',
  canceling: 'Canceling',
};

const getSubtitle = (item: DownloadItem): string => {
  if (item.type === 'movie') {
    return 'Movie';
  }
  return (
    [item.seasonTitle, item.episodeName].filter(Boolean).join(' • ') ||
    'Episode'
  );
};

const CurrentDownloadRow = ({
  item,
  primary,
  onCancel,
  onRetry,
}: {
  item: DownloadItem;
  primary: string;
  onCancel: () => void;
  onRetry: () => void;
}) => {
  const progress =
    item.totalBytes > 0 ? item.downloadedBytes / item.totalBytes : 0;
  const failed = item.status === 'error' || item.status === 'interrupted';
  const canCancel = item.status !== 'canceling';

  return (
    <View className="mb-3 rounded-xl bg-[#161616] p-3">
      <View className="flex-row">
        <View className="h-24 w-16 overflow-hidden rounded-lg bg-quaternary">
          {item.poster ? (
            <Image
              source={{uri: item.poster}}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <MaterialCommunityIcons
                name="movie-open-outline"
                size={26}
                color={primary}
              />
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text
                className="text-base font-semibold text-white"
                numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="mt-1 text-xs text-gray-400" numberOfLines={1}>
                {getSubtitle(item)}
              </Text>
            </View>
            <Text
              className={
                failed
                  ? 'text-xs font-medium text-red-400'
                  : 'text-xs font-medium text-gray-300'
              }>
              {statusLabels[item.status]}
            </Text>
          </View>

          <View className="mt-3">
            <DownloadProgressBar
              progress={progress}
              color={failed ? '#f87171' : primary}
            />
            <View className="mt-2 flex-row justify-between">
              <Text className="text-xs text-gray-400">
                {formatDownloadBytes(item.downloadedBytes)}
                {item.totalBytes > 0
                  ? ` / ${formatDownloadBytes(item.totalBytes)}`
                  : ''}
              </Text>
              {item.speed > 0 && (
                <Text className="text-xs text-gray-400">
                  {formatDownloadSpeed(item.speed)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {failed && item.errorMessage && (
        <Text className="mt-3 text-sm text-red-400">{item.errorMessage}</Text>
      )}

      <View className="mt-3 flex-row justify-end gap-2">
        {failed && item.retryable && (
          <TouchableOpacity
            onPress={onRetry}
            className="flex-row items-center rounded-lg bg-white/10 px-3 py-2">
            <MaterialCommunityIcons name="refresh" size={18} color={primary} />
            <Text className="ml-1 text-sm font-medium text-white">Retry</Text>
          </TouchableOpacity>
        )}
        {canCancel && (
          <TouchableOpacity
            onPress={onCancel}
            className="flex-row items-center rounded-lg bg-red-500/15 px-3 py-2">
            <MaterialCommunityIcons name="close" size={18} color="#f87171" />
            <Text className="ml-1 text-sm font-medium text-red-400">
              Cancel
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default CurrentDownloadRow;
