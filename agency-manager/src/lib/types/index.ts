// src/lib/types/index.ts
// Central type definitions for KIRA Agency Manager

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export type StorageCheckStatus = 'idle' | 'checking' | 'ok' | 'error';

export interface StorageCheckResult {
  connection: StorageCheckStatus;
  bucketAccess: StorageCheckStatus;
  readTest: StorageCheckStatus;
  writeTest: StorageCheckStatus;
  deleteTest: StorageCheckStatus;
  error?: string;
}

export interface HealthStatus {
  app: 'ok' | 'error';
  auth: 'ok' | 'error' | 'unconfigured';
  storage: 'ok' | 'error' | 'unconfigured';
  timestamp: string;
}

export interface ApiErrorObject {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string | ApiErrorObject;
  message?: string;
}

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  implemented: boolean;
};

// Re-export all domain models
export * from './domain';
