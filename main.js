import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { runFullPipeline, analyzeVideo, generateYouTubeMetadata, extractViralHighlights } from './src/backend/pipeline.js';

import {
  initYouTubeAuth, startElectronOAuth, checkYouTubeConnection,
  uploadToYouTube
} from './src/backend/youtube.js';
import { initDatabase, getUploadHistory, addToUploadHistory, isAlreadyUploaded } from './src/backend/db.js';
import { checkTikTokConnection, listTikTokVideos, downloadTikTokVideo, getTikTokVideoInfo } from './src/backend/tiktok.js';
import { UploadScheduler } from './src/backend/scheduler.js';
import { processVideoWithClipper } from './src/backend/clipperClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ipcMain.handle('log-error', (event, errorText) => {
  console.error('\n[FRONTEND CRASH]', errorText, '\n');
});

ipcMain.handle('app:exit', () => {
  app.quit();
});

const isDev = !app.isPackaged;

app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// ── Simple JSON config store ───────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'autotube-settings.json');
const HISTORY_PATH = path.join(app.getPath('userData'), 'upload-history.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) { console.error('[config] load error:', e.message); }
  return {};
}

function saveConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...loadConfig(), ...data }, null, 2));
  } catch (e) { console.error('[config] save error:', e.message); }
}

// ── IPC: Settings ─────────────────────────────────────────────────────────
ipcMain.handle('settings:load', () => {
  const cfg = loadConfig();
  
  // Migrate legacy single-key settings to the new array format (old legacy)
  if (!cfg.youtubeAccounts && cfg.youtubeClientId) {
    cfg.youtubeAccounts = [{
      clientId: cfg.youtubeClientId,
      clientSecret: cfg.youtubeClientSecret,
      tokens: cfg.youtubeTokens || null
    }];
    saveConfig({ 
      youtubeAccounts: cfg.youtubeAccounts, 
      youtubeClientId: null, 
      youtubeClientSecret: null, 
      youtubeTokens: null 
    });
  }

  // Migrate to Multi-Campaign Format
  if (!cfg.campaigns) {
    cfg.campaigns = [
      {
        id: 'default',
        name: 'Default Campaign',
        youtubeAccounts: cfg.youtubeAccounts || [],
        tiktokUsername: cfg.tiktokUsername || '',
        youtubeLink: cfg.youtubeLink || '',
        videosPerDay: cfg.videosPerDay || 3,
        uploadTimes: cfg.uploadTimes || ['12:00', '15:00', '18:00'],
        defaultTitle: cfg.defaultTitle || '',
        defaultDescription: cfg.defaultDescription || '',
        defaultTags: cfg.defaultTags || '',
        uploadPrivacy: cfg.uploadPrivacy || 'public',
        categoryId: cfg.categoryId || '22'
      }
    ];
    saveConfig({ campaigns: cfg.campaigns });
  }

  // Ensure campaigns have clipper defaults
  cfg.campaigns = (cfg.campaigns || []).map(camp => ({
    clipperSpeed: 1.2,
    clipperFlip: true,
    clipperCaptionStyle: 'bold_white',
    clipperColorGrade: 'vibrant',
    clipperVignette: true,
    clipperGlow: false,
    clipperGrain: false,
    clipperMusic: '',
    clipperLanguage: 'auto',
    clipperEdgeCrop: 0,
    clipperZoom: 1.0,
    clipperAudioPitch: 1.0,
    clipperAutoFaceTrack: false,
    ...camp
  }));

  return {
    geminiKey:           cfg.geminiKey           || '',
    ytdlpCookies:        cfg.ytdlpCookies        || '',
    exportFolder:        cfg.exportFolder        || path.join(app.getPath('desktop'), 'AutoTube Outputs'),
    uploadProxy:         cfg.uploadProxy         || '',
    campaigns:           cfg.campaigns           || []
  };
});

