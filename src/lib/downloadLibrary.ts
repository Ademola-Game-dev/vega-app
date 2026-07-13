import type {DownloadItem} from './zustand/downloadsStore';

export interface DownloadedMediaGroup {
  id: string;
  title: string;
  type: 'movie' | 'series';
  poster?: string;
  items: DownloadItem[];
}

const getSeriesGroupId = (item: DownloadItem): string =>
  `series:${(item.showName || item.title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

const getLegacyEpisodeNumber = (item: DownloadItem): number => {
  const source = item.episodeName || item.displayFileName || item.title;
  const match = source.match(/(?:episode|ep|e)[\s_.-]*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

const getSeasonNumber = (item: DownloadItem): number => {
  const match = item.seasonTitle?.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const getEpisodeNumber = (item: DownloadItem): number => {
  const idMatch = item.id.match(/_E(\d+)$/);
  if (idMatch) {
    return Number(idMatch[1]);
  }
  return item.legacy ? getLegacyEpisodeNumber(item) : 0;
};

export const sortDownloadedEpisodes = (items: DownloadItem[]): DownloadItem[] =>
  [...items].sort((a, b) => {
    const seasonDifference = getSeasonNumber(a) - getSeasonNumber(b);
    if (seasonDifference !== 0) {
      return seasonDifference;
    }
    const episodeDifference = getEpisodeNumber(a) - getEpisodeNumber(b);
    return episodeDifference || a.createdAt - b.createdAt;
  });

export const groupCompletedDownloads = (
  items: DownloadItem[],
): DownloadedMediaGroup[] => {
  const groups = new Map<string, DownloadedMediaGroup>();

  items.forEach(item => {
    const groupId = item.type === 'series' ? getSeriesGroupId(item) : item.id;
    const existing = groups.get(groupId);
    if (existing) {
      existing.items.push(item);
      return;
    }
    groups.set(groupId, {
      id: groupId,
      title: item.type === 'series' ? item.showName || item.title : item.title,
      type: item.type,
      poster: item.poster,
      items: [item],
    });
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      items:
        group.type === 'series'
          ? sortDownloadedEpisodes(group.items)
          : group.items,
    }))
    .sort((a, b) => {
      const aCompleted = Math.max(
        ...a.items.map(item => item.completedAt || 0),
      );
      const bCompleted = Math.max(
        ...b.items.map(item => item.completedAt || 0),
      );
      return bCompleted - aCompleted;
    });
};
