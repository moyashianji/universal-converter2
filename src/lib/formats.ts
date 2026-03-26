/**
 * Comprehensive format definitions
 * FFmpeg supports 200+ formats - here are the most useful ones
 */

export interface FormatInfo {
	label: string;
	description: string;
	category: 'video' | 'audio' | 'image';
	mimeType: string;
}

// ===== VIDEO FORMATS =====
export const VIDEO_FORMATS: Record<string, FormatInfo> = {
	// Common
	mp4: { label: 'MP4', description: 'H.264/AAC 最も互換性高', category: 'video', mimeType: 'video/mp4' },
	webm: { label: 'WebM', description: 'VP9/Opus Web最適化', category: 'video', mimeType: 'video/webm' },
	mkv: { label: 'MKV', description: 'Matroska 高品質', category: 'video', mimeType: 'video/x-matroska' },
	avi: { label: 'AVI', description: 'レガシー Windows', category: 'video', mimeType: 'video/x-msvideo' },
	mov: { label: 'MOV', description: 'QuickTime Apple', category: 'video', mimeType: 'video/quicktime' },
	wmv: { label: 'WMV', description: 'Windows Media', category: 'video', mimeType: 'video/x-ms-wmv' },
	flv: { label: 'FLV', description: 'Flash Video', category: 'video', mimeType: 'video/x-flv' },
	// Animation
	gif: { label: 'GIF', description: 'アニメーション', category: 'video', mimeType: 'image/gif' },
	apng: { label: 'APNG', description: 'アニメPNG', category: 'video', mimeType: 'image/apng' },
	// Mobile
	'3gp': { label: '3GP', description: 'モバイル向け', category: 'video', mimeType: 'video/3gpp' },
	'3g2': { label: '3G2', description: 'CDMA携帯向け', category: 'video', mimeType: 'video/3gpp2' },
	// Broadcast
	ts: { label: 'TS', description: 'MPEG-TS 放送用', category: 'video', mimeType: 'video/mp2t' },
	mts: { label: 'MTS', description: 'AVCHD カメラ', category: 'video', mimeType: 'video/mp2t' },
	m2ts: { label: 'M2TS', description: 'Blu-ray', category: 'video', mimeType: 'video/mp2t' },
	vob: { label: 'VOB', description: 'DVD Video', category: 'video', mimeType: 'video/dvd' },
	// Other
	m4v: { label: 'M4V', description: 'iTunes Video', category: 'video', mimeType: 'video/x-m4v' },
	mpg: { label: 'MPG', description: 'MPEG-1/2', category: 'video', mimeType: 'video/mpeg' },
	mpeg: { label: 'MPEG', description: 'MPEG-1/2', category: 'video', mimeType: 'video/mpeg' },
	ogv: { label: 'OGV', description: 'Ogg Video', category: 'video', mimeType: 'video/ogg' },
	asf: { label: 'ASF', description: 'Advanced Systems Format', category: 'video', mimeType: 'video/x-ms-asf' },
	f4v: { label: 'F4V', description: 'Flash MP4', category: 'video', mimeType: 'video/mp4' },
	swf: { label: 'SWF', description: 'Flash Animation', category: 'video', mimeType: 'application/x-shockwave-flash' },
	dv: { label: 'DV', description: 'Digital Video', category: 'video', mimeType: 'video/x-dv' },
	// Modern
	av1: { label: 'AV1', description: '次世代コーデック', category: 'video', mimeType: 'video/av1' },
	hevc: { label: 'HEVC', description: 'H.265 高効率', category: 'video', mimeType: 'video/hevc' },
};

// ===== AUDIO FORMATS =====
export const AUDIO_FORMATS: Record<string, FormatInfo> = {
	// Lossy
	mp3: { label: 'MP3', description: 'MPEG Audio 最普及', category: 'audio', mimeType: 'audio/mpeg' },
	aac: { label: 'AAC', description: '高効率圧縮', category: 'audio', mimeType: 'audio/aac' },
	ogg: { label: 'OGG', description: 'Vorbis オープン', category: 'audio', mimeType: 'audio/ogg' },
	opus: { label: 'Opus', description: '最新 低遅延', category: 'audio', mimeType: 'audio/opus' },
	wma: { label: 'WMA', description: 'Windows Media', category: 'audio', mimeType: 'audio/x-ms-wma' },
	m4a: { label: 'M4A', description: 'Apple AAC', category: 'audio', mimeType: 'audio/mp4' },
	// Lossless
	wav: { label: 'WAV', description: '無圧縮 PCM', category: 'audio', mimeType: 'audio/wav' },
	flac: { label: 'FLAC', description: '可逆圧縮 高音質', category: 'audio', mimeType: 'audio/flac' },
	alac: { label: 'ALAC', description: 'Apple Lossless', category: 'audio', mimeType: 'audio/mp4' },
	aiff: { label: 'AIFF', description: 'Apple 無圧縮', category: 'audio', mimeType: 'audio/aiff' },
	ape: { label: 'APE', description: "Monkey's Audio", category: 'audio', mimeType: 'audio/ape' },
	// Other
	ac3: { label: 'AC3', description: 'Dolby Digital', category: 'audio', mimeType: 'audio/ac3' },
	dts: { label: 'DTS', description: 'DTS Digital', category: 'audio', mimeType: 'audio/vnd.dts' },
	amr: { label: 'AMR', description: '音声通話用', category: 'audio', mimeType: 'audio/amr' },
	au: { label: 'AU', description: 'Sun/Unix', category: 'audio', mimeType: 'audio/basic' },
	ra: { label: 'RA', description: 'RealAudio', category: 'audio', mimeType: 'audio/x-realaudio' },
	mka: { label: 'MKA', description: 'Matroska Audio', category: 'audio', mimeType: 'audio/x-matroska' },
	weba: { label: 'WebA', description: 'WebM Audio', category: 'audio', mimeType: 'audio/webm' },
	oga: { label: 'OGA', description: 'Ogg Audio', category: 'audio', mimeType: 'audio/ogg' },
	spx: { label: 'SPX', description: 'Speex 音声', category: 'audio', mimeType: 'audio/ogg' },
	caf: { label: 'CAF', description: 'Core Audio', category: 'audio', mimeType: 'audio/x-caf' },
	// MIDI
	mid: { label: 'MIDI', description: '楽器デジタル', category: 'audio', mimeType: 'audio/midi' },
};

