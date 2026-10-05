// src/lib/storage/index.ts
// Storage service singleton — the only import point for storage throughout the app.
// Swap the implementation here without changing any callers.

import { DriveStorageService } from './drive-storage-service';
import { GCSStorageService } from './gcs-storage-service';
import type { IStorageService } from './storage-service';
import { DataSafetyService } from './data-safety-service';

let _storageService: IStorageService | null = null;
let _dataSafetyService: DataSafetyService | null = null;

export function getStorageService(): IStorageService {
  if (!_storageService) {
    const provider = process.env.STORAGE_PROVIDER || (process.env.GOOGLE_DRIVE_REFRESH_TOKEN ? 'drive' : 'gcs');
    if (provider === 'gcs') {
      _storageService = new GCSStorageService();
    } else {
      _storageService = new DriveStorageService();
    }
  }
  return _storageService;
}

export function getDataSafetyService(): DataSafetyService {
  if (!_dataSafetyService) {
    _dataSafetyService = new DataSafetyService(getStorageService());
  }
  return _dataSafetyService;
}

export { DataSafetyService };
export * from './storage-service';
export * from './errors';
export * from './backup-types';

