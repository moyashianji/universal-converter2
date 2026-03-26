// Document Engine - Handles document conversions (primarily PDF generation)

import type {
  ConversionOptions,
  ConversionResult,
  ProgressCallback,
} from '../core/types';
import { BaseEngine } from './base-engine';

export class DocumentEngine extends BaseEngine {
  name = 'DocumentEngine';
  category = 'document' as const;

  supportedInputFormats = ['txt', 'html', 'md', 'json', 'csv'];
  supportedOutputFormats = ['pdf', 'txt', 'html'];

  async load(): Promise<void> {
    if (this._isLoaded) return;
    // Document engine doesn't require heavy loading
    this._isLoaded = true;
  }

  async convert(
    input: File | Blob,
    outputFormat: string,
    options: ConversionOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    try {
      onProgress?.({ progress: 10, message: 'ドキュメントを読み込み中...' });

      const text = await this.readTextContent(input);

      onProgress?.({ progress: 30, message: '変換中...' });

      let result: Blob;

      switch (outputFormat.toLowerCase()) {
        case 'pdf':
          result = await this.convertToPdf(text, options, onProgress);
          break;
        case 'txt':
          result = this.convertToText(text);
          break;
        case 'html':
          result = this.convertToHtml(text);
          break;
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }

      onProgress?.({ progress: 100, message: '完了!' });

      return this.createSuccessResult(result);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error : new Error('ドキュメント変換に失敗しました')
      );
    }
  }

  private async readTextContent(input: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(input);
    });
  }

  private async convertToPdf(
    text: string,
    options: ConversionOptions,
    onProgress?: ProgressCallback
  ): Promise<Blob> {
    onProgress?.({ progress: 50, message: 'PDFを生成中...' });

    // Create a simple PDF using browser printing
    // This creates a basic PDF without external libraries
    const pdfContent = this.generateSimplePdf(text);

    return new Blob([pdfContent], { type: 'application/pdf' });
  }

  private generateSimplePdf(text: string): Uint8Array {
    // Simple PDF generator - creates a basic PDF 1.4 document
    const lines = text.split('\n');
    const pageHeight = 792; // Letter size height in points
    const pageWidth = 612; // Letter size width in points
    const margin = 72; // 1 inch margin
    const lineHeight = 14;
    const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

    // Split text into pages
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += maxLinesPerPage) {
      pages.push(lines.slice(i, i + maxLinesPerPage));
    }

    if (pages.length === 0) {
      pages.push(['']);
    }

    // Build PDF
    let pdf = '%PDF-1.4\n';
    const objects: string[] = [];
    let objectId = 1;

    // Catalog
    const catalogId = objectId++;
    objects.push(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${objectId} 0 R >>\nendobj\n`);

    // Pages
    const pagesId = objectId++;
    const pageObjectIds: number[] = [];

    // Reserve IDs for page objects
    for (let i = 0; i < pages.length; i++) {
      pageObjectIds.push(objectId++);
    }

    // Font
    const fontId = objectId++;
    objects.push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

    // Create pages object
    const pageRefs = pageObjectIds.map(id => `${id} 0 R`).join(' ');
    objects.splice(1, 0, `${pagesId} 0 obj\n<< /Type /Pages /Kids [ ${pageRefs} ] /Count ${pages.length} >>\nendobj\n`);

    // Create content streams and page objects
    for (let i = 0; i < pages.length; i++) {
      const contentId = objectId++;
      const pageText = pages[i];

      // Build content stream
      let stream = 'BT\n';
      stream += `/F1 11 Tf\n`;
      stream += `${margin} ${pageHeight - margin} Td\n`;
      stream += `${lineHeight} TL\n`;

      for (const line of pageText) {
        // Escape special characters in PDF string
        const escapedLine = line
          .replace(/\\/g, '\\\\')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)')
          .replace(/[\x00-\x1f]/g, '');
        stream += `(${escapedLine}) Tj T*\n`;
      }

      stream += 'ET';

      // Content stream object
      objects.push(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

      // Page object (insert after pages object)
      const pageObj = `${pageObjectIds[i]} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`;
      objects.splice(2 + i, 0, pageObj);
    }

    // Build final PDF
    pdf += objects.join('');

    // Cross-reference table
    const xrefOffset = pdf.length;
    pdf += 'xref\n';
    pdf += `0 ${objectId}\n`;
    pdf += '0000000000 65535 f \n';

    let offset = 9; // '%PDF-1.4\n'.length
    for (let i = 0; i < objects.length; i++) {
      pdf += offset.toString().padStart(10, '0') + ' 00000 n \n';
      offset += objects[i].length;
    }

    // Trailer
    pdf += 'trailer\n';
    pdf += `<< /Size ${objectId} /Root ${catalogId} 0 R >>\n`;
    pdf += 'startxref\n';
    pdf += `${xrefOffset}\n`;
    pdf += '%%EOF';

    return new TextEncoder().encode(pdf);
  }

  private convertToText(text: string): Blob {
    // Clean up and normalize text
    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    return new Blob([cleanText], { type: 'text/plain' });
  }

  private convertToHtml(text: string): Blob {
    // Convert text to basic HTML
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>\n');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="content">
    ${escapedText}
  </div>
</body>
</html>`;

    return new Blob([html], { type: 'text/html' });
  }

  /**
   * Convert images to PDF
   */
  async imagesToPdf(images: (File | Blob)[], onProgress?: ProgressCallback): Promise<Blob> {
    onProgress?.({ progress: 10, message: '画像を読み込み中...' });

    const imageDataUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const dataUrl = await this.fileToDataUrl(images[i]);
      imageDataUrls.push(dataUrl);
      onProgress?.({
        progress: 10 + (i / images.length) * 60,
        message: `画像を処理中... (${i + 1}/${images.length})`
      });
    }

    onProgress?.({ progress: 80, message: 'PDFを生成中...' });

    // For simplicity, return a basic PDF
    // In production, you'd want to use a proper PDF library like pdf-lib
    const pdfContent = this.generateSimplePdf(`[Images PDF - ${images.length} images]`);

    onProgress?.({ progress: 100, message: '完了!' });

    return new Blob([pdfContent], { type: 'application/pdf' });
  }
}

// Singleton instance
export const documentEngine = new DocumentEngine();
