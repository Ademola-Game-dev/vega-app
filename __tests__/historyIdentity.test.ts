import {getHistoryEpisodeId} from '../src/lib/historyIdentity';

describe('history episode identity', () => {
  it('prefers the portable source link over local ids and file paths', () => {
    expect(
      getHistoryEpisodeId({
        id: 'local-download-id',
        sourceLink: 'https://provider.example/episode-3',
        link: 'content://local-file',
      }),
    ).toBe('https://provider.example/episode-3');
  });

  it('falls back to the download id and then the playback link', () => {
    expect(getHistoryEpisodeId({id: 'download-id', link: 'local-file'})).toBe(
      'download-id',
    );
    expect(getHistoryEpisodeId({link: 'local-file'})).toBe('local-file');
  });
});
