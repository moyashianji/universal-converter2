// Conversion Orchestrator - Manages the conversion pipeline

import type {
  ConversionJob,
  ConversionState,
  ConversionOptions,
  ConversionResult,
  FileInfo,
  ProgressCallback,
  FileCategory,
} from './types';
import { generateId, getMimeType } from './types';
import { detectFileFormat } from './format-detector';

export interface ConversionEngine {
  name: string;
  category: FileCategory;
  supportedInputFormats: string[];
  supportedOutputFormats: string[];
  isLoaded: boolean;
  load(): Promise<void>;
  convert(
    input: File | Blob,
    outputFormat: string,
    options?: ConversionOptions,
    onProgress?: ProgressCallback
  ): Promise<ConversionResult>;
  canConvert(inputFormat: string, outputFormat: string): boolean;
  unload(): void;
}

class ConversionOrchestrator {
  private engines: Map<string, ConversionEngine> = new Map();
  private activeJobs: Map<string, ConversionJob> = new Map();
  private jobQueue: ConversionJob[] = [];
  private maxConcurrentJobs = 2;
  private runningJobs = 0;

  /**
   * Register a conversion engine
   */
  registerEngine(engine: ConversionEngine): void {
    this.engines.set(engine.name, engine);
  }

  /**
   * Get all registered engines
   */
  getEngines(): ConversionEngine[] {
    return Array.from(this.engines.values());
  }

  /**
   * Find the best engine for a conversion task
   */
  findEngine(inputFormat: string, outputFormat: string): ConversionEngine | null {
    for (const engine of this.engines.values()) {
      if (engine.canConvert(inputFormat, outputFormat)) {
        return engine;
      }
    }
    return null;
  }

  /**
   * Create a new conversion job
   */
  createJob(
    fileInfo: FileInfo,
    targetFormat: string,
    options: ConversionOptions = {}
  ): ConversionJob {
    const job: ConversionJob = {
      id: generateId(),
      fileInfo,
      targetFormat,
      options,
      state: {
        status: 'idle',
        progress: 0,
        message: '',
        outputUrl: null,
        outputFileName: null,
      },
    };

    this.activeJobs.set(job.id, job);
    return job;
  }

  /**
   * Execute a conversion job
   */
  async executeJob(
    job: ConversionJob,
    onProgress?: ProgressCallback
  ): Promise<ConversionResult> {
    const updateState = (update: Partial<ConversionState>) => {
      job.state = { ...job.state, ...update };
      onProgress?.(job.state);
    };

    try {
      job.startTime = Date.now();
      updateState({ status: 'analyzing', message: 'ファイルを分析中...' });

      // Detect input format
      const formatInfo = await detectFileFormat(job.fileInfo.file);
      if (!formatInfo) {
        throw new Error('サポートされていないファイル形式です');
      }

      // Find appropriate engine
      const engine = this.findEngine(formatInfo.format, job.targetFormat);
      if (!engine) {
        throw new Error(
          `${formatInfo.format} から ${job.targetFormat} への変換はサポートされていません`
        );
      }

      // Load engine if needed
      if (!engine.isLoaded) {
        updateState({ status: 'loading', message: `${engine.name}を読み込み中...` });
        await engine.load();
      }

      // Perform conversion
      updateState({ status: 'converting', progress: 0, message: '変換を開始...' });

      const result = await engine.convert(
        job.fileInfo.file,
        job.targetFormat,
        job.options,
        (state) => {
          updateState(state);
        }
      );

      if (!result.success || !result.blob) {
        throw result.error || new Error('変換に失敗しました');
      }

      // Create output URL and filename
      const outputFileName = this.generateOutputFileName(
        job.fileInfo.name,
        job.targetFormat
      );
      const outputUrl = URL.createObjectURL(result.blob);

      job.endTime = Date.now();
      job.outputBlob = result.blob;

      updateState({
        status: 'complete',
        progress: 100,
        message: '変換完了!',
        outputUrl,
        outputFileName,
      });

      return {
        success: true,
        blob: result.blob,
        url: outputUrl,
        fileName: outputFileName,
        duration: job.endTime - job.startTime,
      };
    } catch (error) {
      job.endTime = Date.now();
      const errorMessage =
        error instanceof Error ? error.message : '不明なエラーが発生しました';

      updateState({
        status: 'error',
        message: errorMessage,
        error: error instanceof Error ? error : new Error(errorMessage),
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
        duration: job.endTime - (job.startTime || job.endTime),
      };
    }
  }

  /**
   * Queue a job for execution
   */
  queueJob(job: ConversionJob, onProgress?: ProgressCallback): void {
    this.jobQueue.push(job);
    this.processQueue(onProgress);
  }

  /**
   * Process queued jobs
   */
  private async processQueue(onProgress?: ProgressCallback): Promise<void> {
    while (this.jobQueue.length > 0 && this.runningJobs < this.maxConcurrentJobs) {
      const job = this.jobQueue.shift();
      if (!job) break;

      this.runningJobs++;
      this.executeJob(job, onProgress).finally(() => {
        this.runningJobs--;
        this.processQueue(onProgress);
      });
    }
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const queueIndex = this.jobQueue.findIndex((j) => j.id === jobId);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
      return true;
    }

    const job = this.activeJobs.get(jobId);
    if (job && job.state.status === 'converting') {
      job.state = {
        ...job.state,
        status: 'error',
        message: 'キャンセルされました',
      };
      return true;
    }

    return false;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ConversionJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Clean up completed job
   */
  cleanupJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job?.state.outputUrl) {
      URL.revokeObjectURL(job.state.outputUrl);
    }
    this.activeJobs.delete(jobId);
  }

  /**
   * Generate output filename
   */
  private generateOutputFileName(inputName: string, outputFormat: string): string {
    const baseName = inputName.replace(/\.[^/.]+$/, '');
    return `${baseName}.${outputFormat}`;
  }

  /**
   * Get supported output formats for a given input
   */
  getSupportedOutputFormats(inputFormat: string): string[] {
    const formats = new Set<string>();

    for (const engine of this.engines.values()) {
      if (engine.supportedInputFormats.includes(inputFormat.toLowerCase())) {
        engine.supportedOutputFormats.forEach((f) => formats.add(f));
      }
    }

    return Array.from(formats);
  }

  /**
   * Check if conversion is supported
   */
  isConversionSupported(inputFormat: string, outputFormat: string): boolean {
    return this.findEngine(inputFormat, outputFormat) !== null;
  }

  /**
   * Set maximum concurrent jobs
   */
  setMaxConcurrentJobs(max: number): void {
    this.maxConcurrentJobs = Math.max(1, max);
  }
}

// Singleton instance
export const orchestrator = new ConversionOrchestrator();

// Export class for testing
export { ConversionOrchestrator };
