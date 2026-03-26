// Video Engine - Handles video/audio conversions using FFmpeg WASM

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type {
  ConversionOptions,
  ConversionResult,
  ProgressCallback,
} from '../core/types';
import { BaseEngine } from './base-engine';

export class VideoEngine extends BaseEngine {
  name = 'VideoEngine';
  category = 'video' as const;

  supportedInputFormats = [
    'mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv',
    'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a',
  ];

  supportedOutputFormats = [
    'mp4', 'webm', 'avi', 'mov', 'mkv', 'gif',
    'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a',
    'png', 'jpg',
  ];

  private ffmpeg: FFmpeg | null = null;
  private baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  async load(): Promise<void> {
    if (this._isLoaded && this.ffmpeg) return;

    this.ffmpeg = new FFmpeg();

    this.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    try {
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${this.baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${this.baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      this._isLoaded = true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      throw new Error('FFmpegの読み込みに失敗しました');
    }
  }

  async convert(
    input: File | Blob,
    outputFormat: string,
    options: ConversionOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    try {
      if (!this._isLoaded || !this.ffmpeg) {
        onProgress?.({ status: 'loading', message: 'FFmpegを読み込み中...', progress: 0 });
        await this.load();
      }

      // Set up progress handler
      this.ffmpeg!.on('progress', ({ progress }) => {
        const percent = Math.min(Math.round(progress * 100), 99);
        onProgress?.({ progress: percent, message: `変換中... ${percent}%` });
      });

      onProgress?.({ progress: 5, message: 'ファイルを準備中...' });

      // Generate filenames
      const inputExt = input instanceof File ? input.name.split('.').pop() : 'bin';
      const inputFileName = `input_${Date.now()}.${inputExt}`;
      const outputFileName = `output_${Date.now()}.${outputFormat}`;

      // Write input file
      await this.ffmpeg!.writeFile(inputFileName, await fetchFile(input));

      onProgress?.({ progress: 10, message: '変換を開始...' });

      // Build FFmpeg arguments
      const args = this.buildFFmpegArgs(inputFileName, outputFileName, outputFormat, options);

      // Execute conversion
      await this.ffmpeg!.exec(args);

      onProgress?.({ progress: 95, message: '出力ファイルを準備中...' });

      // Read output file
      const data = await this.ffmpeg!.readFile(outputFileName);
      const mimeType = this.getMimeType(outputFormat);
      const blob = new Blob([data], { type: mimeType });

      // Cleanup
      await this.ffmpeg!.deleteFile(inputFileName);
      await this.ffmpeg!.deleteFile(outputFileName);

      onProgress?.({ progress: 100, message: '完了!' });

      return this.createSuccessResult(blob);
    } catch (error) {
      console.error('Conversion error:', error);
      return this.createErrorResult(
        error instanceof Error ? error : new Error('変換に失敗しました')
      );
    }
  }

  private buildFFmpegArgs(
    input: string,
    output: string,
    format: string,
    options: ConversionOptions
  ): string[] {
    const baseArgs = ['-i', input];

    // Get quality settings
    const qualityArgs = this.getQualityArgs(format, options.quality);

    // Add resize if specified
    const resizeArgs = this.getResizeArgs(options.width, options.height);

    switch (format) {
      // Video formats
      case 'mp4':
        return [...baseArgs, '-c:v', 'libx264', '-preset', 'fast', ...qualityArgs, '-c:a', 'aac', '-b:a', '128k', ...resizeArgs, output];
      case 'webm':
        return [...baseArgs, '-c:v', 'libvpx-vp9', ...qualityArgs, '-c:a', 'libopus', ...resizeArgs, output];
      case 'avi':
        return [...baseArgs, '-c:v', 'mpeg4', ...qualityArgs, '-c:a', 'mp3', ...resizeArgs, output];
      case 'mov':
        return [...baseArgs, '-c:v', 'libx264', ...qualityArgs, '-c:a', 'aac', ...resizeArgs, output];
      case 'mkv':
        return [...baseArgs, '-c:v', 'libx264', ...qualityArgs, '-c:a', 'aac', ...resizeArgs, output];
      case 'gif':
        return [...baseArgs, '-vf', `fps=${options.fps || 15},scale=${options.width || 480}:-1:flags=lanczos`, '-loop', '0', output];

      // Audio formats
      case 'mp3':
        return [...baseArgs, '-vn', '-c:a', 'libmp3lame', ...this.getAudioQualityArgs('mp3', options.quality), output];
      case 'wav':
        return [...baseArgs, '-vn', '-c:a', 'pcm_s16le', output];
      case 'ogg':
        return [...baseArgs, '-vn', '-c:a', 'libvorbis', ...this.getAudioQualityArgs('ogg', options.quality), output];
      case 'aac':
        return [...baseArgs, '-vn', '-c:a', 'aac', ...this.getAudioQualityArgs('aac', options.quality), output];
      case 'flac':
        return [...baseArgs, '-vn', '-c:a', 'flac', output];
      case 'm4a':
        return [...baseArgs, '-vn', '-c:a', 'aac', ...this.getAudioQualityArgs('aac', options.quality), output];

      // Image extraction from video
      case 'png':
        return [...baseArgs, '-ss', '00:00:01', '-vframes', '1', ...resizeArgs, output];
      case 'jpg':
      case 'jpeg':
        return [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-q:v', '2', ...resizeArgs, output];

      default:
        return [...baseArgs, output];
    }
  }

  private getQualityArgs(format: string, quality?: 'low' | 'medium' | 'high' | 'lossless'): string[] {
    const videoFormats = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
    if (!videoFormats.includes(format)) return [];

    switch (quality) {
      case 'low':
        return ['-crf', '28'];
      case 'medium':
        return ['-crf', '23'];
      case 'high':
        return ['-crf', '18'];
      case 'lossless':
        return ['-crf', '0'];
      default:
        return ['-crf', '23'];
    }
  }

  private getAudioQualityArgs(format: string, quality?: 'low' | 'medium' | 'high' | 'lossless'): string[] {
    const bitrateMap = {
      low: '128k',
      medium: '192k',
      high: '256k',
      lossless: '320k',
    };

    const bitrate = bitrateMap[quality || 'medium'];

    if (format === 'mp3') {
      return ['-b:a', bitrate];
    } else if (format === 'ogg') {
      return ['-q:a', quality === 'low' ? '3' : quality === 'high' ? '7' : '5'];
    } else if (format === 'aac') {
      return ['-b:a', bitrate];
    }

    return [];
  }

  private getResizeArgs(width?: number, height?: number): string[] {
    if (!width && !height) return [];

    const w = width || -1;
    const h = height || -1;

    return ['-vf', `scale=${w}:${h}`];
  }

  unload(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
    }
    this._isLoaded = false;
  }
}

// Singleton instance
export const videoEngine = new VideoEngine();
