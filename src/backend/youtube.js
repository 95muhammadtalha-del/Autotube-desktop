import { google } from 'googleapis';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

// Use loopback redirect — Google auto-allows this for Desktop-type OAuth clients
const REDIRECT_URI = 'http://127.0.0.1/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

/**
 * Creates OAuth2 client and generates auth URL.
 * Uses 127.0.0.1 loopback redirect (auto-allowed for Desktop OAuth clients).
 */
export function initYouTubeAuth(clientId, clientSecret) {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  return { authUrl, oauth2Client };
}

/**
 * Opens Google OAuth in an Electron BrowserWindow and intercepts the redirect
 * to capture the authorization code. No HTTP server needed. No manual redirect URI
 * registration needed (Google auto-allows 127.0.0.1 for Desktop OAuth clients).
 *
 * @param {string} authUrl - The Google OAuth consent URL
 * @param {object} oauth2Client - The googleapis OAuth2 client
 * @returns {Promise<object>} - Resolved with tokens
 */
export function startElectronOAuth(authUrl, oauth2Client) {
  return new Promise((resolve, reject) => {
    // Dynamic import to avoid issues when loaded outside Electron
    import('electron').then(({ BrowserWindow }) => {
      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: true,
        autoHideMenuBar: true,
        title: 'Sign in with Google — AutoTube',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });

      authWindow.loadURL(authUrl);

      // Intercept ALL navigations to catch the redirect with the auth code
      authWindow.webContents.on('will-redirect', async (event, redirectUrl) => {
        try {
          const url = new URL(redirectUrl);
          // Check if Google is redirecting to our loopback URI with a code
          if (url.hostname === '127.0.0.1' && url.pathname === '/callback') {
            event.preventDefault(); // Stop the actual navigation (there's no server)

            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (code) {
              const { tokens } = await oauth2Client.getToken(code);
              oauth2Client.setCredentials(tokens);
              authWindow.close();
              resolve(tokens);
            } else {
              authWindow.close();
              reject(new Error(error || 'No authorization code received'));
            }
          }
        } catch (err) {
          authWindow.close();
          reject(err);
        }
      });

      // Also handle will-navigate for some Google flows
      authWindow.webContents.on('will-navigate', async (event, navUrl) => {
        try {
          const url = new URL(navUrl);
          if (url.hostname === '127.0.0.1' && url.pathname === '/callback') {
            event.preventDefault();
            const code = url.searchParams.get('code');
            if (code) {
              const { tokens } = await oauth2Client.getToken(code);
              oauth2Client.setCredentials(tokens);
              authWindow.close();
              resolve(tokens);
            }
          }
        } catch (err) { /* ignore parse errors for non-redirect URLs */ }
      });

      authWindow.on('closed', () => {
        reject(new Error('Auth window was closed before completing sign-in'));
      });
    }).catch(reject);
  });
}

/**
 * Checks connection status, refreshes token if needed, gets channel info.
 */
export async function checkYouTubeConnection(clientId, clientSecret, tokens) {
  try {
    if (!tokens) return { connected: false, error: 'No tokens provided' };

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const response = await youtube.channels.list({
      part: 'snippet',
      mine: true
    });

    const items = response.data.items;
    if (items && items.length > 0) {
      const channel = items[0];
      return {
        connected: true,
        channelName: channel.snippet.title,
        channelId: channel.id,
        thumbnail: channel.snippet.thumbnails?.default?.url
      };
    } else {
      return { connected: false, error: 'No channel found' };
    }
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Uploads a video to YouTube.
 */
export async function uploadToYouTube(clientId, clientSecret, tokens, videoPath, metadata) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const fileSize = fs.statSync(videoPath).size;

    const { title, description, tags, privacy, categoryId } = metadata;

    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title,
          description,
          tags: tags || [],
          categoryId: categoryId || '22'
        },
        status: {
          privacyStatus: privacy || 'private',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(videoPath)
      }
    });

    const videoId = response.data.id;
    return {
      success: true,
      videoId,
      videoUrl: `https://youtu.be/${videoId}`
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Database history moved to db.js
