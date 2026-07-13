import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockFiles = new Map<string, number>();
const mockDirectories = new Set<string>();
const mockSafFiles = new Map<string, number>();
const mockSafDirectories = new Set<string>();

const getSafChildren = (parent: string) =>
  [
    ...[...mockSafDirectories].filter(uri => uri.startsWith(`${parent}/`)),
    ...[...mockSafFiles.keys()].filter(uri => uri.startsWith(`${parent}/`)),
  ].filter(uri => !uri.slice(parent.length + 1).includes('/'));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: async (path: string) =>
    mockFiles.has(path) || mockDirectories.has(path),
  mkdir: async (path: string) => mockDirectories.add(path),
  unlink: async (path: string) => {
    mockFiles.delete(path);
    mockDirectories.delete(path);
    for (const key of [...mockFiles.keys()]) {
      if (key.startsWith(`${path}/`)) {
        mockFiles.delete(key);
      }
    }
  },
  stat: async (path: string) => ({size: mockFiles.get(path) ?? 0}),
  moveFile: async (from: string, to: string) => {
    const size = mockFiles.get(from) ?? 0;
    mockFiles.delete(from);
    mockFiles.set(to, size);
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: async (directory: string) => getSafChildren(directory),
    makeDirectoryAsync: async (parent: string, name: string) => {
      const uri = `${parent}/${name}`;
      mockSafDirectories.add(uri);
      return uri;
    },
    createFileAsync: async (directory: string, name: string) => {
      const uri = `${directory}/${name}`;
      mockSafFiles.set(uri, 0);
      return uri;
    },
    deleteAsync: async (uri: string) => {
      mockSafFiles.delete(uri);
      mockSafDirectories.delete(uri);
    },
  },
  getInfoAsync: async (uri: string) => ({
    exists: mockSafFiles.has(uri),
    size: mockSafFiles.get(uri),
  }),
}));

jest.mock('react-native', () => ({
  NativeModules: {
    SafCopyModule: {
      copyFileToUri: async (from: string, uri: string) => {
        mockSafFiles.set(uri, mockFiles.get(from) ?? 0);
      },
      getUriSize: async (uri: string) => mockSafFiles.get(uri) ?? -1,
    },
  },
}));

import {
  deleteDownloadOutput,
  finalizeDownloadOutput,
  getDownloadStagingDirectory,
  prepareDownloadDestination,
} from '../src/lib/downloadDestination';

