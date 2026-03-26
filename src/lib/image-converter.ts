/**
 * Ultimate Image Converter
 *
 * Uses the fastest available method:
 * 1. OffscreenCanvas + Web Worker (parallel, non-blocking)
 * 2. createImageBitmap (fast decoding)
 * 3. Canvas API fallback
 *
 * Zero dependencies, maximum performance
 */

export type ImageFormat = 'png' | 'jpeg' | 'jpg' | 'webp' | 'bmp' | 'gif' | 'avif';

export interface ImageConversionOptions {
	quality?: number;
	width?: number;
	height?: number;
	maintainAspectRatio?: boolean;
}

const MIME_TYPES: Record<ImageFormat, string> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	bmp: 'image/bmp',
	gif: 'image/gif',
	avif: 'image/avif'
};

// Check OffscreenCanvas support
const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

// Check createImageBitmap support
const supportsImageBitmap = typeof createImageBitmap !== 'undefined';

// Web Worker for parallel processing
let imageWorker: Worker | null = null;

function getImageWorker(): Worker | null {
	if (!supportsOffscreenCanvas) return null;

	if (!imageWorker) {
		try {
			// Create inline worker
			const workerCode = `
				self.onmessage = async (e) => {
					const { imageData, format, quality, width, height } = e.data;
					try {
						const canvas = new OffscreenCanvas(width, height);
						const ctx = canvas.getContext('2d');
						ctx.imageSmoothingEnabled = true;
						ctx.imageSmoothingQuality = 'high';
						ctx.drawImage(imageData, 0, 0, width, height);
						const mimeType = 'image/' + (format === 'jpg' ? 'jpeg' : format);
						const blob = await canvas.convertToBlob({ type: mimeType, quality });
						self.postMessage({ success: true, blob });
					} catch (error) {
						self.postMessage({ success: false, error: error.message });
					}
				};
			`;
			const blob = new Blob([workerCode], { type: 'application/javascript' });
			imageWorker = new Worker(URL.createObjectURL(blob));
		} catch {
			return null;
		}
	}
	return imageWorker;
}

export function getSupportedImageFormats(): ImageFormat[] {
	const formats: ImageFormat[] = ['png', 'jpeg', 'webp'];

	// Check additional format support
	if (typeof document !== 'undefined') {
		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 1;

		// GIF support (read-only typically, but check)
		formats.push('gif');

		// BMP support
		formats.push('bmp');

		// AVIF support
		if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) {
			formats.push('avif');
		}
	}

	return formats;
}

export async function convertImage(
	file: File,
	targetFormat: ImageFormat,
	options: ImageConversionOptions = {}
): Promise<{ blob: Blob; fileName: string }> {
	const { quality = 0.92, width, height, maintainAspectRatio = true } = options;

	// Fast decode with createImageBitmap
	let imageBitmap: ImageBitmap;

	if (supportsImageBitmap) {
		imageBitmap = await createImageBitmap(file);
	} else {
		// Fallback to Image element
		const img = await loadImage(file);
		imageBitmap = await createImageBitmap(img);
	}

	// Calculate dimensions
	let targetWidth = width || imageBitmap.width;
	let targetHeight = height || imageBitmap.height;

	if (width && !height && maintainAspectRatio) {
		targetHeight = Math.round((imageBitmap.height / imageBitmap.width) * width);
	} else if (height && !width && maintainAspectRatio) {
		targetWidth = Math.round((imageBitmap.width / imageBitmap.height) * height);
	}

	// Try Worker + OffscreenCanvas first (parallel, non-blocking)
	const worker = getImageWorker();

	if (worker && supportsOffscreenCanvas) {
		try {
			const blob = await convertWithWorker(worker, imageBitmap, targetFormat, quality, targetWidth, targetHeight);
			imageBitmap.close();

			const baseName = file.name.replace(/\.[^/.]+$/, '');
			return { blob, fileName: `${baseName}.${targetFormat}` };
		} catch {
			// Fall through to main thread
		}
	}

	// Fallback: Main thread Canvas
	const blob = await convertWithCanvas(imageBitmap, targetFormat, quality, targetWidth, targetHeight);
	imageBitmap.close();

	const baseName = file.name.replace(/\.[^/.]+$/, '');
	return { blob, fileName: `${baseName}.${targetFormat}` };
}

function convertWithWorker(
	worker: Worker,
	imageData: ImageBitmap,
	format: string,
	quality: number,
	width: number,
	height: number
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Worker timeout'));
		}, 30000);

		worker.onmessage = (e) => {
			clearTimeout(timeout);
			if (e.data.success) {
				resolve(e.data.blob);
			} else {
				reject(new Error(e.data.error));
			}
		};

		worker.onerror = (e) => {
			clearTimeout(timeout);
			reject(e);
		};

		worker.postMessage({ imageData, format, quality, width, height });
	});
}

async function convertWithCanvas(
	imageBitmap: ImageBitmap,
	format: string,
	quality: number,
	width: number,
	height: number
): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(imageBitmap, 0, 0, width, height);

	const mimeType = MIME_TYPES[format as ImageFormat] || 'image/png';

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('Failed to convert'));
			},
			mimeType,
			quality
		);
	});
}

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(img.src);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(img.src);
			reject(new Error('Failed to load image'));
		};
		img.src = URL.createObjectURL(file);
	});
}

export function isImageFile(file: File): boolean {
	return file.type.startsWith('image/') ||
		/\.(png|jpe?g|webp|gif|bmp|tiff?|svg|ico|heic|heif|avif|tga|psd)$/i.test(file.name);
}

// Batch conversion for multiple images (parallel processing)
export async function convertImagesParallel(
	files: File[],
	targetFormat: ImageFormat,
	options: ImageConversionOptions = {}
): Promise<{ blob: Blob; fileName: string }[]> {
	return Promise.all(files.map(file => convertImage(file, targetFormat, options)));
}
