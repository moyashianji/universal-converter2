/**
 * Ultimate Universal File Converter
 *
 * Priority order (fastest to slowest):
 * 1. WebCodecs API - GPU/hardware accelerated (video)
 * 2. Canvas API - Native browser (images)
 * 3. Web Audio API - Native browser (audio)
 * 4. FFmpeg.wasm - Full format support (fallback)
 *
 * Zero download for common formats, instant conversion
 */

import { convertImage, isImageFile, getSupportedImageFormats } from './image-converter';
import {
	isWebCodecsSupported,
	convertVideoWithWebCodecs,
	extractAudioFast,
	extractFrameFast,
	WEBCODECS_VIDEO_OUTPUTS,
	WEBCODECS_AUDIO_OUTPUTS,
	WEBCODECS_IMAGE_OUTPUTS
} from './webcodecs-converter';
import {
	isPipelineSupported,
	isPipelineCompatible,
	convertWithPipeline
} from './webcodecs-pipeline';
import {
	initFFmpeg,
	convertWithFFmpeg,
	isFFmpegAvailable,
	isFFmpegLoaded,
	FFMPEG_VIDEO_FORMATS,
	FFMPEG_AUDIO_FORMATS
} from './ffmpeg-converter';
import { COMMON_IMAGE_OUTPUTS, COMMON_VIDEO_OUTPUTS, COMMON_AUDIO_OUTPUTS } from './formats';

export type FileType = 'image' | 'audio' | 'video' | 'document' | null;
export type ConversionStatus = 'idle' | 'loading' | 'converting' | 'complete' | 'error';
export type ConversionMethod = 'pipeline' | 'webcodecs' | 'canvas' | 'webaudio' | 'ffmpeg';

export interface ConversionState {
	status: ConversionStatus;
	progress: number;
	message: string;
	outputUrl: string | null;
	outputFileName: string | null;
	method?: ConversionMethod;
}

export type ProgressCallback = (state: Partial<ConversionState>) => void;

// File type detection
export function detectFileType(file: File): FileType {
	const mimeType = file.type.toLowerCase();
	const ext = file.name.split('.').pop()?.toLowerCase() || '';

	if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'avif', 'heic', 'heif', 'svg', 'tga', 'psd'].includes(ext)) {
		return 'image';
	}
	if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma', 'opus', 'aiff', 'ape', 'ac3', 'amr'].includes(ext)) {
		return 'audio';
	}
	if (mimeType.startsWith('video/') || ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv', '3gp', 'ts', 'mts', 'm2ts', 'vob', 'm4v', 'mpg', 'mpeg', 'ogv'].includes(ext)) {
		return 'video';
	}
	if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
		return 'document';
	}

	return null;
}

// Get available output formats based on file type and available APIs
export function getOutputFormats(fileType: FileType): string[] {
	const webCodecsAvailable = isWebCodecsSupported();
	const ffmpegAvailable = isFFmpegAvailable();

	switch (fileType) {
		case 'image':
			// Canvas API handles all common image formats
			// Return expanded list from formats.ts
			return [...COMMON_IMAGE_OUTPUTS];

		case 'audio':
			// Web Audio API for WAV, FFmpeg for others
			if (ffmpegAvailable) {
				return [...COMMON_AUDIO_OUTPUTS];
			}
			return ['wav']; // Native only

		case 'video':
			const formats = new Set<string>();

			// WebCodecs formats (fastest)
			if (webCodecsAvailable) {
				WEBCODECS_VIDEO_OUTPUTS.forEach(f => formats.add(f));
			}

			// FFmpeg formats (full support) - expanded list
			if (ffmpegAvailable) {
				COMMON_VIDEO_OUTPUTS.forEach(f => formats.add(f));
			}

			// Always available: frame/audio extraction
			['png', 'jpg', 'webp', 'wav'].forEach(f => formats.add(f));

			// Audio extraction with FFmpeg
			if (ffmpegAvailable) {
				COMMON_AUDIO_OUTPUTS.forEach(f => formats.add(f));
			}

			return Array.from(formats);

		case 'document':
			return ['txt'];

		default:
			return [];
	}
}

