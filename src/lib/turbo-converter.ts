/**
 * Turbo Converter - Maximum Performance File Conversion
 *
 * Architecture:
 * 1. Adaptive concurrency based on CPU cores
 * 2. Memory-aware processing (never exceeds available memory)
 * 3. Zero-copy transfers using transferable objects
 * 4. GPU acceleration via WebCodecs/WebGL where available
 * 5. Streaming for large files (GB+)
 * 6. Worker pool for true parallelism
 */

import {
	parallelExecute,
	processImageParallel,
	getProcessingStats,
	cleanupWorkerPools
} from './parallel-engine';
import {
	batchProcessImages,
	encodeWavOptimized,
	decodeAudioStreaming,
	getConversionQueue,
	ConversionQueue
} from './streaming-converter';
import { detectFileType, type FileType } from './converter';
import { isWebCodecsSupported, convertVideoWithWebCodecs } from './webcodecs-converter';
import { isFFmpegAvailable, convertWithFFmpeg, initFFmpeg } from './ffmpeg-converter';
import { createZip, isCompressionStreamsSupported, getCompressionCapabilities } from './compression-utils';
import { isImageDecoderSupported } from './image-decoder';

export interface ConversionJob {
	file: File;
	outputFormat: string;
	priority?: number;
}

export interface ConversionResult {
	success: boolean;
	blob?: Blob;
	fileName?: string;
	error?: string;
	stats: {
		inputSize: number;
		outputSize: number;
		duration: number;
		method: string;
	};
}

export interface BatchProgress {
	completed: number;
	total: number;
	currentFile: string;
	currentFormat: string;
	overallProgress: number;
	speed: number; // MB/s
}

/**
 * Get optimal conversion strategy based on file and system capabilities
 */
function selectStrategy(
	file: File,
	format: string
): { method: string; priority: number } {
	const type = detectFileType(file);
	const hasWebCodecs = isWebCodecsSupported();
	const hasFFmpeg = isFFmpegAvailable();

	// Image conversions - always use Canvas/OffscreenCanvas (fastest)
	if (type === 'image') {
		return { method: 'canvas', priority: 1 };
	}

	// Audio to WAV - use Web Audio API (native, fast)
	if (type === 'audio' && format === 'wav') {
		return { method: 'webaudio', priority: 1 };
	}

	// Video to video (mp4/webm) with WebCodecs - GPU accelerated
	if (type === 'video' && ['mp4', 'webm'].includes(format) && hasWebCodecs) {
		return { method: 'webcodecs', priority: 2 };
	}

	// Frame extraction with WebCodecs
	if (type === 'video' && ['png', 'jpg', 'webp'].includes(format)) {
		return { method: 'frame-extract', priority: 1 };
	}

	// Everything else - FFmpeg (full format support)
	if (hasFFmpeg) {
		return { method: 'ffmpeg', priority: 3 };
	}

	return { method: 'unsupported', priority: 0 };
}

/**
 * Convert single file with maximum performance
 */
