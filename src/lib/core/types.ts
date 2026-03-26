// Core types for Universal Converter

export type FileCategory = 'image' | 'video' | 'audio' | 'document';

export type ConversionStatus =
  | 'idle'
  | 'loading'
  | 'analyzing'
  | 'converting'
  | 'complete'
  | 'error';

export interface ConversionState {
  status: ConversionStatus;
  progress: number;
  message: string;
  outputUrl: string | null;
  outputFileName: string | null;
  error?: Error | null;
}

export interface FileInfo {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  extension: string;
  category: FileCategory | null;
  preview?: string;
}

export interface FormatOption {
  value: string;
  label: string;
  category: FileCategory;
  mimeType: string;
  description?: string;
}

export interface ConversionOptions {
  quality?: 'low' | 'medium' | 'high' | 'lossless';
  width?: number;
  height?: number;
  bitrate?: number;
  fps?: number;
  sampleRate?: number;
  channels?: number;
  preserveMetadata?: boolean;
}

export interface ConversionJob {
  id: string;
  fileInfo: FileInfo;
  targetFormat: string;
  options: ConversionOptions;
  state: ConversionState;
  startTime?: number;
  endTime?: number;
  outputBlob?: Blob;
}

export interface ConversionResult {
  success: boolean;
  blob?: Blob;
  url?: string;
  fileName?: string;
  error?: Error;
  duration?: number;
}

export interface ProgressCallback {
  (state: Partial<ConversionState>): void;
}

export interface WorkerMessage {
  type: 'init' | 'convert' | 'progress' | 'complete' | 'error' | 'cancel';
  payload?: unknown;
  jobId?: string;
}

export interface WorkerResponse {
  type: 'ready' | 'progress' | 'complete' | 'error';
  payload?: unknown;
  jobId?: string;
}

// Engine interface
export interface ConversionEngine {
  name: string;
  supportedInputFormats: string[];
  supportedOutputFormats: string[];
  isLoaded: boolean;
  load(): Promise<void>;
  convert(
    input: File | Blob,
    outputFormat: string,
    options?: ConversionOptions,
    onProgress?: ProgressCallback
  ): Promise<ConversionResult>;
  canConvert(inputFormat: string, outputFormat: string): boolean;
  unload(): void;
}

// OPFS types
export interface OPFSFile {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  handle?: FileSystemFileHandle;
}

export interface OPFSManager {
  isSupported: boolean;
  init(): Promise<void>;
  writeFile(path: string, data: ArrayBuffer | Blob): Promise<void>;
  readFile(path: string): Promise<ArrayBuffer>;
  deleteFile(path: string): Promise<void>;
  listFiles(directory?: string): Promise<OPFSFile[]>;
  getUsedSpace(): Promise<number>;
  clearAll(): Promise<void>;
}

// Supported formats registry
export const SUPPORTED_FORMATS: Record<FileCategory, FormatOption[]> = {
  image: [
    { value: 'png', label: 'PNG', category: 'image', mimeType: 'image/png', description: '可逆圧縮、透明対応' },
    { value: 'jpg', label: 'JPG', category: 'image', mimeType: 'image/jpeg', description: '写真向け、高圧縮' },
    { value: 'jpeg', label: 'JPEG', category: 'image', mimeType: 'image/jpeg', description: '写真向け、高圧縮' },
    { value: 'webp', label: 'WebP', category: 'image', mimeType: 'image/webp', description: '最新形式、高効率' },
    { value: 'gif', label: 'GIF', category: 'image', mimeType: 'image/gif', description: 'アニメーション対応' },
    { value: 'bmp', label: 'BMP', category: 'image', mimeType: 'image/bmp', description: '非圧縮ビットマップ' },
    { value: 'ico', label: 'ICO', category: 'image', mimeType: 'image/x-icon', description: 'アイコン形式' },
    { value: 'avif', label: 'AVIF', category: 'image', mimeType: 'image/avif', description: '次世代形式、超高圧縮' },
  ],
  video: [
    { value: 'mp4', label: 'MP4', category: 'video', mimeType: 'video/mp4', description: '標準形式、高互換性' },
    { value: 'webm', label: 'WebM', category: 'video', mimeType: 'video/webm', description: 'Web向け、高効率' },
    { value: 'avi', label: 'AVI', category: 'video', mimeType: 'video/x-msvideo', description: 'レガシー形式' },
    { value: 'mov', label: 'MOV', category: 'video', mimeType: 'video/quicktime', description: 'Apple形式' },
    { value: 'mkv', label: 'MKV', category: 'video', mimeType: 'video/x-matroska', description: '高機能コンテナ' },
    { value: 'gif', label: 'GIF', category: 'video', mimeType: 'image/gif', description: 'アニメーションGIF' },
  ],
  audio: [
    { value: 'mp3', label: 'MP3', category: 'audio', mimeType: 'audio/mpeg', description: '標準形式、高互換性' },
    { value: 'wav', label: 'WAV', category: 'audio', mimeType: 'audio/wav', description: '非圧縮、高品質' },
    { value: 'ogg', label: 'OGG', category: 'audio', mimeType: 'audio/ogg', description: 'オープン形式' },
    { value: 'aac', label: 'AAC', category: 'audio', mimeType: 'audio/aac', description: '高効率圧縮' },
    { value: 'flac', label: 'FLAC', category: 'audio', mimeType: 'audio/flac', description: '可逆圧縮、高品質' },
    { value: 'm4a', label: 'M4A', category: 'audio', mimeType: 'audio/mp4', description: 'AAC音声' },
    { value: 'wma', label: 'WMA', category: 'audio', mimeType: 'audio/x-ms-wma', description: 'Windows形式' },
  ],
  document: [
    { value: 'pdf', label: 'PDF', category: 'document', mimeType: 'application/pdf', description: 'ドキュメント標準' },
    { value: 'txt', label: 'TXT', category: 'document', mimeType: 'text/plain', description: 'プレーンテキスト' },
  ],
};

// MIME type mappings
export const MIME_TYPES: Record<string, string> = {
  // Image
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  wma: 'audio/x-ms-wma',
  // Document
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
};

// Utility functions
export function getMimeType(format: string): string {
  return MIME_TYPES[format.toLowerCase()] || 'application/octet-stream';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
