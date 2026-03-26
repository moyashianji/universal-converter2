/**
 * Compression Utilities using native Compression Streams API
 *
 * ~20x faster than JavaScript-based compression (pako, etc.)
 * Browser support: 90%+ (Chrome 80+, Firefox 113+, Safari 16.4+)
 */

/**
 * Check if Compression Streams API is available
 */
export function isCompressionStreamsSupported(): boolean {
	return 'CompressionStream' in window && 'DecompressionStream' in window;
}

/**
 * Compress data using native GZIP
 */
export async function compressGzip(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
	if (!isCompressionStreamsSupported()) {
		throw new Error('CompressionStream not supported');
	}

	const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
	const stream = new Blob([input]).stream();
	const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));

	const chunks: Uint8Array[] = [];
	const reader = compressedStream.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	// Concatenate chunks
	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}

/**
 * Decompress GZIP data using native API
 */
export async function decompressGzip(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
	if (!isCompressionStreamsSupported()) {
		throw new Error('DecompressionStream not supported');
	}

	const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
	const stream = new Blob([input]).stream();
	const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));

	const chunks: Uint8Array[] = [];
	const reader = decompressedStream.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}

/**
 * Compress data using native DEFLATE
 */
export async function compressDeflate(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
	if (!isCompressionStreamsSupported()) {
		throw new Error('CompressionStream not supported');
	}

	const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
	const stream = new Blob([input]).stream();
	const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));

	const chunks: Uint8Array[] = [];
	const reader = compressedStream.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}

/**
 * Decompress DEFLATE data
 */
export async function decompressDeflate(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
	if (!isCompressionStreamsSupported()) {
		throw new Error('DecompressionStream not supported');
	}

	const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
	const stream = new Blob([input]).stream();
	const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));

	const chunks: Uint8Array[] = [];
	const reader = decompressedStream.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}

/**
 * Simple ZIP file creator using native compression
 * Creates a valid ZIP file with multiple entries
 */
export async function createZip(
	files: Array<{ name: string; data: Blob | ArrayBuffer | Uint8Array }>,
	onProgress?: (completed: number, total: number) => void
): Promise<Blob> {
	const entries: Array<{
		name: string;
		data: Uint8Array;
		compressed: Uint8Array;
		crc32: number;
	}> = [];

	let completed = 0;

	// Process each file
	for (const file of files) {
		let data: Uint8Array;
		if (file.data instanceof Blob) {
			data = new Uint8Array(await file.data.arrayBuffer());
		} else if (file.data instanceof ArrayBuffer) {
			data = new Uint8Array(file.data);
		} else {
			data = file.data;
		}

		// Calculate CRC32
		const crc32 = calculateCRC32(data);

		// Compress using DEFLATE-raw
		let compressed: Uint8Array;
		if (isCompressionStreamsSupported()) {
			const compressedBuffer = await compressDeflateRaw(data);
			compressed = new Uint8Array(compressedBuffer);
		} else {
			// Fallback: store uncompressed
			compressed = data;
		}

		entries.push({
			name: file.name,
			data,
			compressed,
			crc32
		});

		completed++;
		onProgress?.(completed, files.length);
	}

	// Build ZIP structure
	return buildZipFile(entries);
}

/**
 * DEFLATE-raw compression (no header/trailer) for ZIP compatibility
 */
async function compressDeflateRaw(data: Uint8Array): Promise<ArrayBuffer> {
	if (!isCompressionStreamsSupported()) {
		return data.buffer;
	}

	const stream = new Blob([data]).stream();
	const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));

	const chunks: Uint8Array[] = [];
	const reader = compressedStream.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}

/**
 * CRC32 calculation (used by ZIP format)
 */
function calculateCRC32(data: Uint8Array): number {
	const table = getCRC32Table();
	let crc = 0xFFFFFFFF;

	for (let i = 0; i < data.length; i++) {
		crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
	}

	return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crc32Table: Uint32Array | null = null;

function getCRC32Table(): Uint32Array {
	if (crc32Table) return crc32Table;

	crc32Table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) {
			c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
		}
		crc32Table[i] = c;
	}
	return crc32Table;
}

/**
 * Build ZIP file from entries
 */
