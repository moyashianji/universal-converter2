/**
 * Shared WAV Encoder
 *
 * Single-pass, zero-copy, optimized for speed.
 * Mono/stereo fast paths + generic N-channel support.
 */

/**
 * Encode AudioBuffer to WAV Blob
 */
export function encodeWav(audioBuffer: AudioBuffer): Blob {
	return new Blob([encodeWavToBuffer(audioBuffer)], { type: 'audio/wav' });
}

/**
 * Encode AudioBuffer to WAV ArrayBuffer
 * Use this when you need the raw buffer (e.g. for worker transfer)
 */
export function encodeWavToBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
	const numChannels = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	const length = audioBuffer.length;
	const bytesPerSample = 2; // 16-bit
	const blockAlign = numChannels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = length * blockAlign;
	const totalSize = 44 + dataSize;

	// Single allocation for entire file
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);
	const int16 = new Int16Array(buffer, 44);

	// WAV header (44 bytes)
	view.setUint32(0, 0x52494646, false);  // "RIFF"
	view.setUint32(4, totalSize - 8, true); // File size - 8
	view.setUint32(8, 0x57415645, false);  // "WAVE"
	view.setUint32(12, 0x666d7420, false); // "fmt "
	view.setUint32(16, 16, true);          // Chunk size (PCM = 16)
	view.setUint16(20, 1, true);           // PCM format
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, 16, true);          // Bits per sample
	view.setUint32(36, 0x64617461, false); // "data"
	view.setUint32(40, dataSize, true);

	// Optimized sample writing with fast paths for mono/stereo
	if (numChannels === 1) {
		const channel = audioBuffer.getChannelData(0);
		for (let i = 0; i < length; i++) {
			const s = Math.max(-1, Math.min(1, channel[i]));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}
	} else if (numChannels === 2) {
		const left = audioBuffer.getChannelData(0);
		const right = audioBuffer.getChannelData(1);
		for (let i = 0; i < length; i++) {
			const sl = Math.max(-1, Math.min(1, left[i]));
			const sr = Math.max(-1, Math.min(1, right[i]));
			int16[i * 2] = sl < 0 ? sl * 0x8000 : sl * 0x7FFF;
			int16[i * 2 + 1] = sr < 0 ? sr * 0x8000 : sr * 0x7FFF;
		}
	} else {
		// Generic N-channel interleaving
		const channels: Float32Array[] = [];
		for (let ch = 0; ch < numChannels; ch++) {
			channels.push(audioBuffer.getChannelData(ch));
		}
		let idx = 0;
		for (let i = 0; i < length; i++) {
			for (let ch = 0; ch < numChannels; ch++) {
				const s = Math.max(-1, Math.min(1, channels[ch][i]));
				int16[idx++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
			}
		}
	}

	return buffer;
}
