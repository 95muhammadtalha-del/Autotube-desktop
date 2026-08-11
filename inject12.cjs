const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

const anchor = "ipcMain.handle('clipper:download_url', async (event, url) => {";
if (code.includes(anchor)) {
    const startIdx = code.indexOf(anchor);
    // Find the first '});' after the anchor
    const endStr = "});";
    const endIdx = code.indexOf(endStr, startIdx);
    
    // We want to keep everything up to endIdx + 3
    const correctCode = code.substring(0, endIdx + endStr.length) + "\n";
    
    fs.writeFileSync('main.js', correctCode);
    console.log("Fixed main.js syntax error");
}