describe('download destination service', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockSafFiles.clear();
    mockSafDirectories.clear();
  });

  it('creates an isolated staging directory for each download ID', async () => {
    const first = await prepareDownloadDestination({
      downloadId: 'Show_SSeason 1_E1',
      location: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      fileName: 'episode_one',
      fileType: 'mp4',
    });
    const second = await prepareDownloadDestination({
      downloadId: 'Show_SSeason 1_E2',
      location: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      fileName: 'episode_two',
      fileType: 'mp4',
    });

    expect(first.stagingDirectory).not.toBe(second.stagingDirectory);
    expect(first.stagingPath).toContain('Show_SSeason_1_E1');
  });

  it('rejects a path destination', async () => {
    const stagingPath = '/cache/downloads/movie/movie.mp4.part';
    mockDirectories.add('/cache/downloads/movie');
    mockDirectories.add('/downloads');
    mockFiles.set(stagingPath, 1024);

    await expect(
      finalizeDownloadOutput({
        downloadId: 'movie',
        location: {type: 'path', path: '/downloads'},
        stagingPath,
        fileName: 'movie',
        fileType: 'mp4',
      }),
    ).rejects.toThrow('SAF download location is required');
  });

  it('copies and verifies a SAF destination', async () => {
    const downloadId = 'movie';
    const stagingDirectory = getDownloadStagingDirectory(downloadId);
    const stagingPath = `${stagingDirectory}/movie.mp4.part`;
    mockDirectories.add(stagingDirectory);
    mockFiles.set(stagingPath, 2048);

    const output = await finalizeDownloadOutput({
      downloadId,
      location: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      stagingPath,
      fileName: 'movie',
      fileType: 'mp4',
    });

    expect(output).toEqual({
      filePath: 'content://downloads/tree/movie.mp4',
      finalDocumentUri: 'content://downloads/tree/movie.mp4',
      size: 2048,
    });
  });

  it('writes series into show and season subfolders', async () => {
    const stagingPath = '/cache/downloads/show/episode.mp4.part';
    mockFiles.set(stagingPath, 2048);

    const output = await finalizeDownloadOutput({
      downloadId: 'show-season-episode',
      location: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      stagingPath,
      fileName: 'Episode_1',
      fileType: 'mp4',
      outputDirectoryNames: ['show', 'season_1'],
    });

    expect(output.filePath).toBe(
      'content://downloads/tree/show/season_1/Episode_1.mp4',
    );
  });

  it('removes empty season and show directories after deletion', async () => {
    const showUri = 'content://downloads/tree/show';
    const seasonUri = `${showUri}/season_1`;
    const fileUri = `${seasonUri}/Episode_1.mp4`;
    mockSafDirectories.add(showUri);
    mockSafDirectories.add(seasonUri);
    mockSafFiles.set(fileUri, 100);

    await deleteDownloadOutput(fileUri, {
      downloadLocation: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      outputDirectoryNames: ['show', 'season_1'],
    });

    expect(mockSafFiles.has(fileUri)).toBe(false);
    expect(mockSafDirectories.has(seasonUri)).toBe(false);
    expect(mockSafDirectories.has(showUri)).toBe(false);
  });

  it('succeeds when the SAF file was already deleted manually', async () => {
    const showUri = 'content://downloads/tree/show';
    const seasonUri = `${showUri}/season_1`;
    const fileUri = `${seasonUri}/Episode_1.mp4`;
    mockSafDirectories.add(showUri);
    mockSafDirectories.add(seasonUri);

    await expect(
      deleteDownloadOutput(fileUri, {
        downloadLocation: {
          type: 'saf',
          uri: 'content://downloads/tree',
          label: 'Downloads',
        },
        outputDirectoryNames: ['show', 'season_1'],
      }),
    ).resolves.toBe(true);

    expect(mockSafDirectories.has(seasonUri)).toBe(false);
    expect(mockSafDirectories.has(showUri)).toBe(false);
  });

  it('succeeds when the local file was already deleted manually', async () => {
    await expect(deleteDownloadOutput('/downloads/missing.mp4')).resolves.toBe(
      true,
    );
  });

  it('keeps non-empty season and show directories after deletion', async () => {
    const showUri = 'content://downloads/tree/show';
    const seasonUri = `${showUri}/season_1`;
    const fileUri = `${seasonUri}/Episode_1.mp4`;
    mockSafDirectories.add(showUri);
    mockSafDirectories.add(seasonUri);
    mockSafFiles.set(fileUri, 100);
    mockSafFiles.set(`${seasonUri}/Episode_2.mp4`, 100);

    await deleteDownloadOutput(fileUri, {
      downloadLocation: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      outputDirectoryNames: ['show', 'season_1'],
    });

    expect(mockSafDirectories.has(seasonUri)).toBe(true);
    expect(mockSafDirectories.has(showUri)).toBe(true);
  });

  it('removes an empty season but keeps a show containing another season', async () => {
    const showUri = 'content://downloads/tree/show';
    const seasonOneUri = `${showUri}/season_1`;
    const seasonTwoUri = `${showUri}/season_2`;
    const fileUri = `${seasonOneUri}/Episode_1.mp4`;
    mockSafDirectories.add(showUri);
    mockSafDirectories.add(seasonOneUri);
    mockSafDirectories.add(seasonTwoUri);
    mockSafFiles.set(fileUri, 100);
    mockSafFiles.set(`${seasonTwoUri}/Episode_1.mp4`, 100);

    await deleteDownloadOutput(fileUri, {
      downloadLocation: {
        type: 'saf',
        uri: 'content://downloads/tree',
        label: 'Downloads',
      },
      outputDirectoryNames: ['show', 'season_1'],
    });

    expect(mockSafDirectories.has(seasonOneUri)).toBe(false);
    expect(mockSafDirectories.has(showUri)).toBe(true);
    expect(mockSafDirectories.has(seasonTwoUri)).toBe(true);
  });

  it('rejects empty staging files', async () => {
    const stagingPath = '/cache/downloads/movie/movie.mp4.part';
    mockFiles.set(stagingPath, 0);

    await expect(
      finalizeDownloadOutput({
        downloadId: 'movie',
        location: {
          type: 'saf',
          uri: 'content://downloads/tree',
          label: 'Downloads',
        },
        stagingPath,
        fileName: 'movie',
        fileType: 'mp4',
      }),
    ).rejects.toThrow('Downloaded staging file is empty');
  });
});
