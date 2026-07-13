import {
  groupCompletedDownloads,
  sortDownloadedEpisodes,
} from '../src/lib/downloadLibrary';
import type {DownloadItem} from '../src/lib/zustand/downloadsStore';

const createItem = (update: Partial<DownloadItem>): DownloadItem => ({
  schemaVersion: 1,
  id: 'item',
  title: 'Title',
  type: 'series',
  url: 'https://example.com/video',
  sourceType: 'http',
  isTorrent: false,
  filePath: 'content://downloads/item',
  totalBytes: 100,
  downloadedBytes: 100,
  speed: 0,
  status: 'completed',
  canPause: false,
  canResume: false,
  createdAt: 1,
  updatedAt: 1,
  ...update,
});

describe('downloaded library grouping', () => {
  it('groups series by stored media metadata instead of filename', () => {
    const groups = groupCompletedDownloads([
      createItem({
        id: 'Show_SSeason 1_E2',
        showName: 'Show',
        episodeName: 'Second',
      }),
      createItem({
        id: 'Show_SSeason 1_E1',
        showName: 'Show',
        episodeName: 'First',
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Show');
    expect(groups[0].items[0]).toMatchObject({
      showName: 'Show',
      episodeName: 'First',
    });
    expect(groups[0].items.map(item => item.episodeName)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('groups the same series when provider and IMDb metadata differ', () => {
    const groups = groupCompletedDownloads([
      createItem({
        id: 'Show_SSeason 7_E1',
        showName: 'Rick and Morty',
        seasonTitle: 'Season 7',
        imdbId: 'tt2861424',
        provider: 'vega',
      }),
      createItem({
        id: 'Show_SSeason 9_E1',
        showName: 'Rick and Morty',
        seasonTitle: 'Season 9',
        imdbId: undefined,
        provider: 'torrentio',
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'series:rick-and-morty',
      title: 'Rick and Morty',
    });
    expect(groups[0].items).toHaveLength(2);
  });

  it('keeps movies as independent library entries', () => {
    const groups = groupCompletedDownloads([
      createItem({id: 'Movie_direct_0', title: 'Movie', type: 'movie'}),
      createItem({id: 'Movie_direct_1', title: 'Movie', type: 'movie'}),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('sorts episodes using the stable download ID', () => {
    const sorted = sortDownloadedEpisodes([
      createItem({id: 'Show_SSeason 2_E1', seasonTitle: 'Season 2'}),
      createItem({id: 'Show_SSeason 1_E3', seasonTitle: 'Season 1'}),
    ]);
    expect(sorted.map(item => item.id)).toEqual([
      'Show_SSeason 1_E3',
      'Show_SSeason 2_E1',
    ]);
  });
});
