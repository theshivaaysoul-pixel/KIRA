// scripts/verify-phase8.mjs
// Automated verification suite for KIRA Agency Manager — Phase 8: GCS Media Manager.
// Tests against real Google Cloud Storage with zero mock data.

process.loadEnvFile('.env.local');

const { getRepositories } = await import('../src/lib/repositories/index.ts');
const { getStorageService } = await import('../src/lib/storage/index.ts');
const {
  MediaService,
  MediaValidationError,
  ContentNotFoundError,
  ContentArchivedError,
  AssetNotFoundError,
  AssetOwnershipError,
  MediaIntegrityError,
} = await import('../src/lib/services/media-service.ts');
const {
  createContent,
  transitionStatus,
  deleteOrArchiveContent,
} = await import('../src/lib/services/content-service.ts');
const {
  sanitizeFileName,
  validateMagicBytes,
  isExecutableOrScript,
  ALLOWED_MIME_TYPES,
  getFileLimits,
} = await import('../src/lib/media/constants.ts');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPhase8Verification() {
  console.log('===============================================================');
  console.log('   KIRA AGENCY MANAGER — PHASE 8 GCS MEDIA MANAGER VERIFICATION');
  console.log('===============================================================\n');

  const repos = getRepositories();
  const storage = getStorageService();

  // 0. GCS Health Check
  console.log('0. Checking Real GCS Connectivity...');
  const health = await storage.healthCheck();
  assert(health.connection && health.bucketAccess && health.writeTest && health.readTest && health.deleteTest, 'GCS storage health check passed completely');

  // Find or provision active test owner
  const teamMembers = await repos.teamMembers.findAll();
  let testOwner = teamMembers.find((m) => m.role === 'OWNER' && m.status === 'ACTIVE');
  let createdTestOwner = false;
  if (!testOwner) {
    testOwner = await repos.teamMembers.create({
      name: 'Phase 8 Test Owner',
      email: `test-owner-p8-${Date.now()}@kira.agency`,
      role: 'OWNER',
      status: 'ACTIVE',
    });
    createdTestOwner = true;
  }

  const createdContentIds = [];
  const createdGcsPaths = [];

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Validation, Sanitization & Security Rules
    // ─────────────────────────────────────────────────────────────
    console.log('\n1. Testing File Validation, Magic Bytes & Filename Sanitization...');

    // Filename sanitization
    const pathTraversalTest = sanitizeFileName('../../../secrets/credentials.json');
    assert(
      !pathTraversalTest.safeFileName.includes('/') &&
      !pathTraversalTest.safeFileName.includes('\\') &&
      !pathTraversalTest.safeFileName.includes('..'),
      'Sanitize filename: strip path traversal slashes and parent directory references'
    );

    const nullByteTest = sanitizeFileName('malicious\0file.jpg.exe');
    assert(!nullByteTest.safeFileName.includes('\0'), 'Sanitize filename: strip null bytes');

    // Executable / script detection
    const dosExeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ
    assert(isExecutableOrScript(dosExeBuffer), 'Detect and reject DOS/Windows executable header');

    const elfBinaryBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF
    assert(isExecutableOrScript(elfBinaryBuffer), 'Detect and reject Linux ELF binary header');

    const shellScriptBuffer = Buffer.from('#!/bin/bash\necho bad');
    assert(isExecutableOrScript(shellScriptBuffer), 'Detect and reject shell script');

    const htmlScriptBuffer = Buffer.from('<script>alert("xss")</script>');
    assert(isExecutableOrScript(htmlScriptBuffer), 'Detect and reject active HTML/script payload');

    const svgXssBuffer = Buffer.from('<?xml version="1.0"?><svg onload="alert(1)"></svg>');
    assert(isExecutableOrScript(svgXssBuffer), 'Detect and reject active SVG XML payload');

    // Magic bytes verification
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    assert(validateMagicBytes(validJpeg, 'image/jpeg'), 'Accept valid JPEG magic bytes (FF D8 FF)');

    const fakeJpeg = Buffer.from('THIS IS NOT A REAL JPEG AT ALL');
    assert(!validateMagicBytes(fakeJpeg, 'image/jpeg'), 'Reject spoofed file claiming to be JPEG');

    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    assert(validateMagicBytes(validPng, 'image/png'), 'Accept valid PNG magic bytes');

    const validPdf = Buffer.from('%PDF-1.5 test document stream');
    assert(validateMagicBytes(validPdf, 'application/pdf'), 'Accept valid PDF magic bytes (%PDF)');

    // ─────────────────────────────────────────────────────────────
    // 2. Real Content Creation for Testing Media
    // ─────────────────────────────────────────────────────────────
    console.log('\n2. Setting up Test Content for Media Operations...');

    const testContent = await createContent(
      {
        title: 'Phase 8 Media Test Post',
        description: 'Testing real GCS upload and media management',
        contentType: 'IMAGE',
      },
      testOwner
    );
    createdContentIds.push(testContent.id);
    assert(testContent.id && testContent.id.startsWith('CNT-'), `Created test content: ${testContent.id}`);

    // Create a 2nd content item for IDOR cross-boundary tests
    const secondContent = await createContent(
      {
        title: 'Second Content Item for IDOR Defense',
        contentType: 'POST',
      },
      testOwner
    );
    createdContentIds.push(secondContent.id);

    // ─────────────────────────────────────────────────────────────
    // 3. Real GCS Media Upload & Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n3. Testing Real GCS Image Upload & Verification...');

    // Valid small 1x1 JPEG buffer
    const testJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c,
      0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30,
      0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34,
      0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
      0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x80, 0xff, 0xd9,
    ]);

    const uploadedImage = await MediaService.uploadContentAsset({
      contentId: testContent.id,
      file: {
        buffer: testJpegBuffer,
        fileName: 'sample_product.jpg',
        mimeType: 'image/jpeg',
      },
      actor: testOwner,
    });

    createdGcsPaths.push(uploadedImage.storagePath);

    assert(uploadedImage.id && uploadedImage.id.startsWith('AST-'), `Generated server-side Asset ID: ${uploadedImage.id}`);
    assert(uploadedImage.contentId === testContent.id, 'Asset associated with correct contentId');
    assert(uploadedImage.type === 'IMAGE', 'Asset type accurately resolved to "IMAGE" from MIME');
    assert(uploadedImage.mimeType === 'image/jpeg', 'MIME type recorded accurately');
    assert(uploadedImage.size === testJpegBuffer.length, 'Size matches exact byte count');
    assert(uploadedImage.storagePath.startsWith(`media/content/${testContent.id}/original/`), `GCS path follows standard: ${uploadedImage.storagePath}`);

    // Verify object actually exists in Google Cloud Storage
    const gcsObjectExists = await storage.exists(uploadedImage.storagePath);
    assert(gcsObjectExists, 'Uploaded object confirmed present in Google Cloud Storage');

    // ─────────────────────────────────────────────────────────────
    // 4. Testing Multi-Format Support (PDF, MP3, MP4)
    // ─────────────────────────────────────────────────────────────
    console.log('\n4. Testing Multi-Format Uploads (Document, Audio, Video)...');

    // PDF Document upload
    const testPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const uploadedPdf = await MediaService.uploadContentAsset({
      contentId: testContent.id,
      file: {
        buffer: testPdfBuffer,
        fileName: 'brand_guidelines.pdf',
        mimeType: 'application/pdf',
      },
      actor: testOwner,
    });
    createdGcsPaths.push(uploadedPdf.storagePath);
    assert(uploadedPdf.type === 'DOCUMENT', 'PDF recognized and categorized as DOCUMENT');

    // MP3 Audio upload
    const testAudioBuffer = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, 0x54, 0x49, 0x54, 0x32]);
    const uploadedAudio = await MediaService.uploadContentAsset({
      contentId: testContent.id,
      file: {
        buffer: testAudioBuffer,
        fileName: 'voiceover_take1.mp3',
        mimeType: 'audio/mpeg',
      },
      actor: testOwner,
    });
    createdGcsPaths.push(uploadedAudio.storagePath);
    assert(uploadedAudio.type === 'AUDIO', 'MP3 recognized and categorized as AUDIO');

    // MP4 Video upload (ftyp box)
    const testVideoBuffer = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const uploadedVideo = await MediaService.uploadContentAsset({
      contentId: testContent.id,
      file: {
        buffer: testVideoBuffer,
        fileName: 'teaser_clip.mp4',
        mimeType: 'video/mp4',
      },
      actor: testOwner,
    });
    createdGcsPaths.push(uploadedVideo.storagePath);
    assert(uploadedVideo.type === 'VIDEO', 'MP4 recognized and categorized as VIDEO');

    // ─────────────────────────────────────────────────────────────
    // 5. Rejection & Upload Security Protections
    // ─────────────────────────────────────────────────────────────
    console.log('\n5. Testing Rejection of Invalid & Dangerous Uploads...');

    // Unsupported MIME rejection
    let unsupportedFailed = false;
    try {
      await MediaService.uploadContentAsset({
        contentId: testContent.id,
        file: {
          buffer: Buffer.from('console.log("hello");'),
          fileName: 'script.js',
          mimeType: 'application/javascript',
        },
        actor: testOwner,
      });
    } catch (err) {
      if (err instanceof MediaValidationError) unsupportedFailed = true;
    }
    assert(unsupportedFailed, 'Reject unsupported MIME type (application/javascript)');

    // Spoofed MIME rejection (content doesn't match MIME)
    let spoofedFailed = false;
    try {
      await MediaService.uploadContentAsset({
        contentId: testContent.id,
        file: {
          buffer: Buffer.from('FAKE PNG DATA WITH NO PNG HEADER'),
          fileName: 'fake.png',
          mimeType: 'image/png',
        },
        actor: testOwner,
      });
    } catch (err) {
      if (err instanceof MediaValidationError) spoofedFailed = true;
    }
    assert(spoofedFailed, 'Reject spoofed file failing magic bytes verification');

    // Oversized file rejection
    let oversizedFailed = false;
    try {
      // 11MB image buffer (> 10MB limit)
      const oversizedImage = Buffer.alloc(11 * 1024 * 1024);
      oversizedImage[0] = 0xff;
      oversizedImage[1] = 0xd8;
      oversizedImage[2] = 0xff;
      await MediaService.uploadContentAsset({
        contentId: testContent.id,
        file: {
          buffer: oversizedImage,
          fileName: 'huge.jpg',
          mimeType: 'image/jpeg',
        },
        actor: testOwner,
      });
    } catch (err) {
      if (err instanceof MediaValidationError) oversizedFailed = true;
    }
    assert(oversizedFailed, 'Reject oversized file exceeding configured limit');

    // Empty file rejection
    let emptyFailed = false;
    try {
      await MediaService.uploadContentAsset({
        contentId: testContent.id,
        file: {
          buffer: Buffer.alloc(0),
          fileName: 'empty.jpg',
          mimeType: 'image/jpeg',
        },
        actor: testOwner,
      });
    } catch (err) {
      if (err instanceof MediaValidationError) emptyFailed = true;
    }
    assert(emptyFailed, 'Reject empty 0-byte file');

    // ─────────────────────────────────────────────────────────────
    // 6. Retrieval, Listing & Secure Media Access
    // ─────────────────────────────────────────────────────────────
    console.log('\n6. Testing Asset Listing, Retrieval & Secure Access...');

    const allAssets = await MediaService.getContentAssets(testContent.id, testOwner);
    assert(allAssets.length >= 4, `Listed ${allAssets.length} assets for content`);

    const singleAsset = await MediaService.getContentAssetById(testContent.id, uploadedImage.id, testOwner);
    assert(singleAsset.id === uploadedImage.id, 'getContentAssetById retrieves correct record');

    // Secure media access: signed URL generation
    const access = await MediaService.getSecureMediaAccess(testContent.id, uploadedImage.id, testOwner, 900);
    assert(access.signedUrl && access.signedUrl.startsWith('http'), 'Generated secure short-lived signed URL');
    assert(access.asset.id === uploadedImage.id, 'Secure access returns matching asset metadata');

    // Direct buffer streaming verification
    const downloaded = await MediaService.downloadAssetBuffer(testContent.id, uploadedImage.id, testOwner);
    assert(
      downloaded.buffer.length === testJpegBuffer.length &&
      downloaded.buffer.equals(testJpegBuffer),
      'Direct downloaded buffer matches uploaded bytes byte-for-byte'
    );

    // ─────────────────────────────────────────────────────────────
    // 7. IDOR Defense & Archival Protections
    // ─────────────────────────────────────────────────────────────
    console.log('\n7. Testing IDOR Cross-Content Boundary Defense...');

    // Attempting to access testContent's asset using secondContent's ID must fail
    let idorAccessBlocked = false;
    try {
      await MediaService.getContentAssetById(secondContent.id, uploadedImage.id, testOwner);
    } catch (err) {
      if (err instanceof AssetOwnershipError && err.status === 403) {
        idorAccessBlocked = true;
      }
    }
    assert(idorAccessBlocked, 'IDOR blocked: Accessing asset with mismatched contentId returns 403');

    // Attempting to delete testContent's asset using secondContent's ID must fail
    let idorDeleteBlocked = false;
    try {
      await MediaService.deleteContentAsset(secondContent.id, uploadedImage.id, testOwner);
    } catch (err) {
      if (err instanceof AssetOwnershipError && err.status === 403) {
        idorDeleteBlocked = true;
      }
    }
    assert(idorDeleteBlocked, 'IDOR blocked: Deleting asset with mismatched contentId returns 403');

    // Archival protection: archive secondContent and attempt upload
    await transitionStatus(secondContent.id, 'SCRIPT', testOwner);
    await transitionStatus(secondContent.id, 'ARCHIVED', testOwner);

    let archivedUploadBlocked = false;
    try {
      await MediaService.uploadContentAsset({
        contentId: secondContent.id,
        file: {
          buffer: testJpegBuffer,
          fileName: 'cannot_upload.jpg',
          mimeType: 'image/jpeg',
        },
        actor: testOwner,
      });
    } catch (err) {
      if (err instanceof ContentArchivedError && err.status === 422) {
        archivedUploadBlocked = true;
      }
    }
    assert(archivedUploadBlocked, 'Reject media upload to archived content (422)');

    // ─────────────────────────────────────────────────────────────
    // 8. Safe Deletion & GCS Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n8. Testing Safe Asset Deletion & Storage Cleanup...');

    const deleteTarget = uploadedAudio;
    const deleteResult = await MediaService.deleteContentAsset(testContent.id, deleteTarget.id, testOwner);
    assert(deleteResult.deleted && deleteResult.assetId === deleteTarget.id, 'deleteContentAsset reports successful deletion');

    // Verify deleted from GCS
    const audioStillInGcs = await storage.exists(deleteTarget.storagePath);
    assert(!audioStillInGcs, 'Object verified deleted from Google Cloud Storage');

    // Verify deleted from ContentAsset repository
    const audioInRepo = await repos.contentAssets.findById(deleteTarget.id);
    assert(audioInRepo === null, 'Asset record verified removed from ContentAsset repository');

    // ─────────────────────────────────────────────────────────────
    // 9. Security Activity Logging Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n9. Testing Security Activity Audit Logging...');

    const activities = await repos.activityLogs.findAll();
    const mediaActivities = activities.filter(
      (a) => a.entityType === 'ContentAsset' && (a.entityId === uploadedImage.id || a.entityId === deleteTarget.id)
    );

    assert(mediaActivities.length >= 2, `Recorded ${mediaActivities.length} audit activity logs for assets`);
    const actionTypes = new Set(mediaActivities.map((a) => a.action));
    assert(actionTypes.has('CREATE'), 'Activity log includes CREATE event for asset upload');
    assert(actionTypes.has('DELETE'), 'Activity log includes DELETE event for asset deletion');

    const sampleLog = mediaActivities.find((a) => a.action === 'CREATE');
    assert(
      sampleLog && sampleLog.metadata?.fileName && sampleLog.metadata?.size && !sampleLog.metadata?.fileContents,
      'Activity log contains safe metadata without leaking file contents or sensitive tokens'
    );

  } finally {
    // ─────────────────────────────────────────────────────────────
    // 10. Clean Up All Test Artifacts
    // ─────────────────────────────────────────────────────────────
    console.log('\n10. Cleaning Up Test Assets & Entities...');

    // Delete any remaining uploaded test objects from GCS
    for (const gcsPath of createdGcsPaths) {
      try {
        const exists = await storage.exists(gcsPath);
        if (exists) {
          await storage.delete(gcsPath);
        }
      } catch (err) {
        console.warn('Cleanup warning for GCS path:', gcsPath, err);
      }
    }

    // Delete test content records (and their assets)
    for (const cid of createdContentIds) {
      try {
        const assets = await repos.contentAssets.findByContentId(cid);
        for (const a of assets) {
          try { await repos.contentAssets.delete(a.id); } catch {}
        }
        await repos.content.delete(cid);
      } catch (err) {
        console.warn('Cleanup warning for Content:', cid, err);
      }
    }

    // Delete test owner if created by this script
    if (createdTestOwner) {
      try { await repos.teamMembers.delete(testOwner.id); } catch {}
    }
  }

  console.log('\n===============================================================');
  console.log(`   PHASE 8 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8Verification().catch((err) => {
  console.error('Unhandled verification error in Phase 8:', err);
  process.exit(1);
});
