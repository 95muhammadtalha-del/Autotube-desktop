const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

// 1. youtube:history
code = code.replace(
  /ipcMain\.handle\('youtube:history', \(event, campaignId\) => \{\s*const historyPath = path\.join\(app\.getPath\('userData'\), `upload-history-\$\{campaignId\}\.json`\);\s*return getUploadHistory\(historyPath\);\s*\}\);/,
  `ipcMain.handle('youtube:history', (event, campaignId) => {
  return getUploadHistory(campaignId);
});`
);

// 2. youtube:upload - actually let's just write a generic replace for it
code = code.replace(
  /const historyPath = path\.join\(app\.getPath\('userData'\), `upload-history-\$\{campaignId\}\.json`\);\s*\/\/ Check if already uploaded\s*if \(isAlreadyUploaded\(historyPath, videoPath\)\) \{/g,
  `// Check if already uploaded
    if (isAlreadyUploaded(campaignId, videoPath)) {`
);
code = code.replace(/addToUploadHistory\(historyPath,/g, 'addToUploadHistory(campaignId,');

// 3. setupSchedulerFunctions
code = code.replace(
  /const historyPath = path\.join\(app\.getPath\('userData'\), `upload-history-\$\{campaignId\}\.json`\);\s*if \(isAlreadyUploaded\(historyPath, videoUrl\)\) \{/,
  `if (isAlreadyUploaded(campaignId, videoUrl)) {`
);

// 4. scheduler config - replace historyPath with campaignId
code = code.replace(/historyPath: historyPath/g, 'campaignId: campaignId');
code = code.replace(/historyPath: path\.join\(app\.getPath\('userData'\), `upload-history-\$\{campaignConfig\.id\}\.json`\)/g, 'campaignId: campaignConfig.id');

fs.writeFileSync('main.js', code);
