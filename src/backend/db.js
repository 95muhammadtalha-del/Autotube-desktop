import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

/**
 * Extracts the raw numeric TikTok video ID from a URL.
 * Example: https://www.tiktok.com/@user/video/7669139889803300127?is_from_webapp=1 -> 7669139889803300127
 */
export function extractTikTokId(url) {
  if (!url) return null;
  const match = url.match(/\/video\/(\d+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Initializes the SQLite database and performs migration if necessary.
 */
export function initDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'autotube.db');
  db = new Database(dbPath);

  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      tiktok_id TEXT,
      youtube_id TEXT,
      youtube_url TEXT,
      title TEXT,
      uploaded_at TEXT,
      status TEXT,
      UNIQUE(campaign_id, source_path)
    );
  `);

  // Migrate existing JSON history files
  migrateJsonHistory(userDataPath);
}

/**
 * Migrates old upload-history-*.json files to the SQLite database.
 */
function migrateJsonHistory(userDataPath) {
  try {
    const files = fs.readdirSync(userDataPath);
    const historyFiles = files.filter(f => f.startsWith('upload-history-') && f.endsWith('.json'));
    
    for (const file of historyFiles) {
      // Extract campaign ID from filename (e.g. upload-history-c-1234.json -> c-1234)
      const campaignId = file.replace('upload-history-', '').replace('.json', '');
      const filePath = path.join(userDataPath, file);
      
      const content = fs.readFileSync(filePath, 'utf8');
      const records = JSON.parse(content);
      
      let migratedCount = 0;
      
      const insert = db.prepare(`
        INSERT OR IGNORE INTO campaign_history 
        (campaign_id, source_path, tiktok_id, youtube_id, youtube_url, title, uploaded_at, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((records) => {
        for (const record of records) {
          const tiktokId = extractTikTokId(record.sourcePath || record.path);
          const result = insert.run(
            campaignId,
            record.sourcePath || record.path,
            tiktokId,
            record.videoId || null,
            record.videoUrl || null,
            record.title || null,
            record.uploadedAt || new Date().toISOString(),
            record.status || 'success'
          );
          if (result.changes > 0) migratedCount++;
        }
      });

      insertMany(records);
      
      // Backup and remove the old file so it doesn't get migrated again
      const backupPath = path.join(userDataPath, file + '.backup');
      fs.renameSync(filePath, backupPath);
      
      console.log(`[DB] Migrated ${migratedCount} records from ${file} to SQLite.`);
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
}

export function getUploadHistory(campaignId) {
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM campaign_history WHERE campaign_id = ? ORDER BY uploaded_at DESC');
  const rows = stmt.all(campaignId);
  return rows.map(r => ({
    id: r.id,
    campaignId: r.campaign_id,
    sourcePath: r.source_path,
    tiktokId: r.tiktok_id,
    videoId: r.youtube_id,
    videoUrl: r.youtube_url,
    title: r.title,
    uploadedAt: r.uploaded_at,
    status: r.status
  }));
}

export function addToUploadHistory(campaignId, record) {
  if (!db) return false;
  const tiktokId = extractTikTokId(record.sourcePath);
  
  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO campaign_history 
      (campaign_id, source_path, tiktok_id, youtube_id, youtube_url, title, uploaded_at, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      campaignId,
      record.sourcePath,
      tiktokId,
      record.videoId || null,
      record.videoUrl || null,
      record.title || null,
      record.uploadedAt || new Date().toISOString(),
      record.status || 'success'
    );
    return true;
  } catch (err) {
    console.error('[DB] Add history error:', err);
    return false;
  }
}

export function isAlreadyUploaded(campaignId, sourcePath) {
  if (!db) return false;
  
  // 1. Try to check by robust tiktok_id first!
  const tiktokId = extractTikTokId(sourcePath);
  if (tiktokId) {
    const stmt = db.prepare('SELECT 1 FROM campaign_history WHERE campaign_id = ? AND tiktok_id = ? LIMIT 1');
    const result = stmt.get(campaignId, tiktokId);
    if (result) return true;
  }
  
  // 2. Fallback to exact URL match
  const stmt = db.prepare('SELECT 1 FROM campaign_history WHERE campaign_id = ? AND source_path = ? LIMIT 1');
  const result = stmt.get(campaignId, sourcePath);
  return !!result;
}
