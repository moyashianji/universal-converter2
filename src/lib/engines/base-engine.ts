// Base Engine - Abstract base class for conversion engines

import type {
  ConversionOptions,
  ConversionResult,
  ProgressCallback,
  FileCategory,
} from '../core/types';

export abstract class BaseEngine {
  abstract name: string;
  abstract category: FileCategory;
  abstract supportedInputFormats: string[];
  abstract supportedOutputFormats: string[];

  protected _isLoaded = false;

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Load any required resources (WASM, workers, etc.)
   */
  abstract load(): Promise<void>;

  /**
   * Perform the conversion
   */
  abstract convert(
    input: File | Blob,
    outputFormat: string,
    options?: ConversionOptions,
    onProgress?: ProgressCallback
  ): Promise<ConversionResult>;

  /**
   * Check if this engine can handle the conversion
   */
  canConvert(inputFormat: string, outputFormat: string): boolean {
    const normalizedInput = inputFormat.toLowerCase();
    const normalizedOutput = outputFormat.toLowerCase();

    return (
      this.supportedInputFormats.includes(normalizedInput) &&
      this.supportedOutputFormats.includes(normalizedOutput)
    );
  }

  /**
   * Unload resources
   */
  unload(): void {
    this._isLoaded = false;
  }

  /**
   * Helper to create a successful result
   */
  protected createSuccessResult(blob: Blob): ConversionResult {
    return {
      success: true,
      blob,
      url: URL.createObjectURL(blob),
    };
  }

  /**
   * Helper to create an error result
   */
  protected createErrorResult(error: Error | string): ConversionResult {
    const err = typeof error === 'string' ? new Error(error) : error;
    return {
      success: false,
      error: err,
    };
  }

  /**
   * Helper to read file as ArrayBuffer
   */
  protected async fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
    return await file.arrayBuffer();
  }

  /**
   * Helper to read file as Data URL
   */
  protected async fileToDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Helper to get MIME type for format
   */
  protected getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      // Images
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      avif: 'image/avif',
      // Video
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      // Document
      pdf: 'application/pdf',
      txt: 'text/plain',
    };
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }
}
