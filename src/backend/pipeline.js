import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { GoogleGenAI } from '@google/genai';

const require = createRequire(import.meta.url);

// Use bundled ffmpeg-static binary (no system FFmpeg install needed)
let FFMPEG_PATH = 'ffmpeg'; // fallback to system
try {
  FFMPEG_PATH = require('ffmpeg-static');
  console.log('[pipeline] Using bundled FFmpeg:', FFMPEG_PATH);
} catch (e) {
  console.warn('[pipeline] ffmpeg-static not found, using system ffmpeg');
}

// ── Step 1: Extract audio from video using FFmpeg ──────────────────────────
export function extractAudio(videoPath, outputWav, maxDurationSec = null) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', videoPath];
    if (maxDurationSec) {
      args.push('-t', maxDurationSec.toString());
    }
    args.push('-vn', '-ar', '16000', '-ac', '1', '-f', 'wav', outputWav);

    const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
    proc.stderr.on('data', d => process.stdout.write('[FFmpeg extract] ' + d.toString()));
    proc.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg audio extract failed (exit code ${code}).`))
    );
  });
}

// ── Step 1.1: Get exact video duration in seconds ──────────────────────────
export function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_PATH, ['-i', videoPath], { stdio: 'pipe' });
    let out = '';
    proc.stderr.on('data', d => out += d.toString());
    proc.on('close', () => {
      const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (m) {
        const sec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        resolve(sec);
      } else {
        resolve(60);
      }
    });
  });
}

// ── Step 1.2: Extract keyframe images for Gemini Vision ────────────────────
export function extractKeyframes(videoPath, outputDir, numFrames = 5) {
  return new Promise((resolve) => {
    const args = [
      '-y', '-i', videoPath,
      '-vf', 'fps=0.2',
      '-vframes', numFrames.toString(),
      path.join(outputDir, 'frame_%03d.jpg')
    ];
    const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe' });
    proc.on('close', code => {
      if (code === 0) {
        try {
          const files = fs.readdirSync(outputDir).filter(f => f.startsWith('frame_')).map(f => path.join(outputDir, f));
          resolve(files);
        } catch { resolve([]); }
      } else {
        resolve([]);
      }
    });
  });
}

// ── Helper: Gemini Call with Retries and Model Fallbacks ───────────────────
async function generateContentWithRetryAndFallback(ai, contents) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini] Calling ${model} (Attempt ${attempt})...`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            maxOutputTokens: 8192
          }
        });
        return response;
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini] ${model} attempt ${attempt} failed: ${err.message}`);
        if (err.status === 503 || err.status === 429 || err.message?.includes('503') || err.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 2000));
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}

// ── Step 1.5: Analyze Video (For UI pre-check) ─────────────────────────────
export async function analyzeVideo(videoPath, geminiKey) {
  if (!geminiKey) throw new Error('No Gemini API key.');
  
  const tempWav = path.join(os.tmpdir(), `autotube-analyze-${Date.now()}.wav`);
  await extractAudio(videoPath, tempWav, 30); // only first 30 seconds

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const audioData = fs.readFileSync(tempWav);
  const base64Audio = audioData.toString('base64');
  
  try { fs.unlinkSync(tempWav); } catch (e) {}

  const prompt = `Listen to this short audio clip.
Return ONLY valid JSON in this exact format (no markdown):
{
  "detected": true,
  "hasSpeech": true/false,
  "hasMusic": true/false,
  "lang": "Detected spoken language (e.g. English, Urdu, Hindi, Spanish, or 'None' if no speech)",
  "suggestion": "A 1-sentence recommendation for processing this video."
}`;

  const response = await generateContentWithRetryAndFallback(ai, [
    {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
      ]
    }
  ]);

  const rawText = response.candidates[0].content.parts[0].text;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid JSON from Gemini');
  return JSON.parse(jsonMatch[0]);
}

// ── Step 1.6: Generate YouTube Metadata (SEO via Gemini) ───────────────────
export async function generateYouTubeMetadata(videoPath, geminiKey, baseMetadata, tempDir) {
  if (!geminiKey) return baseMetadata; // Fallback if no key

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  
  // Extract audio (first 60s is enough for context)
  const tempWav = path.join(tempDir || os.tmpdir(), `autotube-seo-${Date.now()}.wav`);
  await extractAudio(videoPath, tempWav, 60);
  const audioData = fs.readFileSync(tempWav);
  const base64Audio = audioData.toString('base64');
  try { fs.unlinkSync(tempWav); } catch (e) {}

  // Extract 3 keyframes for visual context
  const keyframeFiles = await extractKeyframes(videoPath, tempDir || os.tmpdir(), 3);
  const imageParts = keyframeFiles.map(fp => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: fs.readFileSync(fp).toString('base64')
    }
  }));

  const prompt = `You are an expert YouTube SEO specialist and social media analyst.
