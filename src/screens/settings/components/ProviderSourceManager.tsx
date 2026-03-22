import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {MaterialCommunityIcons, MaterialIcons} from '@expo/vector-icons';
import {Dropdown} from 'react-native-element-dropdown';
import {
  extensionStorage,
  ProviderSource,
} from '../../../lib/storage/extensionStorage';
import {createProviderSource} from '../../../lib/utils/helpers';
import {socialLinks} from '../../../lib/constants';

type Props = {
  primary: string;
  visible: boolean;
  onSourceChanged: (source: ProviderSource | undefined) => void | Promise<void>;
};

type SourceDropdownItem = {
  label: string;
  value: string;
  url: string;
  isDefault: boolean;
};

const ProviderSourceManager = ({primary, visible, onSourceChanged}: Props) => {
  const [sources, setSources] = useState<ProviderSource[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isDropdownFocused, setIsDropdownFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const defaultSource = useMemo(() => {
    return sources.find(item => item.isDefault) || sources[0];
  }, [sources]);

  const dropdownData: SourceDropdownItem[] = useMemo(
    () =>
      sources.map(source => ({
        label: source.author,
        value: source.author,
        url: source.url,
        isDefault: !!source.isDefault,
      })),
    [sources],
  );

  const reloadSources = () => {
    setSources(extensionStorage.getProviderSources());
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    const currentSources = extensionStorage.getProviderSources();
    setSources(currentSources);

    if (currentSources.length === 0) {
      setShowAddDialog(true);
    }
  }, [visible]);

  const handleSelectSource = async (source: ProviderSource) => {
    extensionStorage.setDefaultProviderSource(source.author);
    reloadSources();
    await onSourceChanged(extensionStorage.getProviderSource());
  };

  const handleConfirmAdd = async () => {
    try {
      const parsedSource = createProviderSource(inputValue);
      extensionStorage.addProviderSources(
        parsedSource.author,
        parsedSource.url,
      );
      extensionStorage.setDefaultProviderSource(parsedSource.author);
      setInputValue('');
      setShowAddDialog(false);
      reloadSources();
      await onSourceChanged(extensionStorage.getProviderSource());
    } catch (error) {
      Alert.alert(
        'Invalid source',
        'Enter a valid source URL or GitHub author.',
      );
    }
  };

  const handleRemoveSource = (author: string) => {
    if (sources.length <= 1) {
      Alert.alert('Cannot remove', 'At least one source must remain.');
      return;
    }

    Alert.alert('Remove source', `Remove ${author} from provider sources?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const installedForSource = extensionStorage
            .getInstalledProviders()
            .filter(provider => provider.source?.author === author);

          installedForSource.forEach(provider => {
            extensionStorage.uninstallProvider(provider.value, author);
          });

          extensionStorage.removeProviderSource(author);
          reloadSources();
          await onSourceChanged(extensionStorage.getProviderSource());
        },
      },
    ]);
  };

  if (!visible) {
    return null;
  }

  return (
    <View className="mx-4 mt-4">
      <View className="flex-row items-center gap-2">
        <View className="flex-1 bg-tertiary rounded-xl px-3 py-2 border border-quaternary">
          <View className="flex-row items-center mb-1">
            <Text className="text-gray-400 text-xs">Provider Source</Text>
            {defaultSource && (
              <MaterialCommunityIcons
                name="check-circle"
                size={14}
                color={primary}
                style={{marginLeft: 6}}
              />
            )}
          </View>

          <Dropdown
            style={{minHeight: 34}}
            data={dropdownData}
            labelField="label"
            valueField="value"
            value={defaultSource?.author}
            placeholder="Select a provider source"
            placeholderStyle={{color: '#9CA3AF'}}
            selectedTextStyle={{
              color: 'white',
              fontSize: 15,
              fontWeight: '600',
            }}
            containerStyle={{
              backgroundColor: '#171717',
              borderColor: '#2B2B2B',
              borderWidth: 1,
              borderRadius: 12,
              overflow: 'hidden',
            }}
            activeColor="#262626"
            itemContainerStyle={{backgroundColor: '#171717'}}
            iconStyle={{width: 20, height: 20}}
            onFocus={() => setIsDropdownFocused(true)}
            onBlur={() => setIsDropdownFocused(false)}
            onChange={item => {
              const selected = sources.find(
                source => source.author === item.value,
              );
              if (selected) {
                handleSelectSource(selected);
              }
            }}
            renderRightIcon={() => (
              <MaterialIcons
                name={isDropdownFocused ? 'expand-less' : 'expand-more'}
                size={22}
                color="#9CA3AF"
              />
            )}
            renderItem={item => {
              const isSelected = item.value === defaultSource?.author;
              return (
                <View className="px-4 py-3 border-b border-quaternary">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-white font-medium">
                        {item.label}
                      </Text>
                      <Text className="text-gray-400 text-xs" numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={primary}
                      />
                    )}
                    {!isSelected && (
                      <TouchableOpacity
                        onPress={() => handleRemoveSource(item.value)}>
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={20}
                          color="#F87171"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>

        <TouchableOpacity
          className="w-11 h-11 rounded-xl items-center justify-center"
          style={{backgroundColor: primary}}
          onPress={() => setShowAddDialog(true)}>
          <MaterialCommunityIcons name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showAddDialog}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAddDialog(false);
          setInputValue('');
        }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            className="flex-1 bg-black/70"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 24,
            }}
            keyboardShouldPersistTaps="handled">
            <View className="w-full bg-tertiary rounded-2xl p-4 border border-quaternary">
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className="text-white text-base font-semibold w-fit"
                  numberOfLines={1}>
                  Add Source
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddDialog(false);
                    setInputValue('');
                  }}>
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              <Text className="text-white text-sm font-medium">
                Enter source name or url to add provider
              </Text>
              <Text className="text-gray-400 text-sm mt-[4px]">
                How to get source url check instructions{' '}
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(socialLinks.github + '#vega-app')
                  }>
                  <Text className="text-blue-400 text-sm mt-[4.5px]">here</Text>
                </TouchableOpacity>
              </Text>
              <Text className="text-gray-400 text-sm mt-[4px]">
                or join Discord for support{' '}
                <TouchableOpacity
                  onPress={() => Linking.openURL(socialLinks.discord)}>
                  <Text className="text-blue-400 text-sm mt-[4.5px]">
                    Discord
                  </Text>
                </TouchableOpacity>
              </Text>
              <TextInput
                className="bg-quaternary rounded-lg px-4 py-3 text-white border border-gray-700 mt-3"
                placeholder=" "
                placeholderTextColor="#6B7280"
                value={inputValue}
                onChangeText={setInputValue}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View className="flex-row gap-2 mt-3">
                <TouchableOpacity
                  className="flex-1 rounded-lg px-4 py-3 items-center bg-gray-700"
                  onPress={() => {
                    setShowAddDialog(false);
                    setInputValue('');
                  }}>
                  <Text className="text-white font-medium">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 rounded-lg px-4 py-3 items-center"
                  style={{backgroundColor: primary}}
                  onPress={handleConfirmAdd}>
                  <Text className="text-white font-medium">Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default ProviderSourceManager;
