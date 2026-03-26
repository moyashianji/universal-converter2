// Worker Pool - Manages a pool of Web Workers for parallel processing

export interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export interface WorkerPoolOptions {
  maxWorkers?: number;
  workerScript?: string;
  timeout?: number;
}

export interface WorkerMessage {
  type: 'init' | 'task' | 'result' | 'error' | 'progress';
  taskId?: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

class WorkerWrapper {
  worker: Worker;
  busy = false;
  currentTaskId: string | null = null;

  constructor(worker: Worker) {
    this.worker = worker;
  }
}

export class WorkerPool {
  private workers: WorkerWrapper[] = [];
  private taskQueue: WorkerTask[] = [];
  private maxWorkers: number;
  private workerScript: string;
  private timeout: number;
  private taskCallbacks: Map<string, WorkerTask> = new Map();
  private progressCallbacks: Map<string, (progress: number) => void> = new Map();
  private initialized = false;

  constructor(options: WorkerPoolOptions = {}) {
    this.maxWorkers = options.maxWorkers || navigator.hardwareConcurrency || 4;
    this.workerScript = options.workerScript || '';
    this.timeout = options.timeout || 300000; // 5 minutes default
  }

  /**
   * Initialize the worker pool
   */
  async init(workerScript?: string): Promise<void> {
    if (this.initialized) return;

    if (workerScript) {
      this.workerScript = workerScript;
    }

    if (!this.workerScript) {
      throw new Error('Worker script not specified');
    }

    // Create workers
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(this.workerScript, { type: 'module' });
      const wrapper = new WorkerWrapper(worker);

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(wrapper, event.data);
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.handleWorkerError(wrapper, error);
      };

      this.workers.push(wrapper);
    }

    this.initialized = true;
  }

  /**
   * Execute a task in the worker pool
   */
  async execute<T, R>(
    type: string,
    data: T,
    onProgress?: (progress: number) => void
  ): Promise<R> {
    if (!this.initialized) {
      throw new Error('Worker pool not initialized');
    }

    const taskId = this.generateTaskId();

    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: taskId,
        type,
        data,
        resolve: resolve as (result: unknown) => void,
        reject,
      };

      this.taskCallbacks.set(taskId, task as WorkerTask);

      if (onProgress) {
        this.progressCallbacks.set(taskId, onProgress);
      }

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.taskCallbacks.delete(taskId);
        this.progressCallbacks.delete(taskId);
        reject(new Error('Task timeout'));
      }, this.timeout);

      // Store timeout for cleanup
      (task as any).timeoutId = timeoutId;

      // Try to assign to available worker or queue
      this.assignTaskOrQueue(task as WorkerTask);
    });
  }

  /**
   * Assign task to available worker or add to queue
   */
  private assignTaskOrQueue(task: WorkerTask): void {
    const availableWorker = this.workers.find((w) => !w.busy);

    if (availableWorker) {
      this.assignTaskToWorker(availableWorker, task);
    } else {
      this.taskQueue.push(task);
    }
  }

  /**
   * Assign a task to a specific worker
   */
  private assignTaskToWorker(wrapper: WorkerWrapper, task: WorkerTask): void {
    wrapper.busy = true;
    wrapper.currentTaskId = task.id;

    const message: WorkerMessage = {
      type: 'task',
      taskId: task.id,
      data: { type: task.type, payload: task.data },
    };

    wrapper.worker.postMessage(message);
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(wrapper: WorkerWrapper, message: WorkerMessage): void {
    const { type, taskId, data, error, progress } = message;

    if (type === 'progress' && taskId) {
      const progressCallback = this.progressCallbacks.get(taskId);
      if (progressCallback && progress !== undefined) {
        progressCallback(progress);
      }
      return;
    }

    if (type === 'result' || type === 'error') {
      const task = taskId ? this.taskCallbacks.get(taskId) : null;

      if (task) {
        // Clear timeout
        if ((task as any).timeoutId) {
          clearTimeout((task as any).timeoutId);
        }

        // Remove callbacks
        this.taskCallbacks.delete(task.id);
        this.progressCallbacks.delete(task.id);

        if (type === 'error') {
          task.reject(new Error(error || 'Unknown worker error'));
        } else {
          task.resolve(data);
        }
      }

      // Mark worker as available and process next task
      wrapper.busy = false;
      wrapper.currentTaskId = null;
      this.processNextTask(wrapper);
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(wrapper: WorkerWrapper, error: ErrorEvent): void {
    if (wrapper.currentTaskId) {
      const task = this.taskCallbacks.get(wrapper.currentTaskId);
      if (task) {
        if ((task as any).timeoutId) {
          clearTimeout((task as any).timeoutId);
        }
        this.taskCallbacks.delete(task.id);
        this.progressCallbacks.delete(task.id);
        task.reject(new Error(error.message || 'Worker error'));
      }
    }

    wrapper.busy = false;
    wrapper.currentTaskId = null;
    this.processNextTask(wrapper);
  }

  /**
   * Process next task in queue
   */
  private processNextTask(wrapper: WorkerWrapper): void {
    if (this.taskQueue.length > 0 && !wrapper.busy) {
      const nextTask = this.taskQueue.shift();
      if (nextTask) {
        this.assignTaskToWorker(wrapper, nextTask);
      }
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    pendingTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.taskCallbacks.size,
    };
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    // Reject all pending tasks
    for (const task of this.taskCallbacks.values()) {
      if ((task as any).timeoutId) {
        clearTimeout((task as any).timeoutId);
      }
      task.reject(new Error('Worker pool terminated'));
    }

    this.taskCallbacks.clear();
    this.progressCallbacks.clear();
    this.taskQueue = [];

    // Terminate workers
    for (const wrapper of this.workers) {
      wrapper.worker.terminate();
    }

    this.workers = [];
    this.initialized = false;
  }

  /**
   * Check if pool is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }
}

// Default pool instance
export const workerPool = new WorkerPool();