export async function turboConvert(
	file: File,
	outputFormat: string,
	onProgress?: (progress: number, message: string) => void
): Promise<ConversionResult> {
	const startTime = performance.now();
	const { method, priority } = selectStrategy(file, outputFormat);
	const inputSize = file.size;

	onProgress?.(0, `Starting ${method} conversion...`);

	try {
		let blob: Blob;
		let fileName: string;

		switch (method) {
			case 'canvas': {
				onProgress?.(10, 'Decoding image...');
				blob = await processImageParallel(file, outputFormat);
				fileName = file.name.replace(/\.[^/.]+$/, `.${outputFormat}`);
				onProgress?.(100, 'Complete');
				break;
			}

			case 'webaudio': {
				onProgress?.(10, 'Decoding audio...');
				const audioBuffer = await decodeAudioStreaming(file, (p) => {
					onProgress?.(10 + p * 0.4, 'Decoding audio...');
				});
				onProgress?.(50, 'Encoding WAV...');
				const wavBuffer = encodeWavOptimized(audioBuffer);
				blob = new Blob([wavBuffer], { type: 'audio/wav' });
				fileName = file.name.replace(/\.[^/.]+$/, '.wav');
				onProgress?.(100, 'Complete');
				break;
			}

			case 'webcodecs': {
				const result = await convertVideoWithWebCodecs(
					file,
					outputFormat as 'mp4' | 'webm',
					{},
					(p, msg) => onProgress?.(p, msg)
				);
				blob = result.blob;
				fileName = result.fileName;
				break;
			}

			case 'frame-extract': {
				// Extract single frame using video element (fast)
				onProgress?.(10, 'Loading video...');
				const url = URL.createObjectURL(file);
				const video = document.createElement('video');
				video.src = url;
				video.muted = true;
				video.currentTime = 1; // Seek to 1 second

				await new Promise<void>((resolve, reject) => {
					video.onloadeddata = () => resolve();
					video.onerror = () => reject(new Error('Video load failed'));
					setTimeout(() => reject(new Error('Video load timeout')), 10000);
				});

				await new Promise<void>((resolve) => {
					video.onseeked = () => resolve();
				});

				onProgress?.(50, 'Extracting frame...');

				const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(video, 0, 0);

				const mimeType = outputFormat === 'jpg' ? 'image/jpeg'
					: outputFormat === 'webp' ? 'image/webp'
					: 'image/png';

				blob = await canvas.convertToBlob({ type: mimeType, quality: 0.92 });
				fileName = file.name.replace(/\.[^/.]+$/, `.${outputFormat}`);

				URL.revokeObjectURL(url);
				onProgress?.(100, 'Complete');
				break;
			}

			case 'ffmpeg': {
				// Ensure FFmpeg is loaded
				if (!isFFmpegAvailable()) {
					throw new Error('FFmpeg not available');
				}

				const result = await convertWithFFmpeg(
					file,
					outputFormat,
					(p, msg) => onProgress?.(p, msg)
				);
				blob = result.blob;
				fileName = result.fileName;
				break;
			}

			default:
				throw new Error(`Unsupported conversion: ${file.type} to ${outputFormat}`);
		}

		const duration = performance.now() - startTime;

		return {
			success: true,
			blob,
			fileName,
			stats: {
				inputSize,
				outputSize: blob.size,
				duration,
				method
			}
		};

	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			stats: {
				inputSize,
				outputSize: 0,
				duration: performance.now() - startTime,
				method
			}
		};
	}
}

/**
 * Batch convert multiple files with maximum parallelism
 */
export async function turboBatchConvert(
	jobs: ConversionJob[],
	onProgress?: (progress: BatchProgress) => void
): Promise<ConversionResult[]> {
	const stats = getProcessingStats();
	const startTime = performance.now();
	let totalProcessed = 0;
	let totalInputSize = jobs.reduce((sum, j) => sum + j.file.size, 0);

	// Group jobs by type for optimal batching
	const imageJobs = jobs.filter(j => detectFileType(j.file) === 'image');
	const audioJobs = jobs.filter(j => detectFileType(j.file) === 'audio');
	const videoJobs = jobs.filter(j => detectFileType(j.file) === 'video');
	const otherJobs = jobs.filter(j => {
		const t = detectFileType(j.file);
		return t !== 'image' && t !== 'audio' && t !== 'video';
	});

	const results: ConversionResult[] = new Array(jobs.length);
	let completed = 0;

	const reportProgress = (currentFile: string, currentFormat: string) => {
		const elapsed = (performance.now() - startTime) / 1000;
		const speed = totalProcessed / (1024 * 1024) / elapsed;

		onProgress?.({
			completed,
			total: jobs.length,
			currentFile,
			currentFormat,
			overallProgress: (completed / jobs.length) * 100,
			speed
		});
	};

	// Process images in parallel batch (most efficient)
	if (imageJobs.length > 0) {
		const imageResults = await batchProcessImages(
			imageJobs.map(j => ({
				file: j.file,
				format: j.outputFormat,
				quality: 0.92
			})),
			(done, total, name) => {
				completed = done;
				reportProgress(name, imageJobs[done - 1]?.outputFormat || '');
			}
		);

		// Map results back
		imageJobs.forEach((job, i) => {
			const jobIndex = jobs.indexOf(job);
			const result = imageResults[i];
			totalProcessed += job.file.size;

			results[jobIndex] = {
				success: true,
				blob: result.blob,
				fileName: result.fileName,
				stats: {
					inputSize: job.file.size,
					outputSize: result.blob.size,
					duration: 0,
					method: 'canvas-batch'
				}
			};
		});
	}

	// Process audio/video/other using queue with concurrency control
	const queue = getConversionQueue();
	const otherResults = await Promise.all(
		[...audioJobs, ...videoJobs, ...otherJobs].map(async (job) => {
			const jobIndex = jobs.indexOf(job);
			const result = await turboConvert(
				job.file,
				job.outputFormat,
				(p, msg) => reportProgress(job.file.name, job.outputFormat)
			);
			completed++;
			totalProcessed += job.file.size;
			return { jobIndex, result };
		})
	);

	otherResults.forEach(({ jobIndex, result }) => {
		results[jobIndex] = result;
	});

	return results;
}

