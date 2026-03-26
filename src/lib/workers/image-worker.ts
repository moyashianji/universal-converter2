/**
 * Image Processing Web Worker
 * Uses OffscreenCanvas for parallel, non-blocking image conversion
 */

interface ConvertMessage {
	type: 'convert';
	imageData: ImageBitmap;
	format: string;
	quality: number;
	width?: number;
	height?: number;
}

self.onmessage = async (e: MessageEvent<ConvertMessage>) => {
	const { type, imageData, format, quality, width, height } = e.data;

	if (type !== 'convert') return;

	try {
		// Calculate dimensions
		const targetWidth = width || imageData.width;
		const targetHeight = height || imageData.height;

		// Create OffscreenCanvas
		const canvas = new OffscreenCanvas(targetWidth, targetHeight);
		const ctx = canvas.getContext('2d')!;

		// High quality rendering
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		// Draw image
		ctx.drawImage(imageData, 0, 0, targetWidth, targetHeight);

		// Convert to blob
		const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
		const blob = await canvas.convertToBlob({
			type: mimeType,
			quality: quality
		});

		// Send back
		self.postMessage({ success: true, blob });
	} catch (error) {
		self.postMessage({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
};
