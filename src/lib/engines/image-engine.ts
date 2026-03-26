// Image Engine - Handles image format conversions using Canvas API

import type {
  ConversionOptions,
  ConversionResult,
  ProgressCallback,
} from '../core/types';
import { BaseEngine } from './base-engine';

export class ImageEngine extends BaseEngine {
  name = 'ImageEngine';
  category = 'image' as const;

  supportedInputFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'];
  supportedOutputFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  async load(): Promise<void> {
    if (this._isLoaded) return;

    // Create offscreen canvas for conversion
    if (typeof OffscreenCanvas !== 'undefined') {
      // Use OffscreenCanvas if available (better performance)
      this.canvas = document.createElement('canvas');
    } else {
      this.canvas = document.createElement('canvas');
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get canvas context');
    }

    this._isLoaded = true;
  }

  async convert(
    input: File | Blob,
    outputFormat: string,
    options: ConversionOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    try {
      if (!this._isLoaded) {
        await this.load();
      }

      onProgress?.({ progress: 10, message: '画像を読み込み中...' });

      // Load image
      const img = await this.loadImage(input);

      onProgress?.({ progress: 30, message: '画像を処理中...' });

      // Calculate output dimensions
      let { width, height } = this.calculateDimensions(
        img.width,
        img.height,
        options.width,
        options.height
      );

      // Set canvas size
      this.canvas!.width = width;
      this.canvas!.height = height;

      // Draw image
      this.ctx!.clearRect(0, 0, width, height);
      this.ctx!.drawImage(img, 0, 0, width, height);

      onProgress?.({ progress: 60, message: '形式を変換中...' });

      // Convert to output format
      const blob = await this.canvasToBlob(outputFormat, options.quality);

      onProgress?.({ progress: 100, message: '完了!' });

      return this.createSuccessResult(blob);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error : new Error('画像変換に失敗しました')
      );
    }
  }

  private loadImage(source: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(source);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = url;
    });
  }

  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    targetWidth?: number,
    targetHeight?: number
  ): { width: number; height: number } {
    if (!targetWidth && !targetHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    if (targetWidth && targetHeight) {
      return { width: targetWidth, height: targetHeight };
    }

    if (targetWidth) {
      return {
        width: targetWidth,
        height: Math.round(targetWidth / aspectRatio),
      };
    }

    if (targetHeight) {
      return {
        width: Math.round(targetHeight * aspectRatio),
        height: targetHeight,
      };
    }

    return { width: originalWidth, height: originalHeight };
  }

  private async canvasToBlob(
    format: string,
    quality?: 'low' | 'medium' | 'high' | 'lossless'
  ): Promise<Blob> {
    const mimeType = this.getMimeType(format);
    const qualityValue = this.getQualityValue(format, quality);

    return new Promise((resolve, reject) => {
      this.canvas!.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Blobの生成に失敗しました'));
          }
        },
        mimeType,
        qualityValue
      );
    });
  }

  private getQualityValue(
    format: string,
    quality?: 'low' | 'medium' | 'high' | 'lossless'
  ): number | undefined {
    // Only JPEG and WebP support quality parameter
    if (!['jpg', 'jpeg', 'webp'].includes(format.toLowerCase())) {
      return undefined;
    }

    switch (quality) {
      case 'low':
        return 0.6;
      case 'medium':
        return 0.8;
      case 'high':
        return 0.92;
      case 'lossless':
        return 1.0;
      default:
        return 0.9;
    }
  }

  unload(): void {
    this.canvas = null;
    this.ctx = null;
    this._isLoaded = false;
  }
}

// Singleton instance
export const imageEngine = new ImageEngine();
