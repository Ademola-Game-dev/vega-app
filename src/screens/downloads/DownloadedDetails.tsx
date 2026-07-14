import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {CompositeScreenProps} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Dropdown} from 'react-native-element-dropdown';
import type {DownloadsStackParamList, RootStackParamList} from '../../App';
import SingleOptionField from '../../components/SingleOptionField';
import {
  deleteDownloadOutput,
  downloadOutputExists,
} from '../../lib/downloadDestination';
import {formatDownloadBytes} from '../../lib/downloadFormatting';
import {
  createDownloadDirectoryName,
  createDownloadSeasonDirectoryName,
} from '../../lib/downloadId';
import {
  groupCompletedDownloads,
  sortDownloadedEpisodes,
} from '../../lib/downloadLibrary';
import type {DownloadItem} from '../../lib/zustand/downloadsStore';
import useDownloadsStore, {
  selectCompletedDownloads,
} from '../../lib/zustand/downloadsStore';
import useThemeStore from '../../lib/zustand/themeStore';

type DownloadedDetailsProps = CompositeScreenProps<
  NativeStackScreenProps<DownloadsStackParamList, 'DownloadedDetails'>,
  NativeStackScreenProps<RootStackParamList>
>;

const getSeasonTitle = (item: DownloadItem): string =>
  item.seasonTitle || 'Downloaded';