// Determine best conversion method
// file parameter is needed for pipeline compatibility check
function selectBestMethod(fileType: FileType, outputFormat: string, file?: File): ConversionMethod {
	const pipelineAvailable = isPipelineSupported();

	// Images: always Canvas (fastest)
	if (fileType === 'image') {
		return 'canvas';
	}

	// Video to video (MP4/WebM): prefer true WebCodecs pipeline (10-100x faster)
	// Pipeline requires MP4/MOV input (ISO BMFF container)
	if (
		fileType === 'video' &&
		['mp4', 'webm'].includes(outputFormat) &&
		pipelineAvailable &&
		file && isPipelineCompatible(file)
	) {
		return 'pipeline';
	}

	// Video to video: fallback to Canvas+MediaRecorder approach
	if (fileType === 'video' && ['mp4', 'webm'].includes(outputFormat) && isWebCodecsSupported()) {
		return 'webcodecs';
	}

	// Video to image: frame extraction
	if (fileType === 'video' && ['png', 'jpg', 'webp'].includes(outputFormat)) {
		return 'webcodecs';
	}

	// Video/Audio to WAV: Web Audio API
	if (['video', 'audio'].includes(fileType!) && outputFormat === 'wav') {
		return 'webaudio';
	}

	// Everything else: FFmpeg
	return 'ffmpeg';
}

// Main conversion function
export async function convertFile(
	file: File,
	outputFormat: string,
	onProgress?: ProgressCallback
): Promise<{ url: string; fileName: string }> {
	const fileType = detectFileType(file);
	const method = selectBestMethod(fileType, outputFormat, file);

	const methodNames: Record<ConversionMethod, string> = {
		pipeline: 'WebCodecs Pipeline',
		webcodecs: 'WebCodecs',
		canvas: 'ネイティブ',
		webaudio: 'ネイティブ',
		ffmpeg: 'FFmpeg'
	};

	onProgress?.({
		status: 'converting',
		progress: 0,
		message: `${methodNames[method]}エンジンで変換開始...`,
		method
	});

	try {
		let result: { blob: Blob; fileName: string };

		switch (method) {
			case 'pipeline':
				// True WebCodecs pipeline (GPU decode → encode, 10-100x faster)
				result = await convertWithPipeline(
					file,
					outputFormat as 'mp4' | 'webm',
					{},
					(p) => {
						onProgress?.({ progress: p.progress, message: p.message, method: 'pipeline' });
					}
				);
				break;

			case 'canvas':
				onProgress?.({ progress: 10, message: '画像を処理中... (Canvas API)' });
				result = await convertImage(file, outputFormat as any);
				break;

			case 'webcodecs':
				if (['png', 'jpg', 'webp'].includes(outputFormat)) {
					result = await extractFrameFast(file, 1, outputFormat as any, (progress, message) => {
						onProgress?.({ progress, message: `${message} (WebCodecs)` });
					});
				} else {
					result = await convertVideoWithWebCodecs(
						file,
						outputFormat as any,
						{},
						(progress, message) => {
							onProgress?.({ progress, message });
						}
					);
				}
				break;

			case 'webaudio':
				result = await extractAudioFast(file, (progress, message) => {
					onProgress?.({ progress, message: `${message} (Web Audio)` });
				});
				break;

			case 'ffmpeg':
				if (!isFFmpegAvailable()) {
					throw new Error('この形式の変換にはFFmpegが必要ですが、ブラウザがサポートしていません');
				}
				result = await convertWithFFmpeg(file, outputFormat, (progress, message) => {
					onProgress?.({ progress, message: `${message} (FFmpeg)` });
				});
				break;

			default:
				throw new Error('サポートされていない変換です');
		}

		const url = URL.createObjectURL(result.blob);

		onProgress?.({
			status: 'complete',
			progress: 100,
			message: `変換完了! (${methodNames[method]})`,
			outputUrl: url,
			outputFileName: result.fileName,
			method
		});

		return { url, fileName: result.fileName };

	} catch (error) {
		const message = error instanceof Error ? error.message : '変換中にエラーが発生しました';
		onProgress?.({
			status: 'error',
			progress: 0,
			message
		});
		throw error;
	}
}

// Utility
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check system capabilities
export function getSystemCapabilities(): {
	webcodecs: boolean;
	ffmpeg: boolean;
	sharedArrayBuffer: boolean;
} {
	return {
		webcodecs: isWebCodecsSupported(),
		ffmpeg: isFFmpegAvailable(),
		sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
	};
}

// Preload FFmpeg (only if needed later)
export async function preloadFFmpeg(): Promise<void> {
	if (isFFmpegAvailable() && !isFFmpegLoaded()) {
		try {
			await initFFmpeg();
		} catch (error) {
			console.warn('FFmpeg preload failed:', error);
		}
	}
}
