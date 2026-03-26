// Origin Private File System Manager
// Provides persistent storage for large files during conversion

import type { OPFSFile, OPFSManager as IOPFSManager } from './types';

class OPFSManagerImpl implements IOPFSManager {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private initialized = false;

  get isSupported(): boolean {
    return 'storage' in navigator && 'getDirectory' in navigator.storage;
  }

  async init(): Promise<void> {
    if (!this.isSupported) {
      console.warn('OPFS is not supported in this browser');
      return;
    }

    if (this.initialized) return;

    try {
      this.rootHandle = await navigator.storage.getDirectory();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OPFS:', error);
      throw error;
    }
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    if (!this.rootHandle) {
      throw new Error('OPFS not available');
    }
  }

  private async getDirectory(path: string): Promise<FileSystemDirectoryHandle> {
    await this.ensureInit();

    const parts = path.split('/').filter(p => p.length > 0);
    let current = this.rootHandle!;

    // Navigate to parent directory, creating if needed
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create: true });
    }

    return current;
  }

  private getFileName(path: string): string {
    const parts = path.split('/').filter(p => p.length > 0);
    return parts[parts.length - 1] || path;
  }

  async writeFile(path: string, data: ArrayBuffer | Blob): Promise<void> {
    await this.ensureInit();

    try {
      const directory = await this.getDirectory(path);
      const fileName = this.getFileName(path);
      const fileHandle = await directory.getFileHandle(fileName, { create: true });

      // Use sync access handle for better performance if available
      if ('createSyncAccessHandle' in fileHandle) {
        try {
          const accessHandle = await (fileHandle as any).createSyncAccessHandle();
          const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
          accessHandle.write(new Uint8Array(buffer), { at: 0 });
          accessHandle.flush();
          accessHandle.close();
          return;
        } catch {
          // Fall back to writable stream
        }
      }

      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch (error) {
      console.error('Failed to write file to OPFS:', error);
      throw error;
    }
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.ensureInit();

    try {
      const directory = await this.getDirectory(path);
      const fileName = this.getFileName(path);
      const fileHandle = await directory.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
    } catch (error) {
      console.error('Failed to read file from OPFS:', error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    await this.ensureInit();

    try {
      const directory = await this.getDirectory(path);
      const fileName = this.getFileName(path);
      await directory.removeEntry(fileName);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as Error).name !== 'NotFoundError') {
        console.error('Failed to delete file from OPFS:', error);
        throw error;
      }
    }
  }

  async listFiles(directory: string = ''): Promise<OPFSFile[]> {
    await this.ensureInit();

    const files: OPFSFile[] = [];

    try {
      let dirHandle = this.rootHandle!;

      if (directory) {
        const parts = directory.split('/').filter(p => p.length > 0);
        for (const part of parts) {
          dirHandle = await dirHandle.getDirectoryHandle(part);
        }
      }

      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (handle.kind === 'file') {
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          files.push({
            name,
            path: directory ? `${directory}/${name}` : name,
            size: file.size,
            lastModified: file.lastModified,
            handle: fileHandle,
          });
        }
      }
    } catch (error) {
      console.error('Failed to list files in OPFS:', error);
    }

    return files;
  }

  async getUsedSpace(): Promise<number> {
    await this.ensureInit();

    let totalSize = 0;

    const countSize = async (dirHandle: FileSystemDirectoryHandle): Promise<void> => {
      for await (const [, handle] of (dirHandle as any).entries()) {
        if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          totalSize += file.size;
        } else if (handle.kind === 'directory') {
          await countSize(handle as FileSystemDirectoryHandle);
        }
      }
    };

    try {
      await countSize(this.rootHandle!);
    } catch (error) {
      console.error('Failed to calculate OPFS usage:', error);
    }

    return totalSize;
  }

  async clearAll(): Promise<void> {
    await this.ensureInit();

    try {
      const entries: string[] = [];

      for await (const [name] of (this.rootHandle as any).entries()) {
        entries.push(name);
      }

      for (const name of entries) {
        await this.rootHandle!.removeEntry(name, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to clear OPFS:', error);
      throw error;
    }
  }

  /**
   * Create a temporary file and return its path
   */
  async createTempFile(extension: string = ''): Promise<string> {
    const tempDir = 'temp';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${extension ? `.${extension}` : ''}`;
    const path = `${tempDir}/${fileName}`;

    // Create temp directory if needed
    await this.ensureInit();
    await this.rootHandle!.getDirectoryHandle(tempDir, { create: true });

    return path;
  }

  /**
   * Clean up old temporary files (older than given age in ms)
   */
  async cleanupTempFiles(maxAge: number = 3600000): Promise<void> {
    const now = Date.now();
    const tempFiles = await this.listFiles('temp');

    for (const file of tempFiles) {
      if (now - file.lastModified > maxAge) {
        await this.deleteFile(file.path);
      }
    }
  }
}

// Singleton instance
export const opfsManager = new OPFSManagerImpl();

// Export class for testing
export { OPFSManagerImpl };
