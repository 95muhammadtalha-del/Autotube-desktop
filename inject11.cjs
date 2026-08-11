const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

const downloadFunc = `// ── IPC: Clipper Download URL ──
ipcMain.handle('clipper:download_url', async (event, url) => {
  try {
    const ytDlp = (await import('yt-dlp-exec')).default;
    const tempDir = path.join(app.getPath('userData'), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const outputPath = path.join(tempDir, \`download-\${Date.now()}.mp4\`);
    
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
});`;

// Replace the existing handler
const startStr = "// ── IPC: Clipper Download URL ──";
if (code.includes(startStr)) {
    const endStr = "});";
    const startIndex = code.indexOf(startStr);
    const endIndex = code.indexOf(endStr, startIndex) + endStr.length;
    
    code = code.substring(0, startIndex) + downloadFunc + code.substring(endIndex);
    fs.writeFileSync('main.js', code);
    console.log('Updated main.js download handler');
} else {
    console.log('Could not find download handler');
}
