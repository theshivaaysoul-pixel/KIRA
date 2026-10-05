/**
 * Google Drive OAuth2 Token Setup Script
 *
 * Run this ONCE to obtain the refresh token for your Google account
 * (the one with your 5TB Google One subscription).
 *
 * Prerequisites:
 *   1. Create an OAuth2 client in Google Cloud Console (see instructions below)
 *   2. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env
 *   3. Run: node scripts/getDriveToken.js
 *   4. Open the URL it prints, authorize the app
 *   5. Paste the code it gives you
 *   6. Copy the refresh token to GOOGLE_DRIVE_REFRESH_TOKEN in .env
 *
 * HOW TO CREATE AN OAUTH2 CLIENT IN GOOGLE CLOUD CONSOLE:
 *   1. Go to https://console.cloud.google.com
 *   2. APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID
 *   3. Application type: "Web application"
 *   4. Name: "KIRA Backend"
 *   5. Authorized redirect URIs: add "http://localhost:4000/oauth2callback"
 *   6. Click CREATE → copy Client ID and Client Secret to .env
 *   7. Also go to OAuth consent screen → add your Google account as a test user
 *
 * SCOPES REQUESTED:
 *   - https://www.googleapis.com/auth/drive.file
 *     (access only files created by this app — NOT your entire Drive)
 *
 *   If you want the app to also read existing Drive files, use:
 *   - https://www.googleapis.com/auth/drive
 *     (full Drive access — use with caution)
 */

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:4000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Error: GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET must be set in backend/.env\n');
  console.error('Follow the instructions at the top of this script to create an OAuth2 client.\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Request only drive.file scope — app can only see files IT created
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // forces refresh_token to be returned
});

console.log('\n' + '═'.repeat(60));
console.log('  KIRA — Google Drive OAuth2 Setup');
console.log('═'.repeat(60));
console.log('\n📋 Step 1: Open this URL in your browser (the Google account');
console.log('   with your 5TB Google One subscription):\n');
console.log('  ' + authUrl);
console.log('\n📋 Step 2: Sign in and click "Allow"');
console.log('\n📋 Step 3: You\'ll be redirected to localhost:4000/oauth2callback?code=...');
console.log('   Copy the "code" value from the URL and paste it below.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('🔑 Paste the authorization code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Success! Add this to your backend/.env file:\n');
    console.log('─'.repeat(60));
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('─'.repeat(60));
    console.log('\n⚠️  Keep this token secret. Never commit it to Git.');
    console.log('   It gives access to files your KIRA app creates in Drive.\n');
  } catch (err) {
    console.error('\n❌ Failed to exchange code for tokens:', err.message);
    console.error('Make sure you copied the full code from the URL.\n');
    process.exit(1);
  }
});
