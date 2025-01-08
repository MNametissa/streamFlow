import { FileItem, UploadState, ChunkState } from '@/types';
import { Chunk } from './chunking';

interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix: string = 'streamflow_') {
    this.prefix = prefix;
  }

  async get(key: string): Promise<string | null> {
    return localStorage.getItem(this.prefix + key);
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(this.prefix + key, value);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }
}

class IndexedDBAdapter implements StorageAdapter {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'streamflow_db', storeName: string = 'upload_states') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async initDB(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(key: string): Promise<string | null> {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async set(key: string, value: string): Promise<void> {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export class StateManager {
  private storage: StorageAdapter;
  private memoryStates: Map<string, UploadState>;
  private autoSaveInterval: number;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(
    storage: StorageAdapter = new IndexedDBAdapter(),
    autoSaveInterval: number = 5000
  ) {
    this.storage = storage;
    this.memoryStates = new Map();
    this.autoSaveInterval = autoSaveInterval;
    this.startAutoSave();
  }

  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    this.autoSaveTimer = setInterval(() => {
      this.saveAllStates();
    }, this.autoSaveInterval);
  }

  private async saveAllStates(): Promise<void> {
    const promises = Array.from(this.memoryStates.entries()).map(([fileId, state]) =>
      this.saveState(fileId, state)
    );
    await Promise.all(promises);
  }

  private getStateKey(fileId: string): string {
    return `upload_state_${fileId}`;
  }

  private getChunkKey(fileId: string, chunkIndex: number): string {
    return `chunk_state_${fileId}_${chunkIndex}`;
  }

  async saveState(fileId: string, state: UploadState): Promise<void> {
    this.memoryStates.set(fileId, state);
    await this.storage.set(this.getStateKey(fileId), JSON.stringify(state));
  }

  async getState(fileId: string): Promise<UploadState | null> {
    // Check memory first
    if (this.memoryStates.has(fileId)) {
      return this.memoryStates.get(fileId)!;
    }

    // Check persistent storage
    const stored = await this.storage.get(this.getStateKey(fileId));
    if (stored) {
      const state = JSON.parse(stored) as UploadState;
      this.memoryStates.set(fileId, state);
      return state;
    }

    return null;
  }

  async saveChunkState(fileId: string, chunk: Chunk, state: ChunkState): Promise<void> {
    const key = this.getChunkKey(fileId, chunk.index);
    await this.storage.set(key, JSON.stringify(state));
  }

  async getChunkState(fileId: string, chunkIndex: number): Promise<ChunkState | null> {
    const key = this.getChunkKey(fileId, chunkIndex);
    const stored = await this.storage.get(key);
    return stored ? JSON.parse(stored) as ChunkState : null;
  }

  async removeState(fileId: string): Promise<void> {
    this.memoryStates.delete(fileId);
    await this.storage.remove(this.getStateKey(fileId));
  }

  async initializeState(fileItem: FileItem): Promise<UploadState> {
    const state: UploadState = {
      fileId: fileItem.id,
      fileName: fileItem.file.name,
      fileSize: fileItem.file.size,
      mimeType: fileItem.file.type,
      totalChunks: 0,
      uploadedChunks: [],
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      bytesUploaded: 0,
      status: 'initialized',
      resumeToken: crypto.randomUUID(),
      checksum: await this.calculateFileChecksum(fileItem.file)
    };

    await this.saveState(fileItem.id, state);
    return state;
  }

  private async calculateFileChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async updateProgress(
    fileId: string,
    chunkIndex: number,
    bytesUploaded: number
  ): Promise<void> {
    const state = await this.getState(fileId);
    if (state) {
      state.bytesUploaded = bytesUploaded;
      state.lastUpdateTime = Date.now();
      if (!state.uploadedChunks.includes(chunkIndex)) {
        state.uploadedChunks.push(chunkIndex);
      }
      await this.saveState(fileId, state);
    }
  }

  async canResume(fileId: string): Promise<boolean> {
    const state = await this.getState(fileId);
    if (!state) return false;

    // Check if the upload is in a resumable state
    const resumableStates = ['initialized', 'uploading', 'paused', 'interrupted'];
    return resumableStates.includes(state.status);
  }

  async getResumableChunks(fileId: string): Promise<number[]> {
    const state = await this.getState(fileId);
    if (!state) return [];

    return Array.from(
      { length: state.totalChunks },
      (_, i) => i
    ).filter(i => !state.uploadedChunks.includes(i));
  }

  dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}
