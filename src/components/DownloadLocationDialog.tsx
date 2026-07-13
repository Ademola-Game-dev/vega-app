import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {Modal, Text, TouchableOpacity, View} from 'react-native';

interface DownloadLocationDialogProps {
  visible: boolean;
  primary: string;
  selecting: boolean;
  onCancel: () => void;
  onSelectFolder: () => void;
}

const DownloadLocationDialog = ({
  visible,
  primary,
  selecting,
  onCancel,
  onSelectFolder,
}: DownloadLocationDialogProps) => (
  <Modal
    animationType="fade"
    visible={visible}
    transparent
    statusBarTranslucent
    onRequestClose={onCancel}>
    <View className="flex-1 items-center justify-center bg-black/70 px-6">
      <View className="w-full max-w-md rounded-lg bg-[#1A1A1A] p-5">
        <View className="mb-4 flex-row items-center">
          <View
            className="mr-3 h-11 w-11 items-center justify-center rounded-full"
            style={{backgroundColor: `${primary}22`}}>
            <MaterialCommunityIcons
              name="folder-download-outline"
              size={25}
              color={primary}
            />
          </View>
          <Text className="flex-1 text-xl font-semibold text-white">
            Select download location
          </Text>
        </View>

        <Text className="mb-5 text-sm leading-5 text-gray-300">
          Choose the folder where Vega should save downloaded movies and
          episodes. Android will open its folder picker after you continue.
        </Text>

        <View className="flex-row justify-end gap-3">
          <TouchableOpacity
            className="rounded-md px-4 py-3"
            disabled={selecting}
            onPress={onCancel}>
            <Text className="font-medium text-gray-300">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center rounded-md px-4 py-3"
            style={{backgroundColor: primary}}
            disabled={selecting}
            onPress={onSelectFolder}>
            <MaterialCommunityIcons
              name="folder-open-outline"
              size={20}
              color="white"
            />
            <Text className="ml-2 font-semibold text-white">
              {selecting ? 'Opening...' : 'Choose folder'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default DownloadLocationDialog;