I am providing you with:
1. Keyframe snapshots from a video (in sequential order).
2. The audio track of the video.
3. Original context from the source (if any): "${baseMetadata.title || ''} ${baseMetadata.description || ''}"

Your task is to analyze the visual content and audio to understand EXACTLY what is happening in this video. 

CRITICAL RULES:
- DO NOT hallucinate or invent context that isn't clearly visible in the images or heard in the audio. If it's a simple meme or funny clip, treat it as such.
- Keep the title highly relatable, catchy, and click-worthy (max 70 chars).
- The description MUST be exactly 2-3 sentences, natural-sounding, and summarize what is ACTUALLY happening in the video. Do not be overly dramatic or write poetic paragraphs.
- Seamlessly integrate relevant keywords into the description.
- You MUST put 3-4 highly relevant hashtags at the very end of the description text.

Return ONLY valid JSON in this exact format (no markdown):
{
  "title": "A highly catchy, relatable YouTube title",
  "description": "A realistic 2-3 sentence description summarizing the actual video content. Seamlessly integrate relevant keywords, ending with 3-4 hashtags.",
  "tags": "comma, separated, list, of, 15, highly, relevant, seo, tags"
}`;

  const parts = [
    { text: prompt },
    ...imageParts,
    { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
  ];

  try {
    const response = await generateContentWithRetryAndFallback(ai, [{ parts }]);
    const rawText = response.candidates[0].content.parts[0].text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON from Gemini');
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      title: parsed.title || baseMetadata.title,
      description: parsed.description || baseMetadata.description,
      tags: parsed.tags ? parsed.tags.split(',').map(t => t.trim()) : baseMetadata.tags
    };
  } catch (err) {
    console.error('[Gemini SEO] Error generating metadata:', err.message);
    return baseMetadata; // Fallback to original
  }
}

// ── Step 2: Gemini Vision — Multimodal Script Rewrite ─────────────────────
export async function generateScript(videoPath, audioPath, settings, geminiKey, tempDir, videoDurationSec = 60) {
  if (!geminiKey) throw new Error('No Gemini API key. Go to API Settings and save your key first.');

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const audioData = fs.readFileSync(audioPath);
  const base64Audio = audioData.toString('base64');

  // Determine keyframe sections needed to cover 100% of duration (1 section per 45 seconds, max 10 keyframes)
  const numSections = Math.max(1, Math.min(10, Math.ceil(videoDurationSec / 45)));
  const minWords = Math.min(2000, Math.max(150, Math.round(videoDurationSec * 2.2))); // ~130-140 words per minute

  const keyframeFiles = await extractKeyframes(videoPath, tempDir, numSections);
  const imageParts = keyframeFiles.map(fp => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: fs.readFileSync(fp).toString('base64')
    }
  }));

  const tone = settings.tone || 'engaging and smooth';
  const lang = settings.scriptLang || 'same language as spoken in the video';
  const customInstructions = settings.customInstructions || '';
  const durationMin = (videoDurationSec / 60).toFixed(1);

  const prompt = `You are a professional video script writer and narrator.

I am providing you with:
1. ${keyframeFiles.length} keyframe snapshots extracted sequentially across the video.
2. The audio track of the video.

CRITICAL FULL-LENGTH DURATION INSTRUCTION:
- The total length of this video is ${Math.round(videoDurationSec)} seconds (approx ${durationMin} minutes).
- YOU MUST WRITE A FULL-LENGTH CONTINUOUS NARRATION SCRIPT OF AT LEAST ${minWords} WORDS!
- Do NOT abbreviate or summarize long videos into a short 40-second script!
- Write a detailed, section-by-section commentary matching each of the ${keyframeFiles.length} keyframe images.

