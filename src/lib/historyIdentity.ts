export interface HistoryEpisodeIdentity {
  id?: string;
  sourceLink?: string;
  link?: string;
}

export const getHistoryEpisodeId = (
  episode?: HistoryEpisodeIdentity,
): string | undefined => episode?.sourceLink || episode?.id || episode?.link;
