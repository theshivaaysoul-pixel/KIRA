/**
 * FileIcon component
 * Returns an emoji/icon based on MIME type for visual categorization.
 */
export function FileIcon({ mimeType }) {
  if (!mimeType) return <span>📄</span>;
  if (mimeType.startsWith('image/')) return <span>🖼️</span>;
  if (mimeType.startsWith('video/')) return <span>🎬</span>;
  if (mimeType.startsWith('audio/')) return <span>🎵</span>;
  if (mimeType === 'application/pdf') return <span>📕</span>;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <span>📊</span>;
  if (mimeType.includes('word') || mimeType.includes('document')) return <span>📝</span>;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return <span>📊</span>;
  if (mimeType === 'application/zip' || mimeType === 'application/x-tar') return <span>🗜️</span>;
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return <span>📃</span>;
  return <span>📄</span>;
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format a date/timestamp into a short readable string.
 */
export function formatDate(date) {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
