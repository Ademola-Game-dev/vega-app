import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {StatusBar} from 'expo-status-bar';
import React, {useMemo} from 'react';
import {Dimensions, FlatList, Platform, Text, View} from 'react-native';
import type {DownloadsStackParamList} from '../../App';
import MediaPosterCard from '../../components/MediaPosterCard';
import {groupCompletedDownloads} from '../../lib/downloadLibrary';
import useDownloadsStore, {
  selectCompletedDownloads,
} from '../../lib/zustand/downloadsStore';
import useThemeStore from '../../lib/zustand/themeStore';
import CurrentDownloadsSection from '../settings/components/CurrentDownloadsSection';
import MissingDownloadsSection from '../settings/components/MissingDownloadsSection';

const GRID_PADDING = 12;
const GRID_GAP = 10;
const MIN_CARD_WIDTH = 100;

const Downloads = () => {
  const {primary} = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<DownloadsStackParamList>>();
  const completed = useDownloadsStore(selectCompletedDownloads);
  const groups = useMemo(() => groupCompletedDownloads(completed), [completed]);
  const availableWidth = Dimensions.get('window').width - GRID_PADDING * 2;
  const columns = Math.max(
    2,
    Math.floor((availableWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)),
  );
  const cardWidth = (availableWidth - GRID_GAP * (columns - 1)) / columns;

  return (
    <View className="flex-1 bg-black">
      <StatusBar translucent backgroundColor="transparent" />
      <FlatList
        data={groups}
        key={columns}
        numColumns={columns}
        keyExtractor={item => item.id}
        columnWrapperStyle={{gap: GRID_GAP}}
        contentContainerStyle={{
          paddingHorizontal: GRID_PADDING,
          paddingTop: Platform.OS === 'android' ? 28 : 12,
          paddingBottom: 80,
        }}
        ListHeaderComponent={
          <View>
            <Text
              className="mb-6 mt-2 text-center text-2xl font-bold"
              style={{color: primary}}>
              Downloads
            </Text>
            <CurrentDownloadsSection primary={primary} />
            <MissingDownloadsSection primary={primary} />
            {groups.length > 0 ? (
              <Text className="mb-4 text-lg font-semibold text-white">
                Downloaded
              </Text>
            ) : null}
          </View>
        }
        renderItem={({item}) => (
          <MediaPosterCard
            title={item.title}
            poster={item.poster}
            width={cardWidth}
            subtitle={`${item.items.length} ${item.items.length === 1 ? 'Download' : 'Downloads'}`}
            onPress={() =>
              navigation.navigate('DownloadedDetails', {groupId: item.id})
            }
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <MaterialCommunityIcons
              name="download-off-outline"
              size={72}
              color={primary}
            />
            <Text className="mt-4 text-center text-base text-white/70">
              Your downloaded library is empty
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default Downloads;
