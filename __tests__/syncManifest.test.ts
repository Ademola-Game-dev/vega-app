import {
  getDownloadMediaKey,
  getTombstoneKey,
  mergeSyncManifests,
  parseSyncManifest,
  type VegaSyncManifest,
} from '../src/lib/sync/manifest';

const manifest = (
  deviceId: string,
  overrides: Partial<VegaSyncManifest> = {},
): VegaSyncManifest => ({
  schemaVersion: 1,
  deviceId,
  revision: 1,
  generatedAt: 1,
  downloads: {},
  history: {},
  watchlist: {},
  tombstones: {},
  ...overrides,
});

describe('Vega sync manifest', () => {
  it('uses the newest watch event even when progress moved backward', () => {
    const older = manifest('mobile', {
      history: {
        movie: {
          id: 'movie',
          title: 'Movie',
          link: 'movie',
          progress: 900,
          updatedAt: 10,
        },
      },
    });
    const newer = manifest('desktop', {
      history: {
        movie: {
          id: 'movie',
          title: 'Movie',
          link: 'movie',
          progress: 30,
          updatedAt: 20,
        },
      },
    });

    expect(mergeSyncManifests([older, newer]).history.movie.progress).toBe(30);
  });

  it('merges watchlist items from different devices', () => {
    const merged = mergeSyncManifests([
      manifest('mobile', {
        watchlist: {
          'mobile-link': {
            title: 'Mobile title',
            poster: 'mobile.jpg',
            link: 'mobile-link',
            provider: 'mobile-provider',
            updatedAt: 10,
          },
        },
      }),
      manifest('desktop', {
        watchlist: {
          'desktop-link': {
            title: 'Desktop title',
            poster: 'desktop.jpg',
            link: 'desktop-link',
            provider: 'desktop-provider',
            updatedAt: 20,
          },
        },
      }),
    ]);

    expect(Object.keys(merged.watchlist).sort()).toEqual([
      'desktop-link',
      'mobile-link',
    ]);
  });

  it('keeps a watchlist tombstone from resurrecting an older item', () => {
    const added = manifest('mobile', {
      watchlist: {
        movie: {
          title: 'Movie',
          poster: 'movie.jpg',
          link: 'movie',
          provider: 'provider',
          updatedAt: 10,
        },
      },
    });
    const removed = manifest('desktop', {
      tombstones: {
        [getTombstoneKey('watchlist', 'movie')]: {
          kind: 'watchlist',
          id: 'movie',
          deletedAt: 20,
        },
      },
    });

    expect(mergeSyncManifests([added, removed]).watchlist).toEqual({});
  });

  it('allows a newer watchlist add to replace an older removal', () => {
    const removed = manifest('mobile', {
      tombstones: {
        [getTombstoneKey('watchlist', 'movie')]: {
          kind: 'watchlist',
          id: 'movie',
          deletedAt: 10,
        },
      },
    });
    const readded = manifest('desktop', {
      watchlist: {
        movie: {
          title: 'Movie',
          poster: 'movie.jpg',
          link: 'movie',
          provider: 'provider',
          updatedAt: 20,
        },
      },
    });

    expect(mergeSyncManifests([removed, readded]).watchlist.movie).toEqual(
      readded.watchlist.movie,
    );
  });

  it('deduplicates different platform ids for the same episode', () => {
    const mobileEpisode = {
      id: 'Show_SSeason 1_E1',
      title: 'Show Season 1 Episode 1',
      showName: 'Show',
      episodeName: 'Episode 1',
      seasonTitle: 'Season 1',
      type: 'series' as const,
      imdbId: 'tt1234',
      provider: 'mobile-provider',
      relativePath: 'Episode_1.mp4',
      totalBytes: 100,
      completedAt: 10,
      updatedAt: 10,
    };
    const desktopEpisode = {
      ...mobileEpisode,
      id: 'Show_SSeason 1_E01',
      seasonTitle: '1',
      provider: 'desktop-provider',
      relativePath: 'show/Episode_1.mp4',
      updatedAt: 20,
    };

    const merged = mergeSyncManifests([
      manifest('mobile', {downloads: {mobile: mobileEpisode}}),
      manifest('desktop', {downloads: {desktop: desktopEpisode}}),
    ]);

    expect(Object.values(merged.downloads)).toEqual([
      {...desktopEpisode, mediaKey: getDownloadMediaKey(desktopEpisode)},
    ]);
  });

  it('keeps distinct direct-link series episodes separate', () => {
    const baseEpisode = {
      title: 'Show episode',
      showName: 'Show',
      episodeName: 'Pilot',
      seasonTitle: 'Season 1',
      type: 'series' as const,
      imdbId: 'tt1234',
      relativePath: 'show/episode.mp4',
      totalBytes: 100,
      completedAt: 10,
      updatedAt: 10,
    };

    expect(getDownloadMediaKey({...baseEpisode, id: 'Show_direct_0'})).not.toBe(
      getDownloadMediaKey({...baseEpisode, id: 'Show_direct_1'}),
    );
  });

  it('keeps a newer tombstone from resurrecting a download', () => {
    const completed = manifest('mobile', {
      downloads: {
        episode: {
          id: 'episode',
          title: 'Episode',
          type: 'series',
          relativePath: 'show/episode.mp4',
          totalBytes: 100,
          completedAt: 10,
          updatedAt: 10,
        },
      },
    });
    const deleted = manifest('desktop', {
      tombstones: {
        [getTombstoneKey('download', 'episode')]: {
          kind: 'download',
          id: 'episode',
          deletedAt: 20,
        },
      },
    });

    expect(mergeSyncManifests([completed, deleted]).downloads).toEqual({});
  });

  it('applies a canonical tombstone to a different platform id', () => {
    const episode = {
      id: 'desktop-id',
      title: 'Episode 1',
      showName: 'Show',
      episodeName: 'Episode 1',
      seasonTitle: 'Season 1',
      type: 'series' as const,
      imdbId: 'tt1234',
      relativePath: 'show/episode.mp4',
      totalBytes: 100,
      completedAt: 10,
      updatedAt: 10,
    };
    const mediaKey = getDownloadMediaKey(episode);
    const deleted = manifest('mobile', {
      tombstones: {
        'download:mobile-id': {
          kind: 'download',
          id: 'mobile-id',
          mediaKey,
          deletedAt: 20,
        },
      },
    });

    expect(
      mergeSyncManifests([manifest('desktop', {downloads: {episode}}), deleted])
        .downloads,
    ).toEqual({});
  });

  it('allows a newer completed event to replace an older deletion', () => {
    const deleted = manifest('mobile', {
      tombstones: {
        [getTombstoneKey('download', 'movie')]: {
          kind: 'download',
          id: 'movie',
          deletedAt: 10,
        },
      },
    });
    const completed = manifest('desktop', {
      downloads: {
        movie: {
          id: 'movie',
          title: 'Movie',
          type: 'movie',
          relativePath: 'movie.mp4',
          totalBytes: 100,
          completedAt: 20,
          updatedAt: 20,
        },
      },
    });

    expect(
      Object.values(mergeSyncManifests([deleted, completed]).downloads),
    ).toEqual([
      {
        ...completed.downloads.movie,
        mediaKey: getDownloadMediaKey(completed.downloads.movie),
      },
    ]);
  });

  it('ignores malformed or unsupported manifests', () => {
    expect(parseSyncManifest('{bad json')).toBeNull();
    expect(parseSyncManifest('{"schemaVersion":2}')).toBeNull();
  });

  it('accepts older manifests without a watchlist field', () => {
    const legacyManifest = manifest('legacy');
    delete legacyManifest.watchlist;

    expect(parseSyncManifest(JSON.stringify(legacyManifest))).toEqual(
      legacyManifest,
    );
    expect(mergeSyncManifests([legacyManifest]).watchlist).toEqual({});
  });

  it('recovers the first complete manifest from appended stale bytes', () => {
    const valid = JSON.stringify(manifest('mobile', {revision: 20}));
    expect(
      parseSyncManifest(`${valid}stale old json fragments}}}`)?.revision,
    ).toBe(20);
  });

  it('recomputes stale stored media keys while merging', () => {
    const episode = {
      id: 'Show_SSeason 7_E1',
      title: 'Episode 1',
      showName: 'Show',
      episodeName: 'Episode 1',
      seasonTitle: 'Season 7',
      type: 'series' as const,
      imdbId: 'tt1234',
      relativePath: 'show/episode.mp4',
      totalBytes: 100,
      completedAt: 10,
      updatedAt: 10,
      mediaKey: 'series:tt1234:7:1',
    };
    const merged = mergeSyncManifests([
      manifest('mobile', {downloads: {episode}}),
    ]);

    expect(Object.keys(merged.downloads)).toEqual(['series:tt1234:7:e1']);
  });
});
