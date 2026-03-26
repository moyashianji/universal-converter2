// Format detection utilities

import type { FileCategory, FileInfo } from './types';
import { generateId } from './types';

// Magic bytes for file type detection
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number; category: FileCategory }> = {
  // Images
  png: { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], category: 'image' },
  jpg: { bytes: [0xFF, 0xD8, 0xFF], category: 'image' },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38], category: 'image' }, // GIF8
  webp: { bytes: [0x52, 0x49, 0x46, 0x46], category: 'image' }, // RIFF (need to check for WEBP)
  bmp: { bytes: [0x42, 0x4D], category: 'image' }, // BM
  ico: { bytes: [0x00, 0x00, 0x01, 0x00], category: 'image' },
  avif: { bytes: [0x00, 0x00, 0x00], category: 'image' }, // ftyp header

  // Video
  mp4: { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, category: 'video' }, // ftyp at offset 4
  webm: { bytes: [0x1A, 0x45, 0xDF, 0xA3], category: 'video' }, // EBML
  avi: { bytes: [0x52, 0x49, 0x46, 0x46], category: 'video' }, // RIFF (need to check for AVI)
  mkv: { bytes: [0x1A, 0x45, 0xDF, 0xA3], category: 'video' }, // EBML
  mov: { bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], offset: 4, category: 'video' }, // ftypqt
  flv: { bytes: [0x46, 0x4C, 0x56], category: 'video' }, // FLV

  // Audio
  mp3: { bytes: [0xFF, 0xFB], category: 'audio' }, // or ID3
  mp3_id3: { bytes: [0x49, 0x44, 0x33], category: 'audio' }, // ID3
  wav: { bytes: [0x52, 0x49, 0x46, 0x46], category: 'audio' }, // RIFF (need to check for WAVE)
  ogg: { bytes: [0x4F, 0x67, 0x67, 0x53], category: 'audio' }, // OggS
  flac: { bytes: [0x66, 0x4C, 0x61, 0x43], category: 'audio' }, // fLaC
  m4a: { bytes: [0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41], offset: 4, category: 'audio' }, // ftypM4A

  // Documents
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46], category: 'document' }, // %PDF
};

// Extension to category mapping
const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Images
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  bmp: 'image', ico: 'image', svg: 'image', tiff: 'image', tif: 'image',
  avif: 'image', heic: 'image', heif: 'image',

  // Video
  mp4: 'video', webm: 'video', avi: 'video', mov: 'video', mkv: 'video',
  flv: 'video', wmv: 'video', m4v: 'video', mpeg: 'video', mpg: 'video',
  '3gp': 'video', '3g2': 'video',

  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio', flac: 'audio',
  m4a: 'audio', wma: 'audio', aiff: 'audio', alac: 'audio', opus: 'audio',

  // Documents
  pdf: 'document', txt: 'document', doc: 'document', docx: 'document',
  rtf: 'document', odt: 'document', md: 'document', html: 'document',
  htm: 'document', xml: 'document', json: 'document', csv: 'document',
};

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Detect file category from MIME type
 */
export function detectCategoryFromMime(mimeType: string): FileCategory | null {
  const type = mimeType.toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('application/pdf') ||
      type.startsWith('text/') ||
      type.includes('document') ||
      type.includes('msword')) return 'document';

  return null;
}

/**
 * Detect file category from extension
 */
export function detectCategoryFromExtension(extension: string): FileCategory | null {
  return EXTENSION_CATEGORIES[extension.toLowerCase()] || null;
}

/**
 * Detect file type from magic bytes (file signature)
 */
