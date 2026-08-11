import fs from 'fs';
import path from 'path';

/**
 * UploadScheduler - Schedules and manages automated video uploads
 */
export class UploadScheduler {
  /**
   * @param {Function} uploadFn - Callback function that uploads a single video (receives videoPath, returns promise)
   * @param {Function} logFn - Function for logging messages
   */
  constructor(uploadFn, logFn) {
    this.uploadFn = uploadFn;
    this.logFn = logFn;
    
    this.timer = null;
    this.isRunning = false;
    this.config = null;
    this.videosUploadedToday = 0;
    this.totalUploaded = 0;
    this.lastUploadDate = new Date();
    this.nextUploadTime = null;
  }

  // History methods handled externally via checkUploadedFn and uploadFn



  /**
   * Starts the upload scheduler
   * @param {Object} config - { sourceFolder, videosPerDay, privacy, defaultTitle, defaultDescription, defaultTags, historyPath }
   */
  start(config) {
    if (this.isRunning) {
      this.stop();
    }
    
    this.config = config;
    this.isRunning = true;
    
    // Ensure videosPerDay is within limits (1-10)
    const vpd = Math.max(1, Math.min(10, config.videosPerDay || 1));
    this.uploadTimes = config.uploadTimes || Array(vpd).fill('12:00');
    this.uploadedSlotsToday = new Set();
    this.lastCheckedMinute = null;

    this.logFn(`Starting scheduler: ${vpd} videos per day at ${this.uploadTimes.join(', ')}`);
    
    // Check every 30 seconds
    const intervalMs = 30 * 1000;

    this.updateNextUploadTime();

    this.timer = setInterval(async () => {
      const now = new Date();
      
      // Reset daily counters if day changed
      if (this.lastUploadDate.getDate() !== now.getDate()) {
        this.videosUploadedToday = 0;
        this.lastUploadDate = now;
        this.uploadedSlotsToday.clear();
      }

      const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0');
      
      // Prevent running multiple times in the same minute
      if (this.lastCheckedMinute === currentHHMM) return;
      this.lastCheckedMinute = currentHHMM;

      // Check if current time matches any scheduled time
      if (this.uploadTimes.includes(currentHHMM)) {
        if (!this.uploadedSlotsToday.has(currentHHMM)) {
          this.uploadedSlotsToday.add(currentHHMM);
          this.logFn(`> ⏰ Scheduled time reached: ${currentHHMM}`);
          await this.processNextVideo();
          this.updateNextUploadTime();
        }
      } else {
          this.updateNextUploadTime();
      }
    }, intervalMs);
  }

  updateNextUploadTime() {
    const now = new Date();
    const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const sortedTimes = [...this.uploadTimes].sort();
    
    for (const t of sortedTimes) {
      if (t > currentHHMM && !this.uploadedSlotsToday.has(t)) {
        this.nextUploadTime = t;
        return;
      }
    }
    if (sortedTimes.length > 0) {
      this.nextUploadTime = `${sortedTimes[0]} (Tomorrow)`;
    } else {
      this.nextUploadTime = 'No schedule';
    }
  }

  /**
   * Processes the next video in the queue
   */
  async processNextVideo() {
    const { fetchNextVideosFn, checkUploadedFn } = this.config;
    let candidates = [];
    try {
      this.logFn('> 🔍 Checking TikTok for new videos...');
      const allVideos = await fetchNextVideosFn();
      
      candidates = allVideos.filter(v => {
        const url = typeof v === 'string' ? v : v.url;
        if (!url) return false;
        if (typeof checkUploadedFn === 'function') {
          return !checkUploadedFn(url);
        }
        return true;
      });
    } catch (err) {
      this.logFn(`> ❌ Error fetching videos: ${err.message}`);
      throw err;
    }

    if (candidates.length === 0) {
      const msg = 'No new videos found on TikTok to upload.';
      this.logFn(`> ℹ️ ${msg}`);
      throw new Error(msg);
    }

    // Try up to 3 candidates — some TikTok videos fail extraction due to anti-bot measures
    const maxAttempts = Math.min(candidates.length, 3);
    for (let i = 0; i < maxAttempts; i++) {
      const video = candidates[i];
      const videoUrl = typeof video === 'string' ? video : video.url;
      this.logFn(`> ⚙️ Starting automated process for: ${videoUrl}`);

      try {
        await this.uploadFn(video);
        this.logFn(`> ✅ Successfully uploaded: ${videoUrl}`);
        
        this.videosUploadedToday++;
        this.totalUploaded++;
        return; // success — stop trying
      } catch (err) {
        this.logFn(`> ❌ Failed to process ${videoUrl}: ${err.message}`);
        if (i < maxAttempts - 1) {
          this.logFn(`> 🔄 Trying next video (${i + 2}/${maxAttempts})...`);
        }
      }
    }

    throw new Error(`All ${maxAttempts} video attempts failed. Check TikTok connection or try again later.`);
  }

  /**
   * Stops the scheduler and clears the timer
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.nextUploadTime = null;
    this.logFn('Scheduler stopped.');
  }

  /**
   * Returns current scheduler state and stats
   * @returns {Object} status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      videosPerDay: this.config ? this.config.videosPerDay : 0,
      videosUploadedToday: this.videosUploadedToday,
      videosRemaining: this.config ? Math.max(0, this.config.videosPerDay - this.videosUploadedToday) : 0,
      nextUploadTime: this.nextUploadTime,
      totalUploaded: this.totalUploaded
    };
  }
}