ipcMain.handle('settings:save', (event, settings) => {
  saveConfig(settings);
  console.log('[settings] Saved to:', CONFIG_PATH);
  return { success: true };
});

// ── IPC: Native Dialogs & Shell ───────────────────────────────────────────
ipcMain.handle('shell:open', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('music:save', async (event, { name, buffer }) => {
  try {
    const musicDir = path.join(app.getPath('userData'), 'custom_music');
    if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });
    const safeName = name.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const destPath = path.join(musicDir, safeName);
    fs.writeFileSync(destPath, Buffer.from(buffer));
    console.log('[music] Saved custom music to:', destPath);
    return destPath;
  } catch (err) {
    console.error('[music] Failed to save:', err.message);
    return null;
  }
});

ipcMain.handle('music:download-yt', async (event, { url }) => {
  try {
    const musicDir = path.join(app.getPath('userData'), 'custom_music');
    if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });

    // Resolve yt-dlp binary — from unpacked asar in production, node_modules in dev
    const { createRequire } = await import('module');
    const _req = createRequire(import.meta.url);
    let ytDlpBin;
    let ffmpegBin;
    if (app.isPackaged) {
      ytDlpBin = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
      ffmpegBin = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    } else {
      const ytDlpExec = _req('yt-dlp-exec');
      ytDlpBin = ytDlpExec.path || path.join(__dirname, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
      ffmpegBin = _req('ffmpeg-static');
    }

    const outputTemplate = path.join(musicDir, '%(title)s.%(ext)s');

    await new Promise((resolve, reject) => {
      const proc = spawn(ytDlpBin, [
        url,
        '-x',                          // extract audio only
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--ffmpeg-location', ffmpegBin,
        '-o', outputTemplate,
        '--no-playlist',
      ]);
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`yt-dlp exited with code ${code}`)));
      proc.stderr.on('data', d => console.log('[yt-dlp music]', d.toString()));
    });

    // Find the downloaded file (most recent mp3 in musicDir)
    const files = fs.readdirSync(musicDir)
      .filter(f => f.endsWith('.mp3'))
      .map(f => ({ name: f, time: fs.statSync(path.join(musicDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    if (!files.length) throw new Error('No audio file found after download.');
    const latest = files[0];
    return { success: true, path: path.join(musicDir, latest.name), name: latest.name };
  } catch (err) {
    console.error('[music:download-yt] Error:', err.message);
    return { success: false, error: err.message };
  }
});




ipcMain.handle('clipper:process_single', async (event, { videoPath, config }) => {
  try {
    const logFn = (msg) => event.sender.send('pipeline-log', msg);
    const finalPath = await processVideoWithClipper(videoPath, logFn, config);
    return { success: true, outputPath: finalPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

import { GoogleGenAI } from '@google/genai';
ipcMain.handle('validate-gemini', async (event, key) => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: 'Respond with a single word "ok".'
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Video Analysis ────────────────────────────────────────────────────
ipcMain.handle('analyze-video', async (event, videoPath) => {
  try {
    const cfg = loadConfig();
    if (!cfg.geminiKey) throw new Error('No API key set.');
    const result = await analyzeVideo(videoPath, cfg.geminiKey);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


ipcMain.handle('gemini:generate', async (event, { videoPath, metadata }) => {
  try {
    const cfg = loadConfig();
    if (!cfg.geminiKey) throw new Error('No Gemini API key set. Please configure it in settings.');
    const result = await generateYouTubeMetadata(videoPath, cfg.geminiKey, metadata, os.tmpdir());
    return { success: true, metadata: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Real pipeline ─────────────────────────────────────────────────────
ipcMain.on('run-pipeline', async (event, payload) => {
  const cfg = loadConfig();
  const { videoPath, settings } = payload;

  if (!videoPath) {
    event.reply('pipeline-log', '❌ No video path provided. Please add a video to the queue first.');
    event.reply('pipeline-status', { status: 'error' });
    return;
  }

  if (!cfg.geminiKey) {
    event.reply('pipeline-log', '❌ No Gemini API key. Please go to API Settings and save your key first.');
    event.reply('pipeline-status', { status: 'error' });
    return;
  }

  const result = await runFullPipeline(event, videoPath, settings || {}, cfg.geminiKey, cfg.exportFolder);
  event.reply('pipeline-status', result);
});

// ══════════════════════════════════════════════════════════════════════════
// ── IPC: YouTube OAuth2 & Upload ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

ipcMain.handle('youtube:auth', async (event, { campaignId, accountIndex }) => {
  try {
    const cfg = loadConfig();
    const campaign = (cfg.campaigns || []).find(c => c.id === campaignId);
    if (!campaign) throw new Error('Invalid campaign ID.');
    
    const accounts = campaign.youtubeAccounts || [];
    if (!accounts[accountIndex]) throw new Error('Invalid YouTube account index.');
    
    const { clientId, clientSecret } = accounts[accountIndex];
    if (!clientId || !clientSecret) throw new Error('YouTube Client ID or Secret not configured.');

    const { authUrl, oauth2Client } = initYouTubeAuth(clientId, clientSecret);
    const tokens = await startElectronOAuth(authUrl, oauth2Client);

    // Save tokens to the specific account
    accounts[accountIndex].tokens = tokens;
    saveConfig({ campaigns: cfg.campaigns });

    return { success: true, tokens };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('youtube:check', async (event, { campaignId, accountIndex }) => {
  try {
    const cfg = loadConfig();
    const campaign = (cfg.campaigns || []).find(c => c.id === campaignId);
    if (!campaign) return { connected: false, error: 'Campaign not found' };

    const accounts = campaign.youtubeAccounts || [];
    if (!accounts[accountIndex] || !accounts[accountIndex].tokens) return { connected: false, error: 'Not authenticated' };
    
    const { clientId, clientSecret, tokens } = accounts[accountIndex];
    const result = await checkYouTubeConnection(clientId, clientSecret, tokens);
    return result;
  } catch (err) {
    return { connected: false, error: err.message };
  }
});

ipcMain.handle('youtube:disconnect', (event, { campaignId, accountIndex }) => {
  const cfg = loadConfig();
  const campaign = (cfg.campaigns || []).find(c => c.id === campaignId);
  if (campaign && campaign.youtubeAccounts && campaign.youtubeAccounts[accountIndex]) {
    campaign.youtubeAccounts[accountIndex].tokens = null;
    saveConfig({ campaigns: cfg.campaigns });
  }
  return { success: true };
});

// Helper for rotating YouTube keys
async function uploadWithKeyRotation(campaign, videoPath, metadata, win) {
  const accounts = campaign.youtubeAccounts || [];
  if (win) win.webContents.send(`scheduler-log-${campaign.id}`, `> 🐛 DEBUG: uploadWithKeyRotation received campaign ${campaign.id} with ${accounts.length} accounts.`);
  if (accounts.length === 0) throw new Error('No YouTube accounts connected for this campaign.');

  let lastError = null;

  for (let i = 0; i < accounts.length; i++) {
    const { clientId, clientSecret, tokens } = accounts[i];
    if (!tokens) {
      if (win) win.webContents.send('scheduler-log', `> ⚠️ Account ${i+1} is not authenticated. Skipping...`);
      continue;
    }

    if (win && accounts.length > 1) win.webContents.send('scheduler-log', `> 📤 Trying YouTube Account ${i+1}...`);
    
    const result = await uploadToYouTube(clientId, clientSecret, tokens, videoPath, metadata);

    if (result.success) {
      return result;
    } else {
      lastError = new Error(result.error);
      const errStr = result.error.toLowerCase();
      // Only rotate on quota errors
      if (errStr.includes('exceeded') || errStr.includes('quota') || errStr.includes('limit') || errStr.includes('403')) {
        if (win && i < accounts.length - 1) {
          win.webContents.send('scheduler-log', `> 🔄 Quota reached on Account ${i+1}. Switching to next YouTube API key...`);
        } else if (win) {
          win.webContents.send('scheduler-log', `> ❌ Quota reached on Account ${i+1} and no more keys available.`);
        }
        continue;
      } else {
        throw lastError; // Non-quota error, fail fast
      }
    }
  }

  throw lastError || new Error('All YouTube accounts failed or were unauthenticated.');
}

ipcMain.handle('youtube:upload', async (event, { campaignId, videoPath, metadata }) => {
  try {
    const cfg = loadConfig();
    const campaign = (cfg.campaigns || []).find(c => c.id === campaignId);
    if (!campaign) throw new Error('Invalid campaign ID.');

    // Check if already uploaded
    if (isAlreadyUploaded(campaignId, videoPath)) {
      return { success: false, error: 'Video already uploaded. Skipping.', skipped: true };
    }

    const result = await uploadWithKeyRotation(campaign, videoPath, metadata, null);

    if (result.success) {
      addToUploadHistory(campaignId, {
        sourcePath: videoPath,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        title: metadata.title,
        uploadedAt: new Date().toISOString(),
        status: 'success'
      });
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('youtube:history', (event, campaignId) => {
  return getUploadHistory(campaignId);
});

// ══════════════════════════════════════════════════════════════════════════
// ── IPC: TikTok ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

ipcMain.handle('tiktok:info', async (event, url) => {
  try {
    const cfg = loadConfig();
    return await getTikTokVideoInfo(url, cfg.ytdlpCookies);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('tiktok:check', async (event, url) => {
  try {
    const cfg = loadConfig();
    return await checkTikTokConnection(url || 'https://www.tiktok.com/@tiktok', cfg.ytdlpCookies);
  } catch (err) {
    return { connected: false, error: err.message };
  }
});

ipcMain.handle('tiktok:videos', async (event, { username, limit }) => {
  try {
    const cfg = loadConfig();
    return await listTikTokVideos(username, cfg.ytdlpCookies, limit || 10);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('tiktok:download', async (event, { url }) => {
  try {
    const cfg = loadConfig();
    const outputDir = path.join(cfg.exportFolder || path.join(app.getPath('desktop'), 'AutoTube Outputs'), 'TikTok Downloads');
    const filePath = await downloadTikTokVideo(url, outputDir, cfg.ytdlpCookies);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function getMainWindow() {
  const wins = BrowserWindow.getAllWindows();
  return wins.length > 0 ? wins[0] : null;
}

ipcMain.handle('tiktok:to:youtube', async (event, { campaignId, url, metadata }) => {
  try {
    const cfg = loadConfig();
    const campaign = (cfg.campaigns || []).find(c => c.id === campaignId);
    if (!campaign) throw new Error('Invalid campaign ID.');

    const outputDir = path.join(cfg.exportFolder || path.join(app.getPath('desktop'), 'AutoTube Outputs'), 'TikTok Downloads');
    const filePath = await downloadTikTokVideo(url, outputDir, cfg.ytdlpCookies);
    const uploadRes = await uploadWithKeyRotation(campaign, filePath, metadata, null);
    
    if (uploadRes.success) {
      addToUploadHistory(campaignId, {
        sourcePath: url,
        videoId: uploadRes.videoId,
        videoUrl: uploadRes.videoUrl,
        title: metadata.title,
        uploadedAt: new Date().toISOString(),
        status: 'success'
      });
    }
    
    return uploadRes;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ── Scheduler Setup & State (Multi-Campaign) ──────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const schedulers = new Map(); // campaignId -> UploadScheduler

function setupSchedulerFunctions(campaignConfig) {
  const fetchNextVideosFn = async () => {
    const cfg = loadConfig();
    const campaignId = campaignConfig.id;
    const latestCampaign = (cfg.campaigns || []).find(c => c.id === campaignId) || campaignConfig;
    
    if (latestCampaign.sourceType === 'local_folder' && latestCampaign.localFolder) {
      if (fs.existsSync(latestCampaign.localFolder)) {
        const files = fs.readdirSync(latestCampaign.localFolder);
        const videos = files
          .filter(f => f.match(/\.(mp4|mov|avi|mkv)$/i))
          .map(f => path.join(latestCampaign.localFolder, f));
        return videos.map(v => ({ url: v, title: path.basename(v, path.extname(v)), description: '', tags: '' }));
      }
      return [];
    }
    
    return await listTikTokVideos(latestCampaign.tiktokUsername, cfg.ytdlpCookies, 15);
  };

  const uploadFn = async (videoObj) => {
    const cfg = loadConfig();
    const campaignId = campaignConfig.id;
    const latestCampaign = (cfg.campaigns || []).find(c => c.id === campaignId) || campaignConfig;
    const videoUrl = typeof videoObj === 'string' ? videoObj : videoObj.url;
    const win = getMainWindow();

    const isLocal = latestCampaign.sourceType === 'local_folder';

    if (isAlreadyUploaded(campaignId, videoUrl)) {
      if (win) win.webContents.send(`scheduler-log-${campaignId}`, `> ⏭️ Already uploaded ${videoUrl}, skipping.`);
      throw new Error(`Already uploaded: ${videoUrl}`);
    }

    let info = typeof videoObj === 'object' ? videoObj : { title: path.basename(videoUrl, path.extname(videoUrl)), description: '', tags: '' };
    if (!isLocal && typeof videoObj === 'string') {
        info = await getTikTokVideoInfo(videoUrl, cfg.ytdlpCookies);
    }

    const metadata = {
      title: latestCampaign.defaultTitle ? `${latestCampaign.defaultTitle} ${info.title}`.substring(0, 100) : info.title,
      description: latestCampaign.defaultDescription ? `${latestCampaign.defaultDescription}\n\n${info.description}` : info.description,
      tags: latestCampaign.defaultTags ? latestCampaign.defaultTags.split(',').map(t => t.trim()) : (info.tags ? (typeof info.tags === 'string' ? info.tags.split(',').map(t => t.trim()) : info.tags) : []),
      privacy: latestCampaign.uploadPrivacy || 'public',
      categoryId: latestCampaign.categoryId || '22'
    };

    if (win) win.webContents.send(`scheduler-log-${campaignId}`, `> 🎬 Video: ${info.title}`);
    
    let videoPath = videoUrl;
    if (!isLocal) {
      if (win) win.webContents.send(`scheduler-log-${campaignId}`, '> 📥 Downloading video from TikTok...');
      const outputDir = path.join(cfg.exportFolder || path.join(app.getPath('desktop'), 'AutoTube Outputs'), 'TikTok Downloads');
      videoPath = await downloadTikTokVideo(videoUrl, outputDir, cfg.ytdlpCookies);
    }
    
    // 🔥 CLIPPER AI
    if (latestCampaign.clipperEnabled !== false) {
      try {
        videoPath = await processVideoWithClipper(videoPath, (msg) => {
          if (win) win.webContents.send(`scheduler-log-${campaignId}`, msg);
          console.log('[Scheduler]', msg);
        }, latestCampaign);
      } catch (err) {
        if (win) win.webContents.send(`scheduler-log-${campaignId}`, `> ❌ Clipper AI Error: ${err.message}`);
        throw err;
      }
    } else {
      if (win) win.webContents.send(`scheduler-log-${campaignId}`, '> ⏩ Clipper AI bypassed. Using original video.');
    }

    // 🔥 GEMINI SEO ANALYSIS
    if (cfg.geminiKey) {
      if (win) win.webContents.send(`scheduler-log-${campaignId}`, '> 🧠 Analyzing video with Gemini for SEO...');
      const optimizedMetadata = await generateYouTubeMetadata(videoPath, cfg.geminiKey, metadata, os.tmpdir());
      if (optimizedMetadata) {
        metadata.title = optimizedMetadata.title || metadata.title;
        metadata.description = optimizedMetadata.description || metadata.description;
        metadata.tags = optimizedMetadata.tags || metadata.tags;
        if (win) win.webContents.send(`scheduler-log-${campaignId}`, `> ✨ Gemini SEO Applied: ${metadata.title.substring(0, 40)}...`);
      }
    }

    if (win) win.webContents.send(`scheduler-log-${campaignId}`, '> 📤 Uploading to YouTube...');
    const result = await uploadWithKeyRotation(latestCampaign, videoPath, metadata, win);

    if (result.success) {
      addToUploadHistory(campaignId, {
        sourcePath: videoUrl,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
        title: metadata.title,
        uploadedAt: new Date().toISOString(),
        status: 'success'
      });
      if (win) win.webContents.send(`scheduler-log-${campaignId}`, `> ✅ Uploaded: ${result.videoUrl}`);

      if (isLocal) {
        // Move to Done folder
        try {
          const doneFolder = path.join(path.dirname(videoPath), 'Done');
          if (!fs.existsSync(doneFolder)) fs.mkdirSync(doneFolder);
          const destPath = path.join(doneFolder, path.basename(videoPath));
          fs.renameSync(videoPath, destPath);
          if (win) win.webContents.send(`scheduler-log-${campaignId}`, `> 📁 Moved video to Done folder.`);
        } catch (e) {
          console.error('Failed to move uploaded local video', e);
        }
      }
    } else {
      throw new Error(result.error);
    }
  };

  const logFn = (msg) => {
    console.log('[Scheduler]', msg);
    const win = getMainWindow();
    if (win) win.webContents.send('scheduler-log', msg);
  };

  return { fetchNextVideosFn, uploadFn, logFn };
}

ipcMain.handle('scheduler:start', async (event, campaignConfig) => {
  try {
    const campaignId = campaignConfig.id;
    if (schedulers.has(campaignId)) {
      schedulers.get(campaignId).stop();
      schedulers.delete(campaignId);
    }

    const { fetchNextVideosFn, uploadFn, logFn } = setupSchedulerFunctions(campaignConfig);
    const scheduler = new UploadScheduler(uploadFn, logFn);
    
    scheduler.start({
      fetchNextVideosFn,
      videosPerDay: campaignConfig.videosPerDay || 1,
      uploadTimes: campaignConfig.uploadTimes,
      checkUploadedFn: (url) => isAlreadyUploaded(campaignId, url)
    });
    
    schedulers.set(campaignId, scheduler);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('scheduler:force', async (event, campaignConfig) => {
  try {
    const { fetchNextVideosFn, uploadFn, logFn } = setupSchedulerFunctions(campaignConfig);
    
    // We can just use a temporary UploadScheduler instance to run processNextVideo once!
    const tempScheduler = new UploadScheduler(uploadFn, logFn);
    tempScheduler.config = {
      fetchNextVideosFn,
      videosPerDay: 9999, // Allow it to run even if limit reached today
      checkUploadedFn: (url) => isAlreadyUploaded(campaignConfig.id, url)
    };
    
    await tempScheduler.processNextVideo();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('scheduler:add_to_campaign', async (event, { campaignId, videoPath }) => {
  try {
    const cfg = loadConfig();
    const camp = cfg.campaigns.find(c => c.id === campaignId);
    if (!camp) throw new Error('Campaign not found.');
    
    let targetFolder = camp.localFolder;
    if (!targetFolder || !fs.existsSync(targetFolder)) {
      targetFolder = path.join(app.getPath('userData'), 'campaign_inputs', camp.name.replace(/[^a-zA-Z0-9]/g, '_'));
      if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });
      camp.localFolder = targetFolder;
      camp.sourceType = 'local_folder';
      saveConfig(cfg);
    }
    
    const newPath = path.join(targetFolder, path.basename(videoPath));
    fs.copyFileSync(videoPath, newPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('scheduler:stop', (event, campaignId) => {
  if (schedulers.has(campaignId)) {
    schedulers.get(campaignId).stop();
    schedulers.delete(campaignId);
  }
  return { success: true };
});

ipcMain.handle('scheduler:all_status', () => {
  const result = {};
  for (const [id, sched] of schedulers.entries()) {
    result[id] = sched.getStatus().isRunning;
  }
  return result;
});

ipcMain.handle('scheduler:status', (event, campaignId) => {
  if (schedulers.has(campaignId)) {
    return schedulers.get(campaignId).getStatus();
  }
  return { isRunning: false, videosPerDay: 0, videosUploadedToday: 0, videosRemaining: 0, nextUploadTime: null, totalUploaded: 0 };
});

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

let pythonProcess = null;
let pythonProcessExiting = false;

function startPythonClipper() {
  pythonProcessExiting = false;
  
  // Kill existing process if any
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch (_) {}
    pythonProcess = null;
  }

  if (app.isPackaged) {
    // Production Mode: run the bundled PyInstaller executable
    const exePath = path.join(process.resourcesPath, 'python_clipper', 'python_clipper.exe');
    if (fs.existsSync(exePath)) {
      console.log('[python] Starting packaged python_clipper.exe...');
      // PyInstaller exe does NOT accept --host/--port args — start it directly
      pythonProcess = spawn(exePath, [], {
        env: { ...process.env, PORT: '8000', HOST: '127.0.0.1' }
      });
      pythonProcess.stdout.on('data', data => console.log(`[python] ${data}`));
      pythonProcess.stderr.on('data', data => console.error(`[python error] ${data}`));
      pythonProcess.on('close', (code) => {
        console.log(`[python] Process exited with code ${code}`);
        pythonProcess = null;
        // Auto-restart if it crashed unexpectedly (not during app shutdown)
        if (!pythonProcessExiting && code !== 0) {
          console.log('[python] Backend crashed — auto-restarting in 2s...');
          setTimeout(() => startPythonClipper(), 2000);
        }
      });
      return;
    } else {
      console.warn('[python] Bundled executable not found at:', exePath);
    }
  }

  // Dev Mode: fallback to venv
  const pythonDir = path.join(__dirname, 'python_clipper');
  const venvPython = process.platform === 'win32' 
    ? path.join(pythonDir, '.venv', 'Scripts', 'uvicorn.exe')
    : path.join(pythonDir, '.venv', 'bin', 'uvicorn');
    
  if (fs.existsSync(venvPython)) {
    console.log('[python] Starting clipping-tool backend from venv...');
    pythonProcess = spawn(venvPython, ['app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
      cwd: pythonDir,
      env: process.env
    });
    
    pythonProcess.stdout.on('data', data => console.log(`[python] ${data}`));
    pythonProcess.stderr.on('data', data => console.error(`[python error] ${data}`));
    pythonProcess.on('close', (code) => {
      console.log(`[python] Process exited with code ${code}`);
      pythonProcess = null;
      // Auto-restart if it crashed unexpectedly (not during app shutdown)
      if (!pythonProcessExiting && code !== 0) {
        console.log('[python] Backend crashed — auto-restarting in 2s...');
        setTimeout(() => startPythonClipper(), 2000);
      }
    });
  } else {
    console.warn('[python] Could not find python venv. Run setup script in python_clipper.');
  }
}

// IPC handler to restart the Python clipper backend on demand
ipcMain.on('clipper:restart', () => {
  console.log('[python] Received restart request from renderer...');
  startPythonClipper();
});

// Also listen for process-level restart event (from clipperClient in main process context)
process.on('clipper-restart', () => {
  console.log('[python] Received restart event from clipperClient...');
  startPythonClipper();
});

// Auto-Updater Setup
let updateWindow = null;
autoUpdater.autoDownload = false;

autoUpdater.on('update-available', (info) => {
  if (updateWindow) updateWindow.webContents.send('update_available', info);
});
autoUpdater.on('update-not-available', () => {
  if (updateWindow) updateWindow.webContents.send('update_not_available');
});
autoUpdater.on('download-progress', (progressObj) => {
  if (updateWindow) updateWindow.webContents.send('download_progress', progressObj);
});
autoUpdater.on('update-downloaded', () => {
  if (updateWindow) updateWindow.webContents.send('update_downloaded');
});

ipcMain.handle('app:check_updates', async (event) => {
  updateWindow = event.sender.getOwnerBrowserWindow();
  if (!app.isPackaged) return { success: false, error: 'Auto-updates are disabled in dev mode.' };
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:download_update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:install_update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('app:clear_data', async () => {
  try {
    const cfg = store.get('appSettings') || {};
    const exportFolder = cfg.exportFolder || path.join(app.getPath('desktop'), 'AutoTube Outputs');
    const tiktokDir = path.join(exportFolder, 'TikTok Downloads');
    const tempDir = path.join(app.getPath('userData'), 'temp');
    const clipperDir = app.isPackaged ? path.join(process.resourcesPath, 'python_clipper', 'clips') : path.join(__dirname, 'python_clipper', 'clips');

    let deletedBytes = 0;
    
    // Helper to delete dir contents but keep the dir itself, returning bytes freed
    const clearDir = (dirPath) => {
      if (!fs.existsSync(dirPath)) return 0;
      let freed = 0;
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        try {
          const stats = fs.statSync(fullPath);
          freed += stats.size;
          fs.rmSync(fullPath, { recursive: true, force: true });
        } catch (e) {
          console.error('Failed to delete', fullPath, e);
        }
      }
      return freed;
    };

    deletedBytes += clearDir(tiktokDir);
    deletedBytes += clearDir(tempDir);
    deletedBytes += clearDir(clipperDir);

    // Convert to MB
    const mbFreed = (deletedBytes / (1024 * 1024)).toFixed(2);
    return { success: true, message: `Successfully cleared ${mbFreed} MB of cached videos.` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  initDatabase(app.getPath('userData'));
  startPythonClipper();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  pythonProcessExiting = true;
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => {
  pythonProcessExiting = true;
  if (pythonProcess) pythonProcess.kill();
});

// ── IPC: Clipper Extract Highlights ──
ipcMain.handle('clipper:extract_highlights', async (event, videoPath, numClips) => {
  try {
    const cfg = loadConfig();
    if (!cfg.geminiKey) throw new Error('No API key set. Please configure in settings.');
    // We need a temp directory
    const tempDir = path.join(app.getPath('userData'), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const highlights = await extractViralHighlights(videoPath, cfg.geminiKey, tempDir, numClips || 3);
    return { success: true, data: highlights };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Clipper Download URL ──
ipcMain.handle('clipper:download_url', async (event, url) => {
  try {
    const ytDlp = (await import('yt-dlp-exec')).default;
    const tempDir = path.join(app.getPath('userData'), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const outputPath = path.join(tempDir, `download-${Date.now()}.mp4`);
    
    const options = {
        output: outputPath,
        format: 'best',
        noCheckCertificates: true,
        noWarnings: true
    };
    
    // Try with chrome cookies first, then edge, then none
    try {
        await ytDlp(url, { ...options, cookiesFromBrowser: 'chrome' });
    } catch (e1) {
        console.warn('Chrome cookies failed, trying Edge...', e1.message);
        try {
            await ytDlp(url, { ...options, cookiesFromBrowser: 'edge' });
        } catch (e2) {
            console.warn('Edge cookies failed, trying without cookies...', e2.message);
            await ytDlp(url, options);
        }
    }
    
    if (!fs.existsSync(outputPath)) {
        throw new Error('yt-dlp completed but output file not found.');
    }
    
    return { success: true, filePath: outputPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
