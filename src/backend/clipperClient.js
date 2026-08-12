import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Uploads a raw video to the local Python Clipper API, triggers the editing pipeline 
 * (subtitles, color grading), waits for completion, and returns the path to the edited video.
 */
export async function processVideoWithClipper(videoPath, logFn, config = {}) {
  logFn('> 📤 Uploading raw video to Local Clipper AI...');

  // Wait for Python backend to be ready (Whisper model takes 20-40s to load)
  logFn('> ⏳ Waiting for Clipper AI backend to be ready...');
  const maxWaitMs = 180000; // wait up to 3 minutes (Whisper model can be slow to load)
  const interval = 3000;
  let waited = 0;
  let restartAttempted = false;
  while (waited < maxWaitMs) {
    try {
      const health = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(5000) });
      if (health.ok) break;
    } catch (_) { /* not ready yet */ }

    // If backend hasn't responded after 30s, try restarting it
    if (!restartAttempted && waited >= 30000) {
      restartAttempted = true;
      logFn('> 🔄 Clipper AI not responding — restarting backend...');
      try {
        const electron = await import('electron');
        electron.ipcRenderer?.send?.('clipper:restart');
      } catch (_) {
        // In main process context, try global restart
        try {
          const { ipcMain } = await import('electron');
          // Emit a restart event that main.js handles
          process.emit('clipper-restart');
        } catch (_2) { /* ignore */ }
      }
    }

    if (waited > 0 && waited % 15000 === 0) {
      logFn(`> ⏳ Still waiting for Clipper AI... (${Math.round(waited / 1000)}s elapsed)`);
    }

    await new Promise(r => setTimeout(r, interval));
    waited += interval;
  }
  if (waited >= maxWaitMs) throw new Error('Clipper AI backend did not start in time. Please try again.');
  logFn('> ✅ Clipper AI backend is ready!');

  // 1. Upload to /api/upload
  const fileBuffer = fs.readFileSync(videoPath);
  const blob = new Blob([fileBuffer], { type: 'video/mp4' });
  const formData = new FormData();
  formData.append('file', blob, path.basename(videoPath));

  const uploadRes = await fetch('http://127.0.0.1:8000/api/upload', {
    method: 'POST',
    body: formData
  });
  
  if (!uploadRes.ok) throw new Error(`Clipper upload failed: ${await uploadRes.text()}`);
  const uploadData = await uploadRes.json();
  const uploadId = uploadData.upload_id;

  logFn('> 🎬 Starting Clipper AI editing (auto-subtitles, color grading, etc)...');
  
  // 2. Generate (process the whole video as 1 clip)
  const generateRes = await fetch('http://127.0.0.1:8000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_id: uploadId,
      aspect_ratio: config.aspectRatio || '9:16',
      fit_mode: 'crop',
      num_clips: 1,
      clip_length: 600, // Up to 10 minutes (captures the whole TikTok)
      caption_style: config.clipperCaptionStyle || 'bold_white',
      language: config.clipperLanguage || 'auto',
      video_speed: parseFloat(config.clipperSpeed) || 1.2,
      flip_horizontal: config.clipperFlip !== undefined ? config.clipperFlip : true,
      blur_background: config.clipperBlurBackground || false,
      auto_face_track: config.clipperAutoFaceTrack || false,
      edge_crop: config.clipperEdgeCrop !== undefined ? parseFloat(config.clipperEdgeCrop) : 0,
      zoom_factor: config.clipperZoom !== undefined ? parseFloat(config.clipperZoom) : 1.0,
      audio_pitch: config.clipperAudioPitch !== undefined ? parseFloat(config.clipperAudioPitch) : 1.0,
      music_track: config.clipperMusic
        ? (config.clipperMusic.startsWith('__custom__')
            ? config.clipperMusic.replace('__custom__', '')
            : config.clipperMusic)
        : null,
      video_volume: config.clipperVideoVolume !== undefined ? config.clipperVideoVolume : 100.0,
      music_volume: config.clipperMusicVolume !== undefined ? config.clipperMusicVolume : 35.0,
      cinematic: {
        color_grade: config.clipperColorGrade || 'vibrant',
        glow: config.clipperGlow || false,
        glow_strength: 30,
        grain: config.clipperGrain || false,
        vignette: config.clipperVignette !== undefined ? config.clipperVignette : true,
        vignette_strength: 40
      },
      device: 'auto'
    })
  });
  
  if (!generateRes.ok) throw new Error(`Clipper generate failed: ${await generateRes.text()}`);
  const generateData = await generateRes.json();
  const jobId = generateData.job_id;

  logFn(`> ⏳ Waiting for Clipper AI to finish (Job ID: ${jobId})...`);

  // 3. Poll progress
  return new Promise((resolve, reject) => {
    let lastMessage = '';
    
    const checkProgress = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/result/${jobId}`);
        const data = await res.json();
        
        if (data.status === 'done') {
           logFn('> ✅ Clipper AI finished rendering.');
           const clipUrl = data.clips[0].url; // e.g. /clips/123/0.mp4
           // The url has a format like /clips/abc/0.mp4?v=xyz, we just want the path
           const cleanUrl = clipUrl.split('?')[0];
           
           // Construct absolute path to the generated clip in python_clipper/clips
           // In production (packaged), python_clipper lives under process.resourcesPath
           // In dev, it's relative to the project root
           let clipperRoot;
           try {
             const electron = await import('electron');
             const app = electron.app || electron.remote?.app;
             if (app && app.isPackaged) {
               clipperRoot = path.join(process.resourcesPath, 'python_clipper');
             } else {
               clipperRoot = path.resolve(__dirname, '..', '..', 'python_clipper');
             }
           } catch (_) {
             clipperRoot = path.resolve(__dirname, '..', '..', 'python_clipper');
           }
           const clipPath = path.join(clipperRoot, cleanUrl.replace(/^\//, '').replace(/\//g, path.sep));
           
           resolve(clipPath);
        } else if (data.status === 'error' || data.status === 'cancelled') {
           reject(new Error(`Clipper AI Error: ${data.message || data.error}`));
        } else {
           if (data.message && data.message !== lastMessage) {
              logFn(`> 🤖 Clipper: ${data.message}`);
              lastMessage = data.message;
           }
           setTimeout(checkProgress, 2500);
        }
      } catch (err) {
         reject(err);
      }
    };
    checkProgress();
  });
}