Please analyze BOTH the visual video frames AND the audio track carefully:
1. OBSERVE THE VISUAL CONTENT: What is shown in each frame? Who is in it (e.g., a boy, a girl, a man, a woman)? What action/topic is taking place?
2. DETECT GENDER: Is the primary person/speaker in the video male or female?
3. WRITE AN ACCURATE LONG-FORM NARRATION SCRIPT:
   - Target Language: ${lang} (if Urdu, write natively in Urdu script like اردو so Neural TTS speaks it accurately).
   - Word Count Target: AT LEAST ${minWords} WORDS of detailed narration!
   - Make it continuous, seamless, and deeply engaging across all ${keyframeFiles.length} sections of the video.
${customInstructions ? `4. Extra instructions: ${customInstructions}` : ''}

Return ONLY valid JSON in this format (no markdown):
{
  "original_transcript": "what was said in the audio",
  "detected_gender": "male" or "female",
  "rewritten_script": "the full long-form continuous narration text (at least ${minWords} words)",
  "sentences": ["sentence 1", "sentence 2", "sentence 3"]
}`;

  const parts = [
    { text: prompt },
    ...imageParts,
    { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
  ];

  const response = await generateContentWithRetryAndFallback(ai, [{ parts }]);

  const rawText = response.candidates[0].content.parts[0].text;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini returned invalid output format.');
  const parsed = JSON.parse(jsonMatch[0]);

  // Programmatically chunk full script into 3-word viral subtitle phrases
  const fullScriptText = parsed.rewritten_script || '';
  const words = fullScriptText.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const WORDS_PER_CHUNK = 3;
  const phraseChunks = [];

  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    phraseChunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
  }

  const totalChunks = phraseChunks.length || 1;
  const secPerChunk = videoDurationSec / totalChunks;

  const lines = phraseChunks.map((phrase, idx) => ({
    text: phrase.trim(),
    start_sec: Number((idx * secPerChunk).toFixed(2)),
    end_sec: Number(((idx + 1) * secPerChunk).toFixed(2))
  }));

  return {
    original_transcript: parsed.original_transcript || '',
    detected_gender: parsed.detected_gender || 'male',
    rewritten_script: parsed.rewritten_script || '',
    lines
  };
}

import { Communicate } from 'edge-tts-universal';

// ── Step 3: Microsoft Edge Neural TTS (Male & Female Support) ────────────
export async function generateTTS(text, outputWav, settings, detectedGender = 'male') {
  const lang = settings?.scriptLang || 'en';
  
  // Determine gender (User override or Auto-Detected by Gemini Vision)
  const selectedGender = (settings?.voiceGender && settings.voiceGender !== 'auto')
    ? settings.voiceGender
    : (detectedGender || 'male');

  let voice = 'en-US-ChristopherNeural';
  const l = lang.toLowerCase();

  if (l.includes('urdu')) {
    voice = (selectedGender === 'female') ? 'ur-PK-UzmaNeural' : 'ur-PK-AsadNeural';
  } else if (l.includes('hindi')) {
    voice = (selectedGender === 'female') ? 'hi-IN-SwaraNeural' : 'hi-IN-MadhurNeural';
  } else if (l.includes('spanish')) {
    voice = (selectedGender === 'female') ? 'es-ES-ElviraNeural' : 'es-ES-AlvaroNeural';
  } else if (l.includes('french')) {
    voice = (selectedGender === 'female') ? 'fr-FR-DeniseNeural' : 'fr-FR-HenriNeural';
  } else if (l.includes('german')) {
    voice = (selectedGender === 'female') ? 'de-DE-KatjaNeural' : 'de-DE-KillianNeural';
  } else {
    voice = (selectedGender === 'female') ? 'en-US-JennyNeural' : 'en-US-ChristopherNeural';
  }

  try {
    const communicate = new Communicate(text, { voice });
    const buffers = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio') buffers.push(chunk.data);
    }

    const outputMp3 = outputWav.replace('.wav', '.mp3');
    fs.writeFileSync(outputMp3, Buffer.concat(buffers));
    return outputMp3;
  } catch (err) {
    throw new Error('Microsoft Edge Neural TTS failed: ' + err.message);
  }
}

// ── Step 4: Generate .srt subtitle file ───────────────────────────────────
export function generateSRT(lines, srtPath) {
  const toTime = (sec) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(sec % 60)).padStart(2, '0');
    const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  };
  const srt = lines.map((l, i) =>
    `${i + 1}\n${toTime(l.start_sec)} --> ${toTime(l.end_sec)}\n${l.text}\n`
  ).join('\n');
  fs.writeFileSync(srtPath, srt, 'utf-8');
}

import https from 'https';

async function downloadMusic(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// ── Step 5: Render final video with FFmpeg ─────────────────────────────────
export function renderFinalVideo(videoPath, ttsPath, srtPath, outputPath, settings, log, videoDurationSec = 60) {
  return new Promise(async (resolve, reject) => {
    let musicPath = null;
    const tempDir = path.dirname(ttsPath);

    if (settings.copyrightMusic) {
      log('🎵 Downloading copyright-free background music...');
      musicPath = path.join(tempDir, 'bg_music.mp3');
      try {
        await downloadMusic('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', musicPath);
        log('✓ Music downloaded.');
      } catch (e) {
        log('⚠️ Failed to download music, continuing without it.');
        musicPath = null;
      }
    }

    // Copy srt to relative file inside tempDir to avoid Windows drive letter colon escaping issues
    let relSrtName = null;
    if (fs.existsSync(srtPath)) {
      relSrtName = 'captions.srt';
      fs.copyFileSync(srtPath, path.join(tempDir, relSrtName));
    }
    
    // Trending Subtitle Styling (Dynamic from UI presets, commas escaped with \\, for FFmpeg parser)
    const font = settings.subFont || 'Arial';
    const size = settings.subSize || '14';
    const color = settings.subColor || '&H0000FFFF';
    const align = settings.subPosition || '2'; // Default 2 = Bottom Center
    const borderStyle = settings.subBox ? '3' : '1';
    const backColor = settings.subBox ? '&H80000000' : '&H00000000';
    const outline = settings.subBox ? '1' : '2';
    
    const subStyle = `Fontname=${font}\\,Fontsize=${size}\\,PrimaryColour=${color}\\,BackColour=${backColor}\\,Bold=1\\,Alignment=${align}\\,BorderStyle=${borderStyle}\\,Outline=${outline}\\,Shadow=1\\,MarginV=30`;

    const args = ['-y', '-i', videoPath, '-i', ttsPath];
    if (musicPath) args.push('-stream_loop', '-1', '-i', musicPath);

    // 1. Video mapping / filtering (ALWAYS map 0:v:0 so video stream is included)
    args.push('-map', '0:v:0');
    if (settings.burnSubtitles && relSrtName) {
      args.push('-vf', `subtitles=${relSrtName}:force_style=${subStyle}`);
    }

    // 2. Audio mapping / mixing (Padded with silence to preserve 100% full video duration)
    const padDur = Math.ceil(videoDurationSec);
    if (musicPath) {
      args.push('-filter_complex', `[1:a]apad=whole_dur=${padDur}[tts];[2:a]volume=0.1[bg];[tts][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
      args.push('-map', '[aout]');
    } else {
      args.push('-filter_complex', `[1:a]apad=whole_dur=${padDur}[aout]`);
      args.push('-map', '[aout]');
    }

    // 3. Encoder settings: -sn strips any old embedded soft subtitle tracks from the input video
    args.push('-sn', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', outputPath);

    // Run FFmpeg inside tempDir so relative subtitles=captions.srt works flawlessly!
    const proc = spawn(FFMPEG_PATH, args, { stdio: 'pipe', cwd: tempDir });
    proc.stderr.on('data', d => process.stdout.write('[FFmpeg render] ' + d.toString()));
    proc.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`FFmpeg render failed (exit code ${code})`))
    );
  });
}

