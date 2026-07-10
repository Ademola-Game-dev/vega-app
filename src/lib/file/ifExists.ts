import {settingsStorage} from '../storage';
import {findDownloadedFileByBaseName} from '../downloadLocation';

import {Platform} from 'react-native';

// check if file exists in download folder folder

export const ifExists = async (fileName: string) => {
  const result = await findDownloadedFileByBaseName(
    settingsStorage.getDownloadLocationConfig(),
    fileName,
  );
  if (!result) return false;
  if (typeof result === 'string' && result.startsWith('/') && Platform.OS === 'android') {
    return `file://${result}`;
  }
  return result;
};
