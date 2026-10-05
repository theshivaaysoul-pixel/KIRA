/**
 * UploadZone — drag-and-drop or click-to-upload area
 */
import { useState, useRef } from 'react';

const CATEGORIES = ['uploads', 'images', 'videos', 'documents', 'audio'];

export function UploadZone({ onUpload, uploading, uploadProgress }) {
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState('uploads');
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => onUpload(file, category));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      {/* Category selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
          Upload to:
        </span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`tab ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
            id={`category-tab-${cat}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className={`dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        id="upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          id="file-input"
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <span className="dropzone-icon">{uploading ? '⏳' : '☁️'}</span>
        <p className="dropzone-title">
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p className="dropzone-subtitle">
          Images, videos, documents, audio · Max 500 MB
          {!uploading && ' · Files &lt;10 MB go through server; larger files upload directly to GCS'}
        </p>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="progress-container">
          <div className="progress-label">
            <span>Uploading…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
