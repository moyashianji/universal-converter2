/**
 * FFmpeg.wasm based converter for audio and video
 * Comprehensive format support with SharedArrayBuffer via Service Worker
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { getMimeType, COMMON_VIDEO_OUTPUTS, COMMON_AUDIO_OUTPUTS, COMMON_IMAGE_OUTPUTS } from './formats';

let ffmpeg: FFmpeg | null = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;

export type ProgressCallback = (progress: number, message: string) => void;

export async function initFFmpeg(onProgress?: ProgressCallback): Promise<boolean> {
	if (typeof SharedArrayBuffer === 'undefined') {
		console.warn('SharedArrayBuffer not available. FFmpeg features limited.');
		return false;
	}

	if (loaded && ffmpeg) return true;
	if (loadPromise) {
		await loadPromise;
		return loaded;
	}

	loadPromise = (async () => {
		onProgress?.(0, 'FFmpegを初期化中...');

		ffmpeg = new FFmpeg();

		ffmpeg.on('log', ({ message }) => {
			console.log('[FFmpeg]', message);
		});

		ffmpeg.on('progress', ({ progress }) => {
			const percent = Math.min(Math.round(progress * 100), 100);
			onProgress?.(percent, `処理中... ${percent}%`);
		});

		const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

		try {
			onProgress?.(10, 'FFmpegコアをダウンロード中...');

			await ffmpeg.load({
				coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
				wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
			});

			loaded = true;
			onProgress?.(100, 'FFmpeg準備完了');
		} catch (error) {
			console.error('FFmpeg load error:', error);
			loaded = false;
			throw error;
		}
	})();

	try {
		await loadPromise;
		return true;
	} catch {
		return false;
	}
}

export function isFFmpegAvailable(): boolean {
	return typeof SharedArrayBuffer !== 'undefined';
}

export function isFFmpegLoaded(): boolean {
	return loaded;
}

export async function convertWithFFmpeg(
	file: File,
	outputFormat: string,
	onProgress?: ProgressCallback
): Promise<{ blob: Blob; fileName: string }> {
	if (!loaded || !ffmpeg) {
		const success = await initFFmpeg(onProgress);
		if (!success) {
			throw new Error('FFmpegの初期化に失敗しました');
		}
	}

	const inputExt = file.name.split('.').pop() || 'dat';
	const inputFileName = `input_${Date.now()}.${inputExt}`;
	const outputFileName = `output_${Date.now()}.${outputFormat}`;
	const baseName = file.name.replace(/\.[^/.]+$/, '');

	onProgress?.(5, 'ファイルを読み込み中...');

	await ffmpeg!.writeFile(inputFileName, await fetchFile(file));

	onProgress?.(15, '変換を開始...');

	const args = buildFFmpegArgs(inputFileName, outputFileName, outputFormat, file.type);

	await ffmpeg!.exec(args);

	onProgress?.(90, '出力ファイルを準備中...');

	const data = await ffmpeg!.readFile(outputFileName);

	const mimeType = getMimeType(outputFormat);
	const blob = new Blob([data], { type: mimeType });

	try {
		await ffmpeg!.deleteFile(inputFileName);
		await ffmpeg!.deleteFile(outputFileName);
	} catch {
		// Ignore cleanup errors
	}

	onProgress?.(100, '変換完了!');

	return {
		blob,
		fileName: `${baseName}.${outputFormat}`
	};
}

function buildFFmpegArgs(input: string, output: string, format: string, mimeType: string): string[] {
	const baseArgs = ['-i', input];
	const isVideo = mimeType.startsWith('video/');

	switch (format) {
		// ===== VIDEO FORMATS =====
		case 'mp4':
			return [...baseArgs, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output];
		case 'webm':
			return [...baseArgs, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k', output];
		case 'mkv':
			return [...baseArgs, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', output];
		case 'avi':
			return [...baseArgs, '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'mp3', '-b:a', '192k', output];
		case 'mov':
			return [...baseArgs, '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output];
		case 'wmv':
			return [...baseArgs, '-c:v', 'wmv2', '-c:a', 'wmav2', '-b:a', '192k', output];
		case 'flv':
			return [...baseArgs, '-c:v', 'libx264', '-c:a', 'aac', '-ar', '44100', output];
		case 'gif':
			// For video: animated GIF with palette optimization; for image: simple conversion
			return isVideo
				? [...baseArgs, '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', '-loop', '0', output]
				: [...baseArgs, '-f', 'gif', output];
		case 'apng':
			return [...baseArgs, '-plays', '0', '-f', 'apng', output];
		case '3gp':
			return [...baseArgs, '-c:v', 'h263', '-c:a', 'aac', '-ar', '8000', '-ac', '1', '-s', '176x144', output];
		case '3g2':
			return [...baseArgs, '-c:v', 'h263', '-c:a', 'aac', '-ar', '8000', '-ac', '1', '-s', '176x144', '-f', '3g2', output];
		case 'ts':
		case 'mts':
		case 'm2ts':
			return [...baseArgs, '-c:v', 'libx264', '-c:a', 'aac', '-f', 'mpegts', output];
		case 'vob':
			return [...baseArgs, '-c:v', 'mpeg2video', '-c:a', 'mp2', '-f', 'vob', output];
		case 'm4v':
			return [...baseArgs, '-c:v', 'libx264', '-c:a', 'aac', '-f', 'mp4', output];
		case 'mpg':
		case 'mpeg':
			return [...baseArgs, '-c:v', 'mpeg2video', '-c:a', 'mp2', '-f', 'mpeg', output];
		case 'ogv':
			return [...baseArgs, '-c:v', 'libtheora', '-c:a', 'libvorbis', output];
		case 'asf':
			return [...baseArgs, '-c:v', 'wmv2', '-c:a', 'wmav2', '-f', 'asf', output];
		case 'f4v':
			return [...baseArgs, '-c:v', 'libx264', '-c:a', 'aac', '-f', 'flv', output];
		case 'dv':
			return [...baseArgs, '-c:v', 'dvvideo', '-c:a', 'pcm_s16le', '-f', 'dv', output];

		// ===== AUDIO FORMATS =====
		case 'mp3':
			return [...baseArgs, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', output];
		case 'wav':
			return [...baseArgs, '-vn', '-c:a', 'pcm_s16le', output];
		case 'aac':
			return [...baseArgs, '-vn', '-c:a', 'aac', '-b:a', '192k', output];
		case 'ogg':
			return [...baseArgs, '-vn', '-c:a', 'libvorbis', '-q:a', '5', output];
		case 'opus':
			return [...baseArgs, '-vn', '-c:a', 'libopus', '-b:a', '128k', output];
		case 'flac':
			return [...baseArgs, '-vn', '-c:a', 'flac', output];
		case 'm4a':
			return [...baseArgs, '-vn', '-c:a', 'aac', '-b:a', '256k', '-f', 'mp4', output];
		case 'wma':
			return [...baseArgs, '-vn', '-c:a', 'wmav2', '-b:a', '192k', output];
		case 'aiff':
			return [...baseArgs, '-vn', '-c:a', 'pcm_s16be', '-f', 'aiff', output];
		case 'alac':
			return [...baseArgs, '-vn', '-c:a', 'alac', '-f', 'mp4', output];
		case 'ape':
			return [...baseArgs, '-vn', '-c:a', 'ape', output];
		case 'ac3':
			return [...baseArgs, '-vn', '-c:a', 'ac3', '-b:a', '384k', output];
		case 'dts':
			return [...baseArgs, '-vn', '-c:a', 'dca', '-b:a', '768k', output];
		case 'amr':
			return [...baseArgs, '-vn', '-c:a', 'libopencore_amrnb', '-ar', '8000', '-ac', '1', output];
		case 'au':
			return [...baseArgs, '-vn', '-c:a', 'pcm_mulaw', '-ar', '8000', '-f', 'au', output];
		case 'mka':
			return [...baseArgs, '-vn', '-c:a', 'copy', '-f', 'matroska', output];
		case 'weba':
			return [...baseArgs, '-vn', '-c:a', 'libopus', '-b:a', '128k', '-f', 'webm', output];
		case 'oga':
			return [...baseArgs, '-vn', '-c:a', 'libvorbis', '-f', 'ogg', output];
		case 'spx':
			return [...baseArgs, '-vn', '-c:a', 'libspeex', '-f', 'ogg', output];
		case 'caf':
			return [...baseArgs, '-vn', '-c:a', 'alac', '-f', 'caf', output];

		// ===== IMAGE FORMATS (from video frames or image conversion) =====
		case 'png':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-f', 'image2', output]
				: [...baseArgs, '-f', 'image2', output];
		case 'jpg':
		case 'jpeg':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-q:v', '2', '-f', 'image2', output]
				: [...baseArgs, '-q:v', '2', '-f', 'image2', output];
		case 'webp':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-quality', '80', '-f', 'webp', output]
				: [...baseArgs, '-quality', '80', '-f', 'webp', output];
	case 'bmp':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-f', 'image2', output]
				: [...baseArgs, '-f', 'image2', output];
		case 'tiff':
		case 'tif':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-f', 'image2', output]
				: [...baseArgs, '-f', 'image2', output];
		case 'ico':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-vf', 'scale=256:256', '-f', 'image2', output]
				: [...baseArgs, '-vf', 'scale=256:256', '-f', 'image2', output];
		case 'tga':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-f', 'image2', output]
				: [...baseArgs, '-f', 'image2', output];
		case 'avif':
			return isVideo
				? [...baseArgs, '-ss', '00:00:01', '-vframes', '1', '-c:v', 'libaom-av1', '-still-picture', '1', output]
				: [...baseArgs, '-c:v', 'libaom-av1', '-still-picture', '1', output];

		default:
			// Generic fallback
			return [...baseArgs, output];
	}
}

// Export format lists
export const FFMPEG_VIDEO_FORMATS = COMMON_VIDEO_OUTPUTS;
export const FFMPEG_AUDIO_FORMATS = COMMON_AUDIO_OUTPUTS;
export const FFMPEG_IMAGE_OUTPUTS = COMMON_IMAGE_OUTPUTS;
