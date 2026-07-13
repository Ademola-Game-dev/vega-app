import type {PreparedDownloadDestination} from '../downloadDestination';
import type {DownloadItem} from '../zustand/downloadsStore';

export interface DownloadBackendContext {
  record: DownloadItem;
  destination: PreparedDownloadDestination;
}

export interface DownloadBackend {
  start(context: DownloadBackendContext): Promise<void>;
  pause?(downloadId: string): Promise<void>;
  resume?(downloadId: string): Promise<void>;
  cancel(downloadId: string): Promise<void>;
  cleanup(downloadId: string): Promise<void>;
}
