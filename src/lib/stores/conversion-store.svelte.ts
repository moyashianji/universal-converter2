// Conversion Store - Svelte 5 state management for conversions

import type {
  FileInfo,
  ConversionJob,
  ConversionState,
  ConversionOptions,
  FileCategory,
} from '../core/types';
import { generateId } from '../core/types';

// Types
export interface ConversionItem {
  id: string;
  fileInfo: FileInfo;
  targetFormat: string;
  options: ConversionOptions;
  state: ConversionState;
  outputBlob?: Blob;
}

export interface ConversionStoreState {
  items: ConversionItem[];
  currentItemId: string | null;
  isProcessing: boolean;
  engineLoaded: boolean;
  error: string | null;
}

// Initial state
function createInitialState(): ConversionStoreState {
  return {
    items: [],
    currentItemId: null,
    isProcessing: false,
    engineLoaded: false,
    error: null,
  };
}

// Store implementation using Svelte 5 runes pattern
class ConversionStore {
  private state = $state<ConversionStoreState>(createInitialState());

  // Getters
  get items() {
    return this.state.items;
  }

  get currentItemId() {
    return this.state.currentItemId;
  }

  get currentItem() {
    return this.state.items.find((item) => item.id === this.state.currentItemId) || null;
  }

  get isProcessing() {
    return this.state.isProcessing;
  }

  get engineLoaded() {
    return this.state.engineLoaded;
  }

  get error() {
    return this.state.error;
  }

  get hasItems() {
    return this.state.items.length > 0;
  }

  get completedItems() {
    return this.state.items.filter((item) => item.state.status === 'complete');
  }

  get pendingItems() {
    return this.state.items.filter((item) => item.state.status === 'idle');
  }

  // Actions
  addItem(fileInfo: FileInfo, targetFormat: string, options: ConversionOptions = {}): string {
    const id = generateId();
    const item: ConversionItem = {
      id,
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

    this.state.items = [...this.state.items, item];

    if (!this.state.currentItemId) {
      this.state.currentItemId = id;
    }

    return id;
  }

  removeItem(id: string): void {
    const item = this.state.items.find((i) => i.id === id);
    if (item?.state.outputUrl) {
      URL.revokeObjectURL(item.state.outputUrl);
    }

    this.state.items = this.state.items.filter((i) => i.id !== id);

    if (this.state.currentItemId === id) {
      this.state.currentItemId = this.state.items[0]?.id || null;
    }
  }

  setCurrentItem(id: string): void {
    if (this.state.items.some((item) => item.id === id)) {
      this.state.currentItemId = id;
    }
  }

  updateItemState(id: string, stateUpdate: Partial<ConversionState>): void {
    this.state.items = this.state.items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          state: { ...item.state, ...stateUpdate },
        };
      }
      return item;
    });
  }

  setItemTargetFormat(id: string, format: string): void {
    this.state.items = this.state.items.map((item) => {
      if (item.id === id) {
        return { ...item, targetFormat: format };
      }
      return item;
    });
  }

  setItemOptions(id: string, options: ConversionOptions): void {
    this.state.items = this.state.items.map((item) => {
      if (item.id === id) {
        return { ...item, options: { ...item.options, ...options } };
      }
      return item;
    });
  }

  setItemOutput(id: string, blob: Blob, url: string, fileName: string): void {
    this.state.items = this.state.items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          outputBlob: blob,
          state: {
            ...item.state,
            outputUrl: url,
            outputFileName: fileName,
          },
        };
      }
      return item;
    });
  }

  setProcessing(isProcessing: boolean): void {
    this.state.isProcessing = isProcessing;
  }

  setEngineLoaded(loaded: boolean): void {
    this.state.engineLoaded = loaded;
  }

  setError(error: string | null): void {
    this.state.error = error;
  }

  clearError(): void {
    this.state.error = null;
  }

  clearCompleted(): void {
    const completedItems = this.state.items.filter((i) => i.state.status === 'complete');
    for (const item of completedItems) {
      if (item.state.outputUrl) {
        URL.revokeObjectURL(item.state.outputUrl);
      }
    }

    this.state.items = this.state.items.filter((i) => i.state.status !== 'complete');

    if (this.state.currentItemId && !this.state.items.some((i) => i.id === this.state.currentItemId)) {
      this.state.currentItemId = this.state.items[0]?.id || null;
    }
  }

  reset(): void {
    // Clean up URLs
    for (const item of this.state.items) {
      if (item.state.outputUrl) {
        URL.revokeObjectURL(item.state.outputUrl);
      }
    }

    this.state = createInitialState();
  }
}

// Export singleton instance
export const conversionStore = new ConversionStore();
