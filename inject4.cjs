const fs = require('fs');
const path = 'src/backend/pipeline.js';
let code = fs.readFileSync(path, 'utf8');

const newFunc = `
// ── Step X: Viral Highlight Extraction ─────────────────────────────────────
export async function extractViralHighlights(videoPath, geminiKey, tempDir) {
  if (!geminiKey) throw new Error('No Gemini API key set. Please configure it in settings.');
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Extract up to 20 minutes of audio
  const durationSec = await getVideoDuration(videoPath);
  const maxDuration = Math.min(durationSec, 1200); 

  const tempWav = require('path').join(tempDir || require('os').tmpdir(), \`highlight-audio-\${Date.now()}.wav\`);
  await extractAudio(videoPath, tempWav, maxDuration);
  
  const audioData = require('fs').readFileSync(tempWav);
  const base64Audio = audioData.toString('base64');
  try { require('fs').unlinkSync(tempWav); } catch (e) {}

  const prompt = \`You are an expert TikTok and YouTube Shorts curator.
I have provided the audio track of a video. 
Listen to the audio and identify the 3 to 5 most engaging, viral, and high-retention segments (hooks, funny moments, deep insights). 
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
IMPORTANT: start_time and end_time MUST be numbers in seconds. Do not return markdown. Return ONLY the JSON array.\`;

  const parts = [
    { text: prompt },
    { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
  ];

  try {
    const response = await generateContentWithRetryAndFallback(ai, [{ parts }]);
    const rawText = response.candidates[0].content.parts[0].text;
    const jsonMatch = rawText.match(/\\[[\\s\\S]*\\]/);
    if (!jsonMatch) throw new Error('Invalid JSON from Gemini');
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error('[Highlight Extractor] Error:', err.message);
    throw err;
  }
}
`;

if (!code.includes('extractViralHighlights')) {
    code += newFunc;
    fs.writeFileSync(path, code);
    console.log('Added extractViralHighlights');
} else {
    console.log('Already exists');
}
