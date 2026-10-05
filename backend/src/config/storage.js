/**
 * Google Drive API client initialization.
 *
 * Uses OAuth2 credentials tied to YOUR Google account
 * (the one with the 5TB Google One subscription).
 *
 * Auth flow: OAuth2 with refresh token stored in env vars.
 * The refresh token is obtained once via the setup script (scripts/getDriveToken.js)
 * and stored in GOOGLE_DRIVE_REFRESH_TOKEN.
 *
 * Credentials loaded exclusively from environment variables.
 * NEVER hard-code credentials here.
 */

const { google } = require('googleapis');

let driveClient;
let oauth2Client;

function getOAuth2Client() {
  if (oauth2Client) return oauth2Client;

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Google Drive credentials. ' +
      'Ensure GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, ' +
      'and GOOGLE_DRIVE_REFRESH_TOKEN are set in your .env file.\n' +
      'Run: node scripts/getDriveToken.js to obtain the refresh token.'
    );
  }

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:4000/oauth2callback');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return oauth2Client;
}

function getDriveClient() {
  if (driveClient) return driveClient;
  driveClient = google.drive({ version: 'v3', auth: getOAuth2Client() });
  console.log('[Drive] Google Drive API client initialized.');
  return driveClient;
}

module.exports = { getDriveClient, getOAuth2Client };
