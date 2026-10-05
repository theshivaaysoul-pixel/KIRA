import { createRequire } from 'module';
const require = createRequire(import.meta.url);
process.loadEnvFile('.env.local');

const { google } = require('googleapis');
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:4000/oauth2callback');
oauth2.setCredentials({ refresh_token: refreshToken });
const drive = google.drive({ version: 'v3', auth: oauth2 });

async function getFile(name, parentId) {
  const fileRes = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  const fileId = fileRes.data.files?.[0]?.id;
  if (!fileId) return null;
  const content = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
  return typeof content.data === 'string' ? JSON.parse(content.data) : content.data;
}

async function run() {
  const dbFolderRes = await drive.files.list({
    q: `name='database' and mimeType='application/vnd.google-apps.folder' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  const dbFolderId = dbFolderRes.data.files?.[0]?.id;
  if (!dbFolderId) {
    console.log('No database folder');
    return;
  }

  const contents = await getFile('content.json', dbFolderId);
  console.log('=== CONTENTS ===');
  console.log(JSON.stringify(contents, null, 2));

  const cpt = await getFile('content-platform-targets.json', dbFolderId);
  console.log('=== CONTENT PLATFORM TARGETS ===');
  console.log(JSON.stringify(cpt, null, 2));

  const platforms = await getFile('platforms.json', dbFolderId);
  console.log('=== PLATFORMS ===');
  console.log(JSON.stringify(platforms?.map(p => ({ id: p.id, name: p.name, slug: p.slug })), null, 2));
}

run().catch(console.error);