// ── Master pipeline ────────────────────────────────────────────────────────
export async function runFullPipeline(event, videoPath, settings, geminiKey, exportFolder) {
  const log = (msg) => event.reply('pipeline-log', msg);
  const tempDir = path.join(os.tmpdir(), 'autotube-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  const outDirBase = exportFolder || path.dirname(videoPath);
  const doneDir = path.join(outDirBase, 'Done');
  try { fs.mkdirSync(doneDir, { recursive: true }); } catch (e) {}
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const outputPath = path.join(doneDir, `${baseName}_autotube_${Date.now()}.mp4`);

  try {
    // Step 0 — Get video duration
    log('📹 Step 1/5 — Measuring video duration & extracting frames...');
    const videoDurationSec = await getVideoDuration(videoPath);
    log(`✓ Total Video Length: ${Math.round(videoDurationSec)}s (${(videoDurationSec / 60).toFixed(1)} mins).`);

    // Step 1 — Extract audio
    const audioPath = path.join(tempDir, 'audio.wav');
    await extractAudio(videoPath, audioPath);
    log('✓ Audio & keyframes extracted.');

    // Step 2 — Gemini AI script
    log('🤖 Step 2/5 — Sending video frames & audio to Gemini Vision...');
    const scriptData = await generateScript(videoPath, audioPath, settings, geminiKey, tempDir, videoDurationSec);
    log(`✓ Detected Gender: ${scriptData.detected_gender || 'male'}`);
    log(`✓ Original: "${(scriptData.original_transcript || '').slice(0, 80)}..."`);
    log(`✓ New script: "${(scriptData.rewritten_script || '').slice(0, 80)}..."`);

    // Step 3 — TTS
    log('🎙️ Step 3/5 — Generating Microsoft Edge Neural AI voiceover...');
    const ttsPathBase = path.join(tempDir, 'tts.wav');
    const ttsPath = await generateTTS(scriptData.rewritten_script || 'No script generated.', ttsPathBase, settings, scriptData.detected_gender);
    log('✓ Voiceover generated.');

    // Step 4 — Subtitles
    log('📝 Step 4/5 — Generating subtitle file...');
    const srtPath = path.join(tempDir, 'captions.srt');
    generateSRT(scriptData.lines || [], srtPath);
    log(`✓ ${(scriptData.lines || []).length} subtitle lines created.`);

    // Step 5 — Final render
    log('🎬 Step 5/5 — Rendering final 100% full length video...');
    await renderFinalVideo(videoPath, ttsPath, srtPath, outputPath, settings, log, videoDurationSec);
    log(`✅ Done! Saved to: ${outputPath}`);

    return { success: true, outputPath };
    log(`✅ Done! Saved to: ${outputPath}`);

    return { success: true, outputPath };

  } catch (err) {
    log('❌ Pipeline error: ' + err.message);
    console.error('[pipeline]', err);
    return { success: false, error: err.message };

  } finally {
    // Clean up temp files
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Step X: Viral Highlight Extraction ─────────────────────────────────────
export async function extractViralHighlights(videoPath, geminiKey, tempDir, numClips = 3) {
  if (!geminiKey) throw new Error('No Gemini API key set. Please configure it in settings.');
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Extract up to 20 minutes of audio
  const durationSec = await getVideoDuration(videoPath);
  const maxDuration = Math.min(durationSec, 1200); 

  const tempWav = path.join(tempDir || os.tmpdir(), `highlight-audio-${Date.now()}.wav`);
  await extractAudio(videoPath, tempWav, maxDuration);
  
  const audioData = fs.readFileSync(tempWav);
  const base64Audio = audioData.toString('base64');
  try { fs.unlinkSync(tempWav); } catch (e) {}

  const prompt = `You are an expert TikTok and YouTube Shorts curator.
I have provided the audio track of a video. 
Listen to the audio and identify the exactly ${numClips} most engaging, viral, and high-retention segments (hooks, funny moments, deep insights). 
Each segment should be between 25 and 60 seconds long.

Return ONLY valid JSON in this exact format (no markdown, no backticks):
[
  {
    "title": "A catchy, clickbait title for this clip",
    "start_time": 12.5,
    "end_time": 45.0,
    "viral_score": 95,
    "reason": "1-sentence explanation of why this clip will go viral"
  }
]
IMPORTANT: start_time and end_time MUST be numbers in seconds. Do not return markdown. Return ONLY the JSON array.`;

  const parts = [
    { text: prompt },
    { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
  ];

  try {
    const response = await generateContentWithRetryAndFallback(ai, [{ parts }]);
    const rawText = response.candidates[0].content.parts[0].text;
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid JSON from Gemini');
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error('[Highlight Extractor] Error:', err.message);
    throw err;
  }
}
