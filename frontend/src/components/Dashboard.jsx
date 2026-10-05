/**
 * Dashboard — main authenticated view
 * Shows upload zone, category filters, and file grid.
 */
import { useEffect, useState } from 'react';
import { Navbar } from './Navbar';
import { UploadZone } from './UploadZone';
import { FileCard } from './FileCard';
import { useStorage } from '../hooks/useStorage';

const ALL_CATEGORIES = ['all', 'uploads', 'images', 'videos', 'documents', 'audio'];

export function Dashboard() {
  const { files, loading, uploading, uploadProgress, error, loadFiles, upload, download, remove } =
    useStorage();
  const [activeCategory, setActiveCategory] = useState('all');
  const [successMsg, setSuccessMsg] = useState(null);

  // Load files on mount and when category changes
  useEffect(() => {
    loadFiles(activeCategory === 'all' ? undefined : activeCategory);
  }, [activeCategory, loadFiles]);

  const handleUpload = async (file, category) => {
    try {
      await upload(file, category);
      setSuccessMsg(`"${file.name}" uploaded successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      // Refresh the list if we're on the right category
      if (activeCategory === 'all' || activeCategory === category) {
        loadFiles(activeCategory === 'all' ? undefined : activeCategory);
      }
    } catch {
      // error is already set in the hook
    }
  };

  const handleDelete = async (fileId) => {
    await remove(fileId);
  };

  return (
    <>
      <Navbar />
      <main className="dashboard">
        <div className="container">
          {/* Header */}
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Your Files</h1>
              <p className="dashboard-subtitle">
                {files.length} file{files.length !== 1 ? 's' : ''} · stored securely in your 5 TB Cloud Storage
              </p>
            </div>
          </div>

          {/* Alerts */}
          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {successMsg && <div className="alert alert-success">✓ {successMsg}</div>}

          {/* Upload zone */}
          <UploadZone
            onUpload={handleUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
          />

          {/* Category filter tabs */}
          <div className="category-tabs">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
                id={`filter-tab-${cat}`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* File grid */}
          {loading ? (
            <div className="empty-state">
              <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🌤️</span>
              <div className="empty-state-title">No files yet</div>
              <p>Upload your first file using the area above.</p>
            </div>
          ) : (
            <div className="file-grid">
              {files.map((file) => (
                <FileCard
                  key={file.fileId}
                  file={file}
                  onDownload={download}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
