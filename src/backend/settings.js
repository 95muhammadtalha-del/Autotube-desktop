import Store from 'electron-store';

const store = new Store({ name: 'autotube-settings' });

export function setupSettings(ipcMain) {
  // Load all settings on startup
  ipcMain.handle('settings:load', () => {
    return {
      geminiKey: store.get('geminiKey', ''),
      youtubeClientId: store.get('youtubeClientId', ''),
      youtubeClientSecret: store.get('youtubeClientSecret', ''),
      ytdlpCookies: store.get('ytdlpCookies', ''),
      exportFolder: store.get('exportFolder', ''),
      uploadPrivacy: store.get('uploadPrivacy', 'public'),
      uploadProxy: store.get('uploadProxy', ''),
    };
  });

  // Save all settings at once
  ipcMain.handle('settings:save', (event, settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      store.set(key, value);
    });
    return { success: true };
  });
}
