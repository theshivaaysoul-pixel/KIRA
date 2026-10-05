/**
 * useStorage hook — manages file storage state and operations.
 * Wraps the storage API client with React state management.
 */

import { useState, useCallback } from 'react';
import {
  uploadFile as apiUploadFile,
  listFiles as apiListFiles,
  downloadFile as apiDownloadFile,
  deleteFile as apiDeleteFile,
} from '../api/storage';

export function useStorage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadFiles = useCallback(async (category) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiListFiles(category);
      setFiles(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(async (file, category = 'uploads') => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const newFile = await apiUploadFile(file, category, (p) => setUploadProgress(p));
      setFiles((prev) => [newFile, ...prev]);
      return newFile;
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      setError(message);
      throw new Error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const download = useCallback(async (fileId, originalName) => {
    setError(null);
    try {
      await apiDownloadFile(fileId, originalName);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, []);

  const remove = useCallback(async (fileId) => {
    setError(null);
    try {
      await apiDeleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
      throw err;
    }
  }, []);

  return {
    files,
    loading,
    uploading,
    uploadProgress,
    error,
    loadFiles,
    upload,
    download,
    remove,
  };
}