// ===== IMAGE FORMATS =====
export const IMAGE_FORMATS: Record<string, FormatInfo> = {
	// Common
	png: { label: 'PNG', description: '透過対応 可逆', category: 'image', mimeType: 'image/png' },
	jpg: { label: 'JPG', description: '写真向け 圧縮', category: 'image', mimeType: 'image/jpeg' },
	jpeg: { label: 'JPEG', description: '写真向け 圧縮', category: 'image', mimeType: 'image/jpeg' },
	webp: { label: 'WebP', description: '次世代 高圧縮', category: 'image', mimeType: 'image/webp' },
	gif: { label: 'GIF', description: 'アニメ対応', category: 'image', mimeType: 'image/gif' },
	bmp: { label: 'BMP', description: '無圧縮 Windows', category: 'image', mimeType: 'image/bmp' },
	// Modern
	avif: { label: 'AVIF', description: 'AV1画像 最新', category: 'image', mimeType: 'image/avif' },
	heic: { label: 'HEIC', description: 'iPhone形式', category: 'image', mimeType: 'image/heic' },
	heif: { label: 'HEIF', description: '高効率画像', category: 'image', mimeType: 'image/heif' },
	jxl: { label: 'JXL', description: 'JPEG XL 次世代', category: 'image', mimeType: 'image/jxl' },
	// Professional
	tiff: { label: 'TIFF', description: '印刷向け 高品質', category: 'image', mimeType: 'image/tiff' },
	tif: { label: 'TIF', description: '印刷向け 高品質', category: 'image', mimeType: 'image/tiff' },
	psd: { label: 'PSD', description: 'Photoshop', category: 'image', mimeType: 'image/vnd.adobe.photoshop' },
	// Icons
	ico: { label: 'ICO', description: 'アイコン', category: 'image', mimeType: 'image/x-icon' },
	icns: { label: 'ICNS', description: 'Mac アイコン', category: 'image', mimeType: 'image/x-icns' },
	// Vector (rasterization)
	svg: { label: 'SVG', description: 'ベクター', category: 'image', mimeType: 'image/svg+xml' },
	// Other
	tga: { label: 'TGA', description: 'Targa', category: 'image', mimeType: 'image/x-tga' },
	pcx: { label: 'PCX', description: 'PC Paintbrush', category: 'image', mimeType: 'image/x-pcx' },
	ppm: { label: 'PPM', description: 'Portable Pixmap', category: 'image', mimeType: 'image/x-portable-pixmap' },
	pgm: { label: 'PGM', description: 'Portable Graymap', category: 'image', mimeType: 'image/x-portable-graymap' },
	pbm: { label: 'PBM', description: 'Portable Bitmap', category: 'image', mimeType: 'image/x-portable-bitmap' },
	xpm: { label: 'XPM', description: 'X PixMap', category: 'image', mimeType: 'image/x-xpixmap' },
	xbm: { label: 'XBM', description: 'X BitMap', category: 'image', mimeType: 'image/x-xbitmap' },
	dds: { label: 'DDS', description: 'DirectDraw', category: 'image', mimeType: 'image/vnd.ms-dds' },
	exr: { label: 'EXR', description: 'OpenEXR HDR', category: 'image', mimeType: 'image/x-exr' },
	hdr: { label: 'HDR', description: 'Radiance HDR', category: 'image', mimeType: 'image/vnd.radiance' },
	// RAW Camera formats (read-only typically)
	raw: { label: 'RAW', description: 'カメラRAW', category: 'image', mimeType: 'image/x-raw' },
};

// Most commonly used formats for output (prioritized)
export const COMMON_VIDEO_OUTPUTS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'gif', 'wmv', 'flv', '3gp', 'ts', 'mpg', 'ogv', 'm4v'];
export const COMMON_AUDIO_OUTPUTS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'opus', 'wma', 'aiff', 'ac3', 'amr'];
export const COMMON_IMAGE_OUTPUTS = ['png', 'jpg', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'avif', 'tga'];

// All formats for input detection
export const ALL_VIDEO_EXTENSIONS = Object.keys(VIDEO_FORMATS);
export const ALL_AUDIO_EXTENSIONS = Object.keys(AUDIO_FORMATS);
export const ALL_IMAGE_EXTENSIONS = Object.keys(IMAGE_FORMATS);

export function getFormatInfo(format: string): FormatInfo | undefined {
	return VIDEO_FORMATS[format] || AUDIO_FORMATS[format] || IMAGE_FORMATS[format];
}

export function getMimeType(format: string): string {
	const info = getFormatInfo(format);
	return info?.mimeType || 'application/octet-stream';
}
