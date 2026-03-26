/**
 * Video Converter using MediaRecorder and Canvas APIs
 * Supports: WebM, MP4 (where available), GIF, extracting frames/audio
 */

import { encodeWav } from './wav-encoder';
import { isFFmpegAvailable, convertWithFFmpeg } from './ffmpeg-converter';

export type VideoFormat = 'webm' | 'mp4' | 'gif';
export type VideoOutputType = 'video' | 'audio' | 'image';

export interface VideoConversionOptions {
	format: VideoFormat;
	outputType?: VideoOutputType;
	quality?: number;
	frameRate?: number;
	width?: number;
	height?: number;
	startTime?: number;
	duration?: number;
}

export function getSupportedVideoFormats(): VideoFormat[] {
	const formats: VideoFormat[] = [];

	if (typeof MediaRecorder !== 'undefined') {
		if (MediaRecorder.isTypeSupported('video/webm')) formats.push('webm');
		if (MediaRecorder.isTypeSupported('video/mp4')) formats.push('mp4');
	}

	// GIF always supported via canvas
	formats.push('gif');

	return formats;
}

export async function convertVideo(
	file: File,
	options: VideoConversionOptions,
	onProgress?: (progress: number) => void
): Promise<{ blob: Blob; fileName: string }> {
	const {
		format,
		outputType = 'video',
		quality = 0.8,
		frameRate = 30,
		width,
		height,
		startTime = 0,
		duration
	} = options;

	onProgress?.(5);

	// Load video
	const video = await loadVideo(file);

	onProgress?.(15);

	// Calculate dimensions
	let targetWidth = width || video.videoWidth;
	let targetHeight = height || video.videoHeight;

	if (width && !height) {
		targetHeight = Math.round((video.videoHeight / video.videoWidth) * width);
	} else if (height && !width) {
		targetWidth = Math.round((video.videoWidth / video.videoHeight) * height);
	}

	let blob: Blob;
	const baseName = file.name.replace(/\.[^/.]+$/, '');

	if (outputType === 'audio') {
		blob = await extractAudio(file, onProgress);
		return { blob, fileName: `${baseName}.wav` };
	}

	if (outputType === 'image') {
		blob = await extractFrame(video, startTime, targetWidth, targetHeight);
		return { blob, fileName: `${baseName}.png` };
	}

	if (format === 'gif') {
		blob = await videoToGif(file, {
			width: Math.min(targetWidth, 480),
			height: Math.min(targetHeight, 480),
			frameRate: Math.min(frameRate, 15),
			quality,
			startTime,
			duration: duration || Math.min(video.duration - startTime, 10)
		}, onProgress);
	} else {
		blob = await transcodeVideo(video, format, {
			width: targetWidth,
			height: targetHeight,
			frameRate,
			quality,
			startTime,
			duration
		}, onProgress);
	}

	URL.revokeObjectURL(video.src);

	return { blob, fileName: `${baseName}.${format}` };
}

function loadVideo(file: File): Promise<HTMLVideoElement> {
	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;

		video.onloadedmetadata = () => resolve(video);
		video.onerror = () => {
			URL.revokeObjectURL(video.src);
			reject(new Error('Failed to load video'));
		};

		video.src = URL.createObjectURL(file);
	});
}

async function extractFrame(
	video: HTMLVideoElement,
	time: number,
	width: number,
	height: number
): Promise<Blob> {
	video.currentTime = time;

	await new Promise<void>((resolve) => {
		video.onseeked = () => resolve();
	});

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(video, 0, 0, width, height);

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('Failed to extract frame'));
		}, 'image/png');
	});
}

async function extractAudio(
	file: File,
	onProgress?: (progress: number) => void
): Promise<Blob> {
	onProgress?.(30);

	const audioContext = new AudioContext();
	const arrayBuffer = await file.arrayBuffer();

	onProgress?.(50);

	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	onProgress?.(70);

	const blob = encodeWav(audioBuffer);

	await audioContext.close();
	onProgress?.(90);

	return blob;
}

interface GifOptions {
	width: number;
	height: number;
	frameRate: number;
	quality: number;
	startTime: number;
	duration: number;
}

async function videoToGif(
	file: File,
	options: GifOptions,
	onProgress?: (progress: number) => void
): Promise<Blob> {
	// Use FFmpeg for high-quality animated GIF with palette optimization
	if (isFFmpegAvailable()) {
		const result = await convertWithFFmpeg(file, 'gif', (progress, message) => {
			onProgress?.(20 + progress * 0.75);
		});
		onProgress?.(95);
		return result.blob;
	}

	// Fallback: extract a single frame as static GIF via Canvas
	const { width, height, startTime } = options;

	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.src = URL.createObjectURL(file);

	await new Promise<void>((resolve) => {
		video.onloadedmetadata = () => resolve();
	});

	video.currentTime = startTime;
	await new Promise<void>((resolve) => {
		video.onseeked = () => resolve();
	});

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(video, 0, 0, width, height);

	URL.revokeObjectURL(video.src);
	onProgress?.(95);

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('フレームのキャプチャに失敗しました'));
		}, 'image/gif');
	});
}

interface TranscodeOptions {
	width: number;
	height: number;
	frameRate: number;
	quality: number;
	startTime?: number;
	duration?: number;
}

async function transcodeVideo(
	video: HTMLVideoElement,
	format: VideoFormat,
	options: TranscodeOptions,
	onProgress?: (progress: number) => void
): Promise<Blob> {
	const { width, height, frameRate, startTime = 0, duration } = options;

	// Create canvas for video rendering
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;

	// Get canvas stream
	const stream = canvas.captureStream(frameRate);

	// Add audio track if present
	try {
		const audioCtx = new AudioContext();
		const source = audioCtx.createMediaElementSource(video);
		const dest = audioCtx.createMediaStreamDestination();
		source.connect(dest);
		source.connect(audioCtx.destination);

		dest.stream.getAudioTracks().forEach((track) => {
			stream.addTrack(track);
		});
	} catch {
		// Video might not have audio or audio context failed
	}

	// Setup MediaRecorder
	const mimeType = format === 'mp4'
		? (MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm')
		: 'video/webm;codecs=vp9';

	const recorder = new MediaRecorder(stream, {
		mimeType,
		videoBitsPerSecond: 2500000
	});

	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};

	const recordingPromise = new Promise<Blob>((resolve, reject) => {
		recorder.onstop = () => {
			resolve(new Blob(chunks, { type: mimeType }));
		};
		recorder.onerror = () => reject(new Error('Recording failed'));
	});

	// Start recording
	recorder.start();
	video.currentTime = startTime;

	await new Promise<void>((resolve) => {
		video.onseeked = () => resolve();
	});

	await video.play();

	const endTime = duration ? startTime + duration : video.duration;

	// Render frames
	const renderFrame = () => {
		if (video.currentTime >= endTime || video.ended) {
			video.pause();
			recorder.stop();
			return;
		}

		ctx.drawImage(video, 0, 0, width, height);

		const progress = ((video.currentTime - startTime) / (endTime - startTime)) * 80 + 15;
		onProgress?.(Math.min(progress, 95));

		requestAnimationFrame(renderFrame);
	};

	renderFrame();

	return recordingPromise;
}

export function isVideoFile(file: File): boolean {
	return file.type.startsWith('video/') ||
		/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|3gp)$/i.test(file.name);
}
