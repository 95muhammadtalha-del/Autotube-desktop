import fs from 'fs';
import path from 'path';
import ytDlp from 'yt-dlp-exec';
import { pipeline } from 'stream/promises';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const DEFAULT_REFERER = 'Referer:https://www.tiktok.com/';

function prepareCookiesOptions(cookiesPath, options) {
  if (!cookiesPath) return;
  const cLower = String(cookiesPath).toLowerCase().trim();
  if (['chrome', 'edge', 'firefox', 'safari', 'opera', 'vivaldi', 'brave'].includes(cLower)) {
    options.cookiesFromBrowser = cLower;
  } else if (String(cookiesPath).includes('# Netscape') || String(cookiesPath).split('\n').length > 1) {
    const tmp = path.join(process.cwd(), 'temp_ytdlp_cookies.txt');
    fs.writeFileSync(tmp, String(cookiesPath));
    options.cookies = tmp;
  } else if (fs.existsSync(cookiesPath)) {
    options.cookies = cookiesPath;
  }
}

/**
 * Checks if the TikTok connection is valid by attempting to fetch a profile or URL.
 * @param {string} url - The TikTok URL to test (e.g. https://www.tiktok.com/@username)
 * @param {string} [cookiesPath] - Optional path to the cookies.txt file.
 * @returns {Promise<{connected: boolean, message?: string, error?: string}>}
 */
export async function checkTikTokConnection(url = 'https://www.tiktok.com/@tiktok', cookiesPath = null) {
  try {
    const options = {
      flatPlaylist: true,
      dumpSingleJson: true,
      playlistEnd: 1,
      userAgent: DEFAULT_USER_AGENT,
      addHeader: DEFAULT_REFERER,
    };
    
    // Only use cookies if they exist
    prepareCookiesOptions(cookiesPath, options);

    // Attempt to fetch info to validate connection
    const data = await ytDlp(url, options);
    
    // Extract profile info from the first video entry or playlist metadata
    let username = url.split('@')[1]?.split('/')[0] || 'TikTok User';
    let displayName = username;
    let avatar = null;

    const entries = (data.entries || []).filter(Boolean);
    const firstVideo = entries.length > 0 ? entries[0] : data;
    
    if (firstVideo.uploader) username = firstVideo.uploader;
    if (firstVideo.channel) displayName = firstVideo.channel;
    
    // Get thumbnail/avatar if available
    if (firstVideo.thumbnails && firstVideo.thumbnails.length > 0) {
      // Find the highest pref or origin cover
      const covers = firstVideo.thumbnails.filter(t => t.id && t.id.toLowerCase().includes('cover'));
      if (covers.length > 0) avatar = covers[0].url;
      else avatar = firstVideo.thumbnails[0].url;
    } else if (firstVideo.thumbnail) {
      avatar = firstVideo.thumbnail;
    }
    
    return { 
      connected: true, 
      message: (options.cookies || options.cookiesFromBrowser) ? 'Connected successfully (using cookies)' : 'Connected successfully (public profile)',
      profileInfo: {
        username: '@' + username,
        displayName: displayName,
        avatar: avatar
      }
    };
  } catch (error) {
    return { 
      connected: false, 
      error: error.message || 'Failed to connect. The profile might be private or require cookies.' 
    };
  }
}

/**
 * Lists recent videos from a TikTok profile.
 * @param {string} username - The TikTok username (e.g., '@username').
 * @param {string} cookiesPath - Path to the cookies.txt file.
 * @param {number} [limit=10] - Maximum number of videos to return.
 * @returns {Promise<Array<{id: string, title: string, url: string, thumbnail: string, duration: number}>>}
 */
export async function listTikTokVideos(username, cookiesPath, limit = 10) {
  let profileUrl = username;
  if (!profileUrl.startsWith('http')) {
    if (!profileUrl.startsWith('@')) {
      profileUrl = `@${profileUrl}`;
    }
    profileUrl = `https://www.tiktok.com/${profileUrl}`;
  }

  try {
    const options = {
      flatPlaylist: true,
      dumpSingleJson: true,
      playlistEnd: limit,
      userAgent: DEFAULT_USER_AGENT,
      addHeader: DEFAULT_REFERER,
    };
    
    prepareCookiesOptions(cookiesPath, options);

    const output = await ytDlp(profileUrl, options);

    const entries = (output.entries || []).filter(Boolean);
    return entries.map(entry => ({
      id: entry.id,
      title: entry.title || '',
      url: entry.url || entry.webpage_url || (entry.id ? `https://www.tiktok.com/${username}/video/${entry.id}` : ''),
      thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail || '',
      duration: entry.duration || 0,
    })).filter(e => e.url);
  } catch (error) {
    console.error('Error listing TikTok videos:', error);
    throw new Error(`Failed to list TikTok videos: ${error.message}`);
  }
}

