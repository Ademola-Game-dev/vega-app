import React from 'react';
import {Image, Text, TouchableOpacity, View} from 'react-native';

interface MediaPosterCardProps {
  title: string;
  poster?: string;
  width: number;
  subtitle?: string;
  onPress: () => void;
}

const MediaPosterCard = ({
  title,
  poster,
  width,
  subtitle,
  onPress,
}: MediaPosterCardProps) => (
  <TouchableOpacity
    onPress={onPress}
    style={{width, marginBottom: 18}}
    activeOpacity={0.8}>
    <View className="overflow-hidden rounded-lg bg-tertiary">
      {poster ? (
        <Image
          source={{uri: poster}}
          resizeMode="cover"
          style={{width, aspectRatio: 2 / 3}}
        />
      ) : (
        <View
          className="items-center justify-center bg-quaternary"
          style={{width, aspectRatio: 2 / 3}}>
          <Text className="text-3xl font-bold text-white/40">
            {title.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
    <Text
      className="mt-2 text-sm font-medium text-white text-center"
      numberOfLines={1}>
      {title}
    </Text>
    {subtitle ? (
      <Text
        className="mt-0.5 text-xs text-gray-400 text-center"
        numberOfLines={1}>
        {subtitle}
      </Text>
    ) : null}
  </TouchableOpacity>
);

export default MediaPosterCard;
