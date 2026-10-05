// agency-manager/scripts/getRefreshToken.js
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:4000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/drive',
  ],
});

console.log('\n======================================================');
console.log('  KIRA — GOOGLE DRIVE 5TB OAUTH AUTHORIZATION');
console.log('======================================================');
console.log('\n👉 CLICK THIS LINK TO AUTHORIZE YOUR 5TB ACCOUNT (Account A):\n');
console.log(authUrl);
console.log('\n======================================================');
console.log('Listening on http://localhost:4000/oauth2callback ...');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === '/oauth2callback') {
    const code = parsed.query.code;
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Error: No authorization code received.</h2>');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>No refresh token returned. Try revoking app access and re-authorizing with prompt=consent.</h2>');
        return;
      }

      console.log('\n✅ Refresh token obtained successfully!');

      // Update agency-manager/.env.local
      const envLocalPath = path.resolve(__dirname, '..', '.env.local');
      if (fs.existsSync(envLocalPath)) {
        let content = fs.readFileSync(envLocalPath, 'utf8');
        content = content.replace(/GOOGLE_DRIVE_REFRESH_TOKEN=.*/, `GOOGLE_DRIVE_REFRESH_TOKEN=${refreshToken}`);
        fs.writeFileSync(envLocalPath, content, 'utf8');
        console.log('✅ Updated agency-manager/.env.local');
      }

      // Update backend/.env
      const backendEnvPath = path.resolve(__dirname, '..', '..', 'backend', '.env');
      if (fs.existsSync(backendEnvPath)) {
        let content = fs.readFileSync(backendEnvPath, 'utf8');
        content = content.replace(/GOOGLE_DRIVE_REFRESH_TOKEN=.*/, `GOOGLE_DRIVE_REFRESH_TOKEN=${refreshToken}`);
        fs.writeFileSync(backendEnvPath, content, 'utf8');
        console.log('✅ Updated backend/.env');
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 80px auto; padding: 40px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center;">
          <h1 style="color: #10b981; margin-bottom: 8px;">✅ Authorization Successful!</h1>
          <p style="font-size: 18px; color: #374151; margin-bottom: 24px;">Your 5TB Google Drive is now connected to <strong>KIRA Agency Manager</strong>.</p>
          <p style="font-size: 14px; color: #6b7280;">You can safely close this browser window and return to Antigravity.</p>
        </div>
      `);

      server.close();

      console.log('\n🎉 ALL DONE! Running verification test now...\n');
    } catch (err) {
      console.error('Failed to exchange code:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h2>Failed to exchange code: ${err.message}</h2>`);
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(4000);