/**
 * Downloads a single TikTok video using yt-dlp.
 * @param {string} url - The URL of the TikTok video.
 * @param {string} outputDir - The directory to save the downloaded video.
 * @param {string} cookiesPath - Path to the cookies.txt file.
 * @returns {Promise<string>} - The path to the downloaded file.
 */
export async function downloadTikTokVideo(url, outputDir, cookiesPath) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fallbackOutputTemplate = path.join(outputDir, `tiktok_${timestamp}_%(id)s.%(ext)s`);

  // --- Attempt 1: TikWM API Fallback ---
  try {
    console.log(`[TikTok] Attempting TikWM API download for: ${url}`);
    const tikWmRes = await fetch(`https://tikwm.com/api/?url=${url}`);
    const tikWmJson = await tikWmRes.json();
    
    if (tikWmJson.code === 0 && tikWmJson.data && tikWmJson.data.play) {
      const playUrl = tikWmJson.data.play;
      const finalPath = path.join(outputDir, `tiktok_${timestamp}_${tikWmJson.data.id}.mp4`);
      
      const videoRes = await fetch(playUrl);
      if (!videoRes.ok) throw new Error(`Failed to fetch video stream: ${videoRes.statusText}`);
      
      const fileStream = fs.createWriteStream(finalPath);
      // Wait for the pipeline to finish downloading the video
      await pipeline(videoRes.body, fileStream);
      
      console.log(`[TikTok] Successfully downloaded via TikWM: ${finalPath}`);
      return finalPath;
    } else {
      console.warn('[TikTok] TikWM API did not return a valid play URL, falling back to yt-dlp.');
    }
  } catch (err) {
    console.warn('[TikTok] TikWM API failed, falling back to yt-dlp:', err.message);
  }

  // --- Attempt 2: yt-dlp Fallback ---
  try {
    console.log(`[TikTok] Attempting yt-dlp download for: ${url}`);
    const options = {
      output: fallbackOutputTemplate,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      noPlaylist: true,
      playlistEnd: 1,
      userAgent: DEFAULT_USER_AGENT,
      addHeader: DEFAULT_REFERER,
    };
    
    prepareCookiesOptions(cookiesPath, options);

    await ytDlp(url, options);

    // Locate the downloaded mp4 file
    const files = fs.readdirSync(outputDir);
    const downloadedFile = files.find(file => file.startsWith(`tiktok_${timestamp}_`) && file.endsWith('.mp4'));

    if (downloadedFile) {
      return path.join(outputDir, downloadedFile);
    } else {
      throw new Error('File was downloaded but could not be found in output directory');
    }
  } catch (error) {
    console.error('Error downloading TikTok video:', error);
    throw new Error(`Failed to download TikTok video: ${error.message}`);
  }
}

/**
 * Fetches metadata for a single TikTok video.
 * @param {string} url - The URL of the TikTok video.
 * @param {string} cookiesPath - Path to the cookies.txt file.
 * @returns {Promise<{title: string, description: string, tags: string}>}
 */
export async function getTikTokVideoInfo(url, cookiesPath) {
  try {
    const options = {
      dumpSingleJson: true,
      noPlaylist: true,
      userAgent: DEFAULT_USER_AGENT,
      addHeader: DEFAULT_REFERER,
    };
    
    prepareCookiesOptions(cookiesPath, options);

    const data = await ytDlp(url, options);
    
    // Extract hashtags from description if tags array is empty or missing
    let extractedTags = [];
    if (data.tags && data.tags.length > 0) {
      extractedTags = data.tags;
    } else if (data.description) {
      const regex = /#(\w+)/g;
      let match;
      while ((match = regex.exec(data.description)) !== null) {
        extractedTags.push(match[1]);
      }
    }

    // Clean up description (remove hashtags for a cleaner look if desired, or keep them)
    let cleanTitle = data.title || '';
    if (!cleanTitle && data.description) {
      cleanTitle = data.description.split('#')[0].trim();
    }
    if (!cleanTitle) cleanTitle = 'TikTok Video';

    return {
      title: cleanTitle.substring(0, 100), // YouTube title limit is 100 chars
      description: data.description || '',
      tags: extractedTags.join(', '),
    };
  } catch (error) {
    console.error('Error fetching TikTok video info:', error);
    throw new Error(`Failed to fetch video info: ${error.message}`);
  }
}
