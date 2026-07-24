// One-time helper to mint a Google OAuth refresh token for the Drive integration.
//
// The org policy blocks service-account keys, so instead of a key file the app authenticates
// as a real Workspace user via a long-lived refresh token (see PORTAL.md → Google Drive).
// Run this once, locally, log in as the account that owns the "Klepka Clients" Shared Drive,
// and copy the printed refresh token into Vercel as GOOGLE_OAUTH_REFRESH_TOKEN.
//
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/google-refresh-token.mjs
//
// The OAuth client must list http://localhost:5100/oauth2callback as an authorized redirect URI.

import http from 'node:http';
import { google } from 'googleapis';

const PORT = 5100;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive';

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // force a refresh_token even if this account consented before
  scope: [SCOPE],
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404).end();
    return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Missing authorization code.');
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Done — you can close this tab and return to the terminal.');
    if (tokens.refresh_token) {
      console.log('\n✅ Refresh token (store as GOOGLE_OAUTH_REFRESH_TOKEN):\n');
      console.log(tokens.refresh_token, '\n');
    } else {
      console.log('\n⚠️  No refresh token returned. Revoke the app at');
      console.log('   https://myaccount.google.com/permissions and run this again.\n');
    }
  } catch (error) {
    res.writeHead(500).end('Token exchange failed — see the terminal.');
    console.error(error);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('\nOpen this URL in the browser, signed in as the Shared Drive owner:\n');
  console.log(authUrl, '\n');
});
