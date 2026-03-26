// Conversion Worker - Web Worker for handling conversion tasks

import type { WorkerMessage } from './worker-pool';

interface TaskData {
  type: string;
  payload: unknown;
}

// Post message helper
function postResult(taskId: string, data: unknown): void {
  self.postMessage({
    type: 'result',
    taskId,
    data,
  } as WorkerMessage);
}

function postError(taskId: string, error: string): void {
  self.postMessage({
    type: 'error',
    taskId,
    error,
  } as WorkerMessage);
}

function postProgress(taskId: string, progress: number): void {
  self.postMessage({
    type: 'progress',
    taskId,
    progress,
  } as WorkerMessage);
}

// Image processing functions
async function processImage(
  taskId: string,
  imageData: ArrayBuffer,
  outputFormat: string,
  options: { width?: number; height?: number; quality?: number }
): Promise<ArrayBuffer> {
  postProgress(taskId, 10);

  // Create ImageBitmap from ArrayBuffer
  const blob = new Blob([imageData]);
  const bitmap = await createImageBitmap(blob);

  postProgress(taskId, 30);

  // Calculate dimensions
  let width = options.width || bitmap.width;
  let height = options.height || bitmap.height;

  // Maintain aspect ratio if only one dimension specified
  if (options.width && !options.height) {
    height = Math.round((options.width / bitmap.width) * bitmap.height);
  } else if (options.height && !options.width) {
    width = Math.round((options.height / bitmap.height) * bitmap.width);
  }

  // Create offscreen canvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  postProgress(taskId, 50);

  // Draw image
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  postProgress(taskId, 70);

  // Convert to blob
  const mimeType = getMimeType(outputFormat);
  const quality = options.quality || 0.9;
  const outputBlob = await canvas.convertToBlob({
    type: mimeType,
    quality: mimeType.includes('jpeg') || mimeType.includes('webp') ? quality : undefined,
  });

  postProgress(taskId, 90);

  return await outputBlob.arrayBuffer();
}

function getMimeType(format: string): string {
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
  };
  return types[format.toLowerCase()] || 'image/png';
}

// Text processing functions
function processText(
  taskId: string,
  text: string,
  outputFormat: string
): string {
  postProgress(taskId, 30);

  let result: string;

  switch (outputFormat.toLowerCase()) {
    case 'html':
      result = convertTextToHtml(text);
      break;
    case 'md':
    case 'markdown':
      result = convertTextToMarkdown(text);
      break;
    default:
      result = text;
  }

  postProgress(taskId, 100);
  return result;
}

function convertTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Document</title></head>
<body><p>${escaped}</p></body>
</html>`;
}

function convertTextToMarkdown(text: string): string {
  // Basic text to markdown - just preserve the text
  return text;
}

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, taskId, data } = event.data;

  if (type !== 'task' || !taskId) {
    return;
  }

  const taskData = data as TaskData;

  try {
    let result: unknown;

    switch (taskData.type) {
      case 'image':
        const imagePayload = taskData.payload as {
          data: ArrayBuffer;
          format: string;
          options?: { width?: number; height?: number; quality?: number };
        };
        result = await processImage(
          taskId,
          imagePayload.data,
          imagePayload.format,
          imagePayload.options || {}
        );
        break;

      case 'text':
        const textPayload = taskData.payload as {
          text: string;
          format: string;
        };
        result = processText(taskId, textPayload.text, textPayload.format);
        break;

      case 'ping':
        result = 'pong';
        break;

      default:
        throw new Error(`Unknown task type: ${taskData.type}`);
    }

    postResult(taskId, result);
  } catch (error) {
    postError(taskId, error instanceof Error ? error.message : 'Unknown error');
  }
};

// Notify that worker is ready
self.postMessage({ type: 'ready' });
