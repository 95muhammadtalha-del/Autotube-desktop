const fs = require('fs');

// 1. Update pipeline.js
let pipelineCode = fs.readFileSync('src/backend/pipeline.js', 'utf8');
if (pipelineCode.includes('extractViralHighlights(videoPath, geminiKey, tempDir)')) {
    pipelineCode = pipelineCode.replace(
        'extractViralHighlights(videoPath, geminiKey, tempDir)',
        'extractViralHighlights(videoPath, geminiKey, tempDir, numClips = 3)'
    );
    pipelineCode = pipelineCode.replace(
        'identify the 3 to 5 most engaging',
        'identify the exactly ${numClips} most engaging'
    );
    fs.writeFileSync('src/backend/pipeline.js', pipelineCode);
    console.log('Updated pipeline.js numClips');
}

// 2. Update main.js
let mainCode = fs.readFileSync('main.js', 'utf8');

const downloadHandler = `
// ── IPC: Clipper Download URL ──
ipcMain.handle('clipper:download_url', async (event, url) => {
  try {
    const ytDlp = (await import('yt-dlp-exec')).default;
    const tempDir = path.join(app.getPath('userData'), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const outputPath = path.join(tempDir, \`download-\${Date.now()}.mp4\`);
    
    await ytDlp(url, {
        output: outputPath,
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        mergeOutputFormat: 'mp4',
        noCheckCertificates: true,
        noWarnings: true,
        addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0']
    });
    
    if (!fs.existsSync(outputPath)) {
        throw new Error('yt-dlp completed but output file not found.');
    }
    
    return { success: true, filePath: outputPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
`;

if (!mainCode.includes('clipper:download_url')) {
    mainCode += downloadHandler;
    
    // Also update clipper:extract_highlights to accept numClips
    mainCode = mainCode.replace(
        "ipcMain.handle('clipper:extract_highlights', async (event, videoPath) => {",
        "ipcMain.handle('clipper:extract_highlights', async (event, videoPath, numClips) => {"
    );
    mainCode = mainCode.replace(
        "await extractViralHighlights(videoPath, cfg.geminiKey, tempDir);",
        "await extractViralHighlights(videoPath, cfg.geminiKey, tempDir, numClips || 3);"
    );
    
    fs.writeFileSync('main.js', mainCode);
    console.log('Updated main.js');
}

