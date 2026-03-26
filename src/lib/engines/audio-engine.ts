// Audio Engine - Handles audio conversions using Web Audio API and FFmpeg

import type {
  ConversionOptions,
  ConversionResult,
  ProgressCallback,
} from '../core/types';
import { BaseEngine } from './base-engine';
import { videoEngine } from './video-engine';

export class AudioEngine extends BaseEngine {
  name = 'AudioEngine';
  category = 'audio' as const;

  supportedInputFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma', 'opus'];
  supportedOutputFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];

  private audioContext: AudioContext | null = null;

  async load(): Promise<void> {
    if (this._isLoaded) return;

    // Initialize Web Audio API context
    this.audioContext = new AudioContext();

    // Also ensure video engine is available for complex conversions
    if (!videoEngine.isLoaded) {
      await videoEngine.load();
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
        onProgress?.({ status: 'loading', message: 'オーディオエンジンを読み込み中...', progress: 0 });
        await this.load();
      }

      // For WAV output, we can use Web Audio API directly
      if (outputFormat === 'wav') {
        return await this.convertToWav(input, options, onProgress);
      }

      // For other formats, delegate to video engine (FFmpeg)
      return await videoEngine.convert(input, outputFormat, options, onProgress);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error : new Error('音声変換に失敗しました')
      );
    }
  }

  private async convertToWav(
    input: File | Blob,
    options: ConversionOptions,
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    try {
      onProgress?.({ progress: 10, message: '音声を読み込み中...' });

      // Decode audio
      const arrayBuffer = await input.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

      onProgress?.({ progress: 40, message: 'WAV形式に変換中...' });

      // Apply sample rate conversion if specified
      let processedBuffer = audioBuffer;
      if (options.sampleRate && options.sampleRate !== audioBuffer.sampleRate) {
        processedBuffer = await this.resampleAudio(audioBuffer, options.sampleRate);
      }

      onProgress?.({ progress: 70, message: 'ファイルを生成中...' });

      // Encode to WAV
      const wavBlob = this.encodeWav(processedBuffer, options.channels);

      onProgress?.({ progress: 100, message: '完了!' });

      return this.createSuccessResult(wavBlob);
    } catch (error) {
      throw error;
    }
  }

  private async resampleAudio(
    audioBuffer: AudioBuffer,
    targetSampleRate: number
  ): Promise<AudioBuffer> {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    return await offlineContext.startRendering();
  }

  private encodeWav(audioBuffer: AudioBuffer, channels?: number): Blob {
    const numChannels = channels || audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    // Interleave channels
    const interleaved = this.interleaveChannels(audioBuffer, numChannels);

    // Create WAV file
    const buffer = new ArrayBuffer(44 + interleaved.length * 2);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + interleaved.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, interleaved.length * 2, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
      const sample = Math.max(-1, Math.min(1, interleaved[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private interleaveChannels(audioBuffer: AudioBuffer, numChannels: number): Float32Array {
    const length = audioBuffer.length;
    const result = new Float32Array(length * numChannels);

    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(audioBuffer.getChannelData(Math.min(i, audioBuffer.numberOfChannels - 1)));
    }

    let index = 0;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        result[index++] = channels[ch][i];
      }
    }

    return result;
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Analyze audio file and get metadata
   */
  async analyzeAudio(input: File | Blob): Promise<{
    duration: number;
    sampleRate: number;
    numberOfChannels: number;
  }> {
    if (!this._isLoaded) {
      await this.load();
    }

    const arrayBuffer = await input.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
    };
  }

  unload(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this._isLoaded = false;
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
