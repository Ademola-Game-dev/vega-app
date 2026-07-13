export const createSeriesDownloadId = (
  baseTitle: string,
  seasonTitle: string,
  episodeIndex: number,
): string => `${baseTitle}_S${seasonTitle}_E${episodeIndex + 1}`;

export const createDirectDownloadId = (
  baseTitle: string,
  linkIndex: number,
): string => `${baseTitle}_direct_${linkIndex}`;

const MAX_FILE_NAME_LENGTH = 160;

export const sanitizeDownloadFileName = (value: string): string => {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_FILE_NAME_LENGTH);

  return sanitized || 'download';
};

export const createDownloadFileName = (
  downloadId: string,
  episodeName?: string,
): string => sanitizeDownloadFileName(episodeName || downloadId);

export const createDownloadDirectoryName = (title: string): string =>
  title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'download';

export const createDownloadSeasonDirectoryName = (
  seasonTitle?: string,
): string | undefined =>
  seasonTitle ? createDownloadDirectoryName(seasonTitle) : undefined;

export const createDesktopCompatibleFileName = (
  title: string,
  type: 'movie' | 'series',
): string =>
  type === 'movie'
    ? createDownloadDirectoryName(title)
    : title.replace(/[^a-z0-9]/gi, '_') || 'download';

export const createSubtitleFileName = (
  videoFileName: string,
  subtitleTitle: string,
): string =>
  `${sanitizeDownloadFileName(videoFileName)}-${sanitizeDownloadFileName(
    subtitleTitle,
  )}`;