function buildZipFile(
	entries: Array<{
		name: string;
		data: Uint8Array;
		compressed: Uint8Array;
		crc32: number;
	}>
): Blob {
	const parts: Uint8Array[] = [];
	const centralDirectory: Uint8Array[] = [];
	let offset = 0;

	const encoder = new TextEncoder();

	for (const entry of entries) {
		const nameBytes = encoder.encode(entry.name);
		const isCompressed = entry.compressed.length < entry.data.length;
		const compressionMethod = isCompressed ? 8 : 0; // 8 = DEFLATE, 0 = STORE
		const compressedData = isCompressed ? entry.compressed : entry.data;

		// Local file header
		const localHeader = new Uint8Array(30 + nameBytes.length);
		const localView = new DataView(localHeader.buffer);

		localView.setUint32(0, 0x04034b50, true); // Local file header signature
		localView.setUint16(4, 20, true); // Version needed
		localView.setUint16(6, 0, true); // General purpose bit flag
		localView.setUint16(8, compressionMethod, true); // Compression method
		localView.setUint16(10, 0, true); // Last mod time
		localView.setUint16(12, 0, true); // Last mod date
		localView.setUint32(14, entry.crc32, true); // CRC-32
		localView.setUint32(18, compressedData.length, true); // Compressed size
		localView.setUint32(22, entry.data.length, true); // Uncompressed size
		localView.setUint16(26, nameBytes.length, true); // File name length
		localView.setUint16(28, 0, true); // Extra field length
		localHeader.set(nameBytes, 30);

		parts.push(localHeader);
		parts.push(compressedData);

		// Central directory entry
		const centralEntry = new Uint8Array(46 + nameBytes.length);
		const centralView = new DataView(centralEntry.buffer);

		centralView.setUint32(0, 0x02014b50, true); // Central directory signature
		centralView.setUint16(4, 20, true); // Version made by
		centralView.setUint16(6, 20, true); // Version needed
		centralView.setUint16(8, 0, true); // General purpose bit flag
		centralView.setUint16(10, compressionMethod, true); // Compression method
		centralView.setUint16(12, 0, true); // Last mod time
		centralView.setUint16(14, 0, true); // Last mod date
		centralView.setUint32(16, entry.crc32, true); // CRC-32
		centralView.setUint32(20, compressedData.length, true); // Compressed size
		centralView.setUint32(24, entry.data.length, true); // Uncompressed size
		centralView.setUint16(28, nameBytes.length, true); // File name length
		centralView.setUint16(30, 0, true); // Extra field length
		centralView.setUint16(32, 0, true); // File comment length
		centralView.setUint16(34, 0, true); // Disk number start
		centralView.setUint16(36, 0, true); // Internal file attributes
		centralView.setUint32(38, 0, true); // External file attributes
		centralView.setUint32(42, offset, true); // Relative offset of local header
		centralEntry.set(nameBytes, 46);

		centralDirectory.push(centralEntry);
		offset += localHeader.length + compressedData.length;
	}

	// Add central directory
	const centralDirOffset = offset;
	let centralDirSize = 0;
	for (const entry of centralDirectory) {
		parts.push(entry);
		centralDirSize += entry.length;
	}

	// End of central directory record
	const endRecord = new Uint8Array(22);
	const endView = new DataView(endRecord.buffer);

	endView.setUint32(0, 0x06054b50, true); // End signature
	endView.setUint16(4, 0, true); // Disk number
	endView.setUint16(6, 0, true); // Disk with central directory
	endView.setUint16(8, entries.length, true); // Number of entries on this disk
	endView.setUint16(10, entries.length, true); // Total number of entries
	endView.setUint32(12, centralDirSize, true); // Central directory size
	endView.setUint32(16, centralDirOffset, true); // Central directory offset
	endView.setUint16(20, 0, true); // Comment length

	parts.push(endRecord);

	return new Blob(parts, { type: 'application/zip' });
}

/**
 * Get compression capabilities
 */
export function getCompressionCapabilities(): {
	gzip: boolean;
	deflate: boolean;
	deflateRaw: boolean;
} {
	const supported = isCompressionStreamsSupported();
	return {
		gzip: supported,
		deflate: supported,
		deflateRaw: supported
	};
}
