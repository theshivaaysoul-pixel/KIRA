/**
 * File Metadata Service (Firestore)
 *
 * Stores and retrieves file metadata records.
 * The actual file binary is stored in GCS; only metadata lives here.
 *
 * Firestore collection: "fileMetadata"
 *
 * Document schema:
 * {
 *   fileId:            string  (Firestore document ID, UUID)
 *   userId:            string  (Firebase Auth UID)
 *   originalName:      string  (original filename from the client)
 *   storageObjectName: string  (GCS object path, e.g. "users/uid/images/uuid-photo.jpg")
 *   bucketName:        string
 *   mimeType:          string
 *   size:              number  (bytes)
 *   category:          string  (e.g. 'images', 'documents', 'videos', 'uploads')
 *   createdAt:         Timestamp
 *   updatedAt:         Timestamp
 * }
 */

const { v4: uuidv4 } = require('uuid');
const { getFirestore } = require('../config/firebase');

const COLLECTION = 'fileMetadata';

/**
 * Create a new file metadata record.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.originalName
 * @param {string} params.storageObjectName
 * @param {string} params.bucketName
 * @param {string} params.mimeType
 * @param {number} params.size
 * @param {string} params.category
 * @returns {Promise<object>}  The created metadata document
 */
async function createFileMetadata({
  userId,
  originalName,
  storageObjectName,
  bucketName,
  mimeType,
  size,
  category,
}) {
  const db = getFirestore();
  const fileId = uuidv4();
  const now = new Date();

  const doc = {
    fileId,
    userId,
    originalName,
    storageObjectName,
    bucketName,
    mimeType,
    size,
    category,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION).doc(fileId).set(doc);
  return doc;
}

/**
 * Get a single file metadata record by fileId.
 * Returns null if not found.
 *
 * @param {string} fileId
 * @returns {Promise<object|null>}
 */
async function getFileMetadata(fileId) {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).doc(fileId).get();
  if (!snap.exists) return null;
  return snap.data();
}

/**
 * List all file metadata records for a given userId (and optionally category).
 *
 * @param {string} userId
 * @param {string} [category]   Optional category filter
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
async function listFileMetadataByUser(userId, category, limit = 50) {
  const db = getFirestore();
  let query = db.collection(COLLECTION).where('userId', '==', userId).limit(limit);

  if (category) {
    query = query.where('category', '==', category);
  }

  const snap = await query.get();
  return snap.docs.map((d) => d.data());
}

/**
 * Delete a file metadata record.
 *
 * @param {string} fileId
 * @returns {Promise<void>}
 */
async function deleteFileMetadata(fileId) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(fileId).delete();
}

/**
 * Update a file metadata record (partial update).
 *
 * @param {string} fileId
 * @param {object} updates
 * @returns {Promise<void>}
 */
async function updateFileMetadata(fileId, updates) {
  const db = getFirestore();
  await db.collection(COLLECTION).doc(fileId).update({
    ...updates,
    updatedAt: new Date(),
  });
}

module.exports = {
  createFileMetadata,
  getFileMetadata,
  listFileMetadataByUser,
  deleteFileMetadata,
  updateFileMetadata,
};
