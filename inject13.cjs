const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

// Find the start of the broken handler
const anchor = "// ── IPC: Clipper Download URL ──";
if (code.includes(anchor)) {
    const startIdx = code.indexOf(anchor);
    // Remove everything from the anchor to the end of the file
    code = code.substring(0, startIdx);
    
    // Append the correct handler
    code += `// ── IPC: Clipper Download URL ──
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
});
`;
    fs.writeFileSync('main.js', code);
    console.log("Fixed main.js unexpected end of input");
}
