/**
 * Storage API client — Google Drive backend
 *
 * All operations communicate with the Express backend,
 * which proxies to Google Drive using your personal OAuth2 credentials.
 *
 * The frontend never holds Drive tokens or credentials —
 * only Firebase ID tokens (for backend auth).
 */

import axios from 'axios';
import { auth } from '../config/firebase';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * Get a fresh Firebase ID token for the current user.
 */
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated. Please sign in.');
  return user.getIdToken();
}

/**
 * Create an Axios instance with the Authorization header pre-populated.
 */
async function createAuthAxios() {
  const token = await getIdToken();
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Upload a file to Google Drive via the backend.
 *
 * @param {File} file              Browser File object
 * @param {string} [category]     e.g. 'images', 'documents', 'videos'
 * @param {function} [onProgress] Progress callback (0–100)
 * @returns {Promise<object>}     Created file metadata
 */
export async function uploadFile(file, category = 'uploads', onProgress) {
  const token = await getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const res = await axios.post(`${BASE_URL}/api/storage/upload`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });

  return res.data.file;
}

/**
 * List files for the authenticated user.
 * @param {string} [category]  Optional filter
 * @returns {Promise<object[]>}
 */
export async function listFiles(category) {
  const api = await createAuthAxios();
  const params = category ? { category } : {};
  const { data } = await api.get('/api/storage/files', { params });
  return data.files;
}

/**
 * Download a file by streaming it from the backend
 * (which proxies it from Google Drive).
 * Triggers a browser download dialog.
 *
 * @param {string} fileId
 * @param {string} originalName  Used as the download filename
 */
export async function downloadFile(fileId, originalName) {
  const token = await getIdToken();

  const res = await axios.get(`${BASE_URL}/api/storage/download/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });

  // Create a temporary object URL and trigger browser download
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = originalName || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Delete a file.
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deleteFile(fileId) {
  const api = await createAuthAxios();
  await api.delete(`/api/storage/${fileId}`);
}
