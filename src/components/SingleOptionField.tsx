import React from 'react';
import {Text, View} from 'react-native';

interface SingleOptionFieldProps {
  label: string;
}

const SingleOptionField = ({label}: SingleOptionFieldProps) => (
  <View className="h-10 justify-center rounded-md border border-white/20 bg-black px-3">
    <Text className="text-sm font-semibold text-white" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

export default SingleOptionField;