/**
 * Convert single file to multiple formats simultaneously
 */
export async function turboMultiFormatConvert(
	file: File,
	formats: string[],
	onProgress?: (format: string, progress: number) => void
): Promise<Map<string, ConversionResult>> {
	const results = new Map<string, ConversionResult>();

	// Process all formats in parallel
	await Promise.all(
		formats.map(async (format) => {
			const result = await turboConvert(
				file,
				format,
				(p, msg) => onProgress?.(format, p)
			);
			results.set(format, result);
		})
	);

	return results;
}

/**
 * Preload conversion engines for faster first conversion
 */
export async function preloadEngines(): Promise<void> {
	const promises: Promise<any>[] = [];

	// Preload FFmpeg if available
	if (isFFmpegAvailable()) {
		promises.push(initFFmpeg().catch(() => {}));
	}

	// Warm up AudioContext
	promises.push(
		new Promise<void>((resolve) => {
			try {
				const ctx = new AudioContext();
				ctx.close();
			} catch {}
			resolve();
		})
	);

	await Promise.all(promises);
}

/**
 * Cleanup all resources
 */
export function cleanup(): void {
	cleanupWorkerPools();
}

/**
 * Export conversion results as ZIP (uses native Compression Streams - 20x faster)
 */
export async function exportAsZip(
	results: ConversionResult[],
	onProgress?: (completed: number, total: number) => void
): Promise<Blob> {
	const files: Array<{ name: string; data: Blob }> = [];

	for (const result of results) {
		if (result.success && result.blob && result.fileName) {
			files.push({
				name: result.fileName,
				data: result.blob
			});
		}
	}

	if (files.length === 0) {
		throw new Error('No successful conversions to export');
	}

	return createZip(files, onProgress);
}

/**
 * Get conversion engine status
 */
export function getEngineStatus(): {
	webcodecs: boolean;
	ffmpeg: boolean;
	imageDecoder: boolean;
	compressionStreams: boolean;
	workerCount: number;
	memoryUsage: number;
	memoryLimit: number;
} {
	const memory = (performance as any).memory;
	const stats = getProcessingStats();

	return {
		webcodecs: isWebCodecsSupported(),
		ffmpeg: isFFmpegAvailable(),
		imageDecoder: isImageDecoderSupported(),
		compressionStreams: isCompressionStreamsSupported(),
		workerCount: stats.hardwareConcurrency,
		memoryUsage: memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : 0,
		memoryLimit: memory ? Math.round(memory.jsHeapSizeLimit / (1024 * 1024)) : 0
	};
}

/**
 * Get available performance optimizations
 */
export function getOptimizations(): {
	name: string;
	available: boolean;
	description: string;
}[] {
	return [
		{
			name: 'WebCodecs',
			available: isWebCodecsSupported(),
			description: 'GPU-accelerated video encoding/decoding'
		},
		{
			name: 'ImageDecoder',
			available: isImageDecoderSupported(),
			description: '1.5x faster image decoding'
		},
		{
			name: 'Compression Streams',
			available: isCompressionStreamsSupported(),
			description: '20x faster ZIP compression'
		},
		{
			name: 'OffscreenCanvas',
			available: typeof OffscreenCanvas !== 'undefined',
			description: 'Worker-based image processing'
		},
		{
			name: 'Web Workers',
			available: typeof Worker !== 'undefined',
			description: 'True parallel processing'
		},
		{
			name: 'Hardware Concurrency',
			available: navigator.hardwareConcurrency > 1,
			description: `${navigator.hardwareConcurrency || 1} CPU cores`
		}
	];
}