const DownloadedDetails = ({navigation, route}: DownloadedDetailsProps) => {
  const {primary} = useThemeStore(state => state);
  const completed = useDownloadsStore(selectCompletedDownloads);
  const markMissing = useDownloadsStore(state => state.markMissing);
  const removeDownload = useDownloadsStore(state => state.removeDownload);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const group = useMemo(
    () =>
      groupCompletedDownloads(completed).find(
        item => item.id === route.params.groupId,
      ),
    [completed, route.params.groupId],
  );
  const seasons = useMemo(
    () => [...new Set(group?.items.map(getSeasonTitle) || [])],
    [group],
  );
  const seasonOptions = useMemo(
    () => seasons.map(title => ({title})),
    [seasons],
  );
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(
    seasons[0],
  );
  useEffect(() => {
    if (!selectedSeason || !seasons.includes(selectedSeason)) {
      setSelectedSeason(seasons[0]);
    }
  }, [seasons, selectedSeason]);
  const items = useMemo(() => {
    if (!group) {
      return [];
    }
    return sortDownloadedEpisodes(
      group.items.filter(item => getSeasonTitle(item) === selectedSeason),
    );
  }, [group, selectedSeason]);

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Text className="text-center text-white/70">
          This downloaded title is no longer available.
        </Text>
        <TouchableOpacity
          className="mt-5 rounded-md px-5 py-3"
          style={{backgroundColor: primary}}
          onPress={() => navigation.goBack()}>
          <Text className="font-semibold text-white">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const metadata = group.items[0];
  const totalBytes = group.items.reduce(
    (total, item) => total + item.totalBytes,
    0,
  );

  const playItem = async (item: DownloadItem) => {
    if (!(await downloadOutputExists(item.filePath))) {
      markMissing(item.id);
      return;
    }
    const playableItems = items.filter(
      candidate => candidate.status === 'completed',
    );
    navigation.navigate('Player', {
      episodeList: playableItems.map(candidate => ({
        id: candidate.id,
        title: candidate.episodeName || candidate.title,
        link: candidate.filePath,
      })),
      linkIndex: playableItems.findIndex(candidate => candidate.id === item.id),
      type: '',
      directUrl: item.filePath,
      primaryTitle: group.title,
      secondaryTitle: item.seasonTitle,
      poster: {
        poster: metadata.poster,
        background: metadata.background,
      },
      providerValue: item.provider || metadata.provider || 'vega',
      infoUrl: item.infoUrl || metadata.infoUrl,
      doNotTrack: !(item.infoUrl || metadata.infoUrl),
    });
  };

  const deleteItem = async (item: DownloadItem) => {
    if (deletingId) {
      return;
    }
    setDeletingId(item.id);
    try {
      const deleted = await deleteDownloadOutput(item.filePath, {
        downloadLocation: item.downloadLocation,
        outputDirectoryNames: [
          createDownloadDirectoryName(item.showName || item.title),
          ...(item.type === 'series'
            ? [createDownloadSeasonDirectoryName(item.seasonTitle)].filter(
                (name): name is string => Boolean(name),
              )
            : []),
        ],
      });
      if (deleted || !(await downloadOutputExists(item.filePath))) {
        removeDownload(item.id);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const backgroundImage =
    metadata.background ||
    metadata.poster ||
    'https://placehold.jp/24/171717/ffffff/800x450.png?text=Vega';

  return (
    <View className="h-full w-full bg-black">
      <StatusBar translucent backgroundColor="transparent" />
      <View className="absolute h-[256px] w-full">
        <Image
          source={{uri: backgroundImage}}
          className="h-[256px] w-full"
          resizeMode="cover"
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="relative h-[256px] w-full">
          <LinearGradient
            colors={['transparent', 'black']}
            className="absolute h-full w-full"
          />
          <TouchableOpacity
            className="ml-4 mt-14 h-10 w-10 items-center justify-center rounded-full bg-black/70"
            onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <View className="absolute bottom-0 right-0 w-full px-3 pb-2">
            <Text className="w-3/4 text-2xl font-semibold capitalize text-white">
              {group.title}
            </Text>
            <Text className="mt-2 text-sm text-gray-300">
              {`${group.items.length} download${
                group.items.length === 1 ? '' : 's'
              }`}
              {'  '}·{'  '}
              {formatDownloadBytes(totalBytes)}
            </Text>
          </View>
        </View>

        <View className="bg-black p-4">
          {metadata.synopsis ? (
            <>
              <Text className="mb-2 text-lg font-semibold text-white">
                Synopsis
              </Text>
              <Text className="mb-6 rounded-md bg-tertiary px-2 py-1 text-sm leading-6 text-gray-200">
                {metadata.synopsis}
              </Text>
            </>
          ) : null}

          {seasonOptions.length > 1 ? (
            <Dropdown
              selectedTextStyle={{
                color: primary,
                overflow: 'hidden',
                height: 20,
                fontWeight: 'bold',
              }}
              labelField="title"
              valueField="title"
              value={selectedSeason}
              data={seasonOptions}
              onChange={item => setSelectedSeason(item.title)}
              style={{
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#2f302f',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: 'black',
              }}
              containerStyle={{
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'gray',
                borderRadius: 8,
                backgroundColor: 'black',
              }}
              renderItem={item => (
                <View
                  className={`flex-row items-center justify-start border-b border-gray-500 bg-black px-3 py-2 ${
                    selectedSeason === item.title ? 'bg-quaternary' : ''
                  }`}>
                  <Text className="text-white">{item.title}</Text>
                </View>
              )}
            />
          ) : (
            <SingleOptionField label={selectedSeason || 'Downloaded'} />
          )}

          <Text className="mb-1 mt-4 text-lg font-semibold text-white">
            Ready to watch
          </Text>
          {items.map((item, index) => (
            <View
              key={item.id}
              className="my-2 w-full flex-row items-center justify-center gap-2">
              <TouchableOpacity
                className="relative h-12 flex-1 flex-row items-center gap-x-2 rounded-md bg-white/30 p-2"
                onPress={() => playItem(item)}>
                <Ionicons name="play-circle" size={28} color={primary} />
                <Text className="flex-1 text-white" numberOfLines={1}>
                  {item.episodeName || item.title}
                </Text>
                <Text className="text-xs text-gray-300">
                  {items.length > 1 ? `E${index + 1} · ` : ''}
                  {formatDownloadBytes(item.totalBytes)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel={`Delete ${item.episodeName || item.title}`}
                className="h-12 w-12 items-center justify-center rounded-md bg-white/20"
                disabled={deletingId !== null}
                onPress={() => deleteItem(item)}>
                <MaterialCommunityIcons
                  name={
                    deletingId === item.id ? 'progress-clock' : 'delete-outline'
                  }
                  size={25}
                  color={deletingId === item.id ? primary : '#f87171'}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View className="h-16" />
      </ScrollView>
    </View>
  );
};

export default DownloadedDetails;
