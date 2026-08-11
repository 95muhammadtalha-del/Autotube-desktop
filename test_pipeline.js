import { runFullPipeline } from './src/backend/pipeline.js';
import path from 'path';

const event = {
  reply: (chan, msg) => console.log(`[IPC Reply] ${chan}:`, msg)
};

async function test() {
  console.log("Starting test...");
  const settings = {
    burnSubtitles: true,
    tone: 'funny',
    scriptLang: 'English'
  };
  
  // Create a dummy file just to pass existence checks
  const fs = await import('fs');
  fs.writeFileSync('dummy_test_video.mp4', 'dummy data');

  try {
    const result = await runFullPipeline(event, 'dummy_test_video.mp4', settings, 'test-gemini-key', './');
    console.log("Test finished with:", result);
  } catch (e) {
    console.error("Test error:", e);
  }
}

test();