export async function detectFromMagicBytes(file: File): Promise<{ format: string; category: FileCategory } | null> {
  const buffer = await file.slice(0, 32).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check RIFF-based formats (WAV, AVI, WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // Check for WAVE
    if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return { format: 'wav', category: 'audio' };
    }
    // Check for AVI
    if (bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20) {
      return { format: 'avi', category: 'video' };
    }
    // Check for WEBP
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return { format: 'webp', category: 'image' };
    }
  }

  // Check other formats
  for (const [format, config] of Object.entries(MAGIC_BYTES)) {
    if (format.includes('_')) continue; // Skip alternate signatures

    const offset = config.offset || 0;
    let match = true;

    for (let i = 0; i < config.bytes.length; i++) {
      if (bytes[offset + i] !== config.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      return { format, category: config.category };
    }
  }

  // Check for MP3 with ID3 tag
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { format: 'mp3', category: 'audio' };
  }

  return null;
}

/**
 * Comprehensive file type detection
 */
export async function detectFileType(file: File): Promise<FileCategory | null> {
  // Try MIME type first
  if (file.type) {
    const category = detectCategoryFromMime(file.type);
    if (category) return category;
  }

  // Try extension
  const extension = getFileExtension(file.name);
  if (extension) {
    const category = detectCategoryFromExtension(extension);
    if (category) return category;
  }

  // Try magic bytes
  try {
    const result = await detectFromMagicBytes(file);
    if (result) return result.category;
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get detailed file format information
 */
export async function detectFileFormat(file: File): Promise<{ format: string; category: FileCategory } | null> {
  // Try magic bytes first for accuracy
  try {
    const result = await detectFromMagicBytes(file);
    if (result) return result;
  } catch {
    // Fall through to other methods
  }

  // Try extension
  const extension = getFileExtension(file.name);
  if (extension) {
    const category = detectCategoryFromExtension(extension);
    if (category) return { format: extension, category };
  }

  // Try MIME type
  if (file.type) {
    const category = detectCategoryFromMime(file.type);
    if (category) {
      // Extract format from MIME type
      const parts = file.type.split('/');
      const format = parts[1]?.split(';')[0] || extension;
      return { format, category };
    }
  }

  return null;
}

/**
 * Create FileInfo object from File
 */
export async function createFileInfo(file: File): Promise<FileInfo> {
  const extension = getFileExtension(file.name);
  const category = await detectFileType(file);

  let preview: string | undefined;

  // Create preview URL for images and videos
  if (category === 'image' || category === 'video') {
    preview = URL.createObjectURL(file);
  }

  return {
    id: generateId(),
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    extension,
    category,
    preview,
  };
}

/**
 * Validate if conversion is possible
 */
export function canConvert(inputExtension: string, outputFormat: string): boolean {
  const inputCategory = detectCategoryFromExtension(inputExtension);
  const outputCategory = detectCategoryFromExtension(outputFormat);

  if (!inputCategory || !outputCategory) return false;

  // Same category conversions are always allowed
  if (inputCategory === outputCategory) return true;

  // Video to audio extraction
  if (inputCategory === 'video' && outputCategory === 'audio') return true;

  // Video to image (frame extraction)
  if (inputCategory === 'video' && outputCategory === 'image') return true;

  // Image to document (PDF)
  if (inputCategory === 'image' && outputFormat === 'pdf') return true;

  return false;
}

/**
 * Get available output formats for a given input file
 */
export function getAvailableOutputFormats(inputExtension: string, inputCategory: FileCategory | null): string[] {
  if (!inputCategory) return [];

  const formats: string[] = [];

  // Same category formats
  switch (inputCategory) {
    case 'image':
      formats.push('png', 'jpg', 'webp', 'gif', 'bmp', 'avif');
      break;
    case 'video':
      formats.push('mp4', 'webm', 'avi', 'mov', 'mkv', 'gif');
      // Can also extract audio
      formats.push('mp3', 'wav', 'aac', 'm4a');
      // Can also extract frame
      formats.push('png', 'jpg');
      break;
    case 'audio':
      formats.push('mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a');
      break;
    case 'document':
      formats.push('pdf', 'txt');
      break;
  }

  // Remove the input format from output options
  return formats.filter(f => f !== inputExtension.toLowerCase());
}
