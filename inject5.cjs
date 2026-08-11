const fs = require('fs');
const path = 'main.js';
let code = fs.readFileSync(path, 'utf8');

// We need to import extractViralHighlights
if (!code.includes('extractViralHighlights')) {
    code = code.replace(
        "import { generateSEO, generateScript, processWithFFmpeg, getAudioDuration } from './src/backend/pipeline.js';",
        "import { generateSEO, generateScript, processWithFFmpeg, getAudioDuration, extractViralHighlights } from './src/backend/pipeline.js';"
    );
    // fallback if exact match fails
    if (!code.includes('extractViralHighlights')) {
        code = code.replace(
            "import { generateSEO, generateScript, processWithFFmpeg, getAudioDuration",
            "import { generateSEO, generateScript, processWithFFmpeg, getAudioDuration, extractViralHighlights"
        );
    }
}

const newHandler = `
// ── IPC: Clipper Extract Highlights ──
ipcMain.handle('clipper:extract_highlights', async (event, videoPath) => {
  try {
    const cfg = loadConfig();
    if (!cfg.geminiKey) throw new Error('No API key set. Please configure in settings.');
    // We need a temp directory
    const tempDir = path.join(app.getPath('userData'), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const highlights = await extractViralHighlights(videoPath, cfg.geminiKey, tempDir);
    return { success: true, data: highlights };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
`;

if (!code.includes('clipper:extract_highlights')) {
    code += newHandler;
    fs.writeFileSync(path, code);
    console.log('Added clipper:extract_highlights handler');
} else {
    console.log('Handler already exists');
}
