/**
 * FileCard — displays metadata for a single uploaded file
 * with download and delete actions.
 */
import { useState } from 'react';
import { FileIcon, formatBytes, formatDate } from './FileHelpers';

export function FileCard({ file, onDownload, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${file.originalName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(file.fileId);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="file-card" id={`file-card-${file.fileId}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="file-card-icon">
          <FileIcon mimeType={file.mimeType} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="file-card-name" title={file.originalName}>
            {file.originalName}
          </div>
          <div className="file-card-meta">
            <span>{formatBytes(file.size)}</span>
            <span>·</span>
            <span>{formatDate(file.createdAt)}</span>
          </div>
        </div>
      </div>

      {file.category && (
        <div>
          <span className="badge">{file.category}</span>
        </div>
      )}

      <div className="file-card-actions">
        <button
          className="btn btn-ghost"
          onClick={() => onDownload(file.fileId, file.originalName)}
          id={`download-btn-${file.fileId}`}
          style={{ flex: 1 }}
          title="Download"
        >
          ↓ Download
        </button>
        <button
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting}
          id={`delete-btn-${file.fileId}`}
          title="Delete"
        >
          {deleting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '🗑'}
        </button>
      </div>
    </div>
  );
}
