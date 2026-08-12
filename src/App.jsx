import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trash2,
  Play, 
  FolderOpen, 
  Link, 
  FileText,
  Terminal,
  Activity,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  Upload,
  RefreshCw,
  History,
  Pause,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Scissors,
  Music,
  Download
} from 'lucide-react';
import './index.css';

// Dynamically require electron to avoid Vite build errors
const electron = window.require ? window.require('electron') : null;

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('GLOBAL ERROR:', e.error || e.message);
    if (electron) electron.ipcRenderer.invoke('log-error', e.error ? e.error.stack : e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('GLOBAL PROMISE ERROR:', e.reason);
    if (electron) electron.ipcRenderer.invoke('log-error', String(e.reason));
  });
}

// ── YouTube Audio Downloader Component ────────────────────────────────────────
function YTMusicDownloader({ onSaved }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error
  const [msg, setMsg] = useState('');

  const handleDownload = async () => {
    if (!url.trim()) return;
    setStatus('downloading');
    setMsg('⏳ Downloading audio from YouTube...');
    try {
      const result = await electron.ipcRenderer.invoke('music:download-yt', { url: url.trim() });
      if (result.success) {
        setStatus('done');
        setMsg(`✅ Saved: ${result.name}`);
        setUrl('');
        onSaved(result.path, result.name);
      } else {
        setStatus('error');
        setMsg(`❌ ${result.error}`);
      }
    } catch (e) {
      setStatus('error');
      setMsg(`❌ ${e.message}`);
    }
  };

  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
        <Music size={13} color="var(--brand-primary)" />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>Download from YouTube (Copyright-Free)</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="input-field"
          style={{ flex: 1, fontSize: '0.78rem' }}
          placeholder="Paste YouTube URL... (e.g. youtube.com/watch?v=...)"
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle'); setMsg(''); }}
          onKeyDown={e => e.key === 'Enter' && handleDownload()}
        />
        <button
          className="btn-pill"
          onClick={handleDownload}
          disabled={status === 'downloading' || !url.trim()}
          style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: status === 'downloading' ? 0.6 : 1 }}
        >
          <Download size={12} />
          {status === 'downloading' ? 'Downloading...' : 'Get Audio'}
        </button>
      </div>
      {msg && (
        <p style={{ margin: 0, fontSize: '0.72rem', color: status === 'error' ? 'var(--danger, #ef4444)' : status === 'done' ? 'var(--success, #10b981)' : 'var(--text-muted)' }}>{msg}</p>
      )}
      <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        💡 Search YouTube Audio Library: <a href="#" onClick={e => { e.preventDefault(); electron?.shell?.openExternal('https://studio.youtube.com/channel/audio'); }} style={{ color: 'var(--brand-primary)' }}>studio.youtube.com/channel/audio</a>
      </p>
    </div>
  );
}



const CAPTION_THEMES = [
  { id: 'hormozi_green', label: 'Hormozi Green', render: () => <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: '0.85rem', color: '#FFFFFF' }}>HORMOZI <span style={{ color: '#27E36B' }}>GREEN</span></span> },
  { id: 'hormozi_yellow', label: 'Hormozi Yellow', render: () => <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: '0.85rem', color: '#FFFFFF' }}>HORMOZI <span style={{ color: '#FFD400' }}>YELLOW</span></span> },
  { id: 'beast_red', label: 'Beast Pop', render: () => <span style={{ fontFamily: 'Anton, sans-serif', fontWeight: 400, textTransform: 'uppercase', fontSize: '1rem', color: '#FFFFFF' }}>BEAST <span style={{ color: '#FF3B30' }}>POP</span></span> },
  { id: 'raj_clean', label: 'Raj Shamani Clean', render: () => <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#FFFFFF' }}>Raj <span style={{ color: '#FFC400' }}>Shamani</span></span> },
  { id: 'alex_caps', label: 'Alex Bold Caps', render: () => <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', color: '#FFFFFF' }}>ALEX <span style={{ color: '#22D3EE' }}>BOLD</span></span> },
  { id: 'one_word_punch', label: 'One-Word Punch', render: () => <span style={{ fontFamily: 'Anton, sans-serif', fontWeight: 400, textTransform: 'uppercase', fontSize: '0.9rem', color: '#FFFFFF' }}>ONE-WORD PUNCH</span> },
  { id: 'word_reveal', label: 'Word Reveal', render: () => <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', color: '#FFFFFF' }}>WORD REVEAL</span> },
  { id: 'bebas_clean', label: 'Bebas Clean', render: () => <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontWeight: 400, textTransform: 'uppercase', fontSize: '1rem', color: '#FFFFFF', letterSpacing: '2px' }}>BEBAS CLEAN</span> },
];

// Reusable Components
const Toggle = ({ label, description, checked, onChange, isOrange = false }) => (
  <div className="setting-item">
    <div className="setting-header">
      <div className="setting-info">
        <h4>{label}</h4>
        {description && <p>{description}</p>}
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="slider" style={isOrange && checked ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' } : {}}></span>
      </label>
    </div>
  </div>
);

const RangeSlider = ({ label, value, min, max, unit = '', onChange }) => (
  <div className="range-container">
    <div className="range-header">
      <label>{label}</label>
      <span>{value}{unit}</span>
    </div>
    <input type="range" className="range-slider" min={min} max={max} value={value} onChange={onChange} />
  </div>
);

const InputField = ({ label, placeholder, type = "text", typeElement = "input", options = [], value, onChange }) => (
  <div className="setting-item">
    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</label>
    {typeElement === "select" ? (
      <select className="input-field" value={value} onChange={onChange}>
        {options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
      </select>
    ) : typeElement === "textarea" ? (
      <textarea className="input-field" placeholder={placeholder} value={value} onChange={onChange}></textarea>
    ) : (
      <input type={type} className="input-field" placeholder={placeholder} value={value} onChange={onChange} />
    )}
  </div>
);

export default function App() {
  const [activeNav, setActiveNav] = useState('automation');
  const [logs, setLogs] = useState(['> System ready...', '> Awaiting process start...']);
  const [isRunning, setIsRunning] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [geminiValidation, setGeminiValidation] = useState(null); // 'testing' | 'valid' | 'invalid' | null
  const [cookieValidation, setCookieValidation] = useState(null); // 'testing' | 'valid' | 'invalid' | null
  const [updateState, setUpdateState] = useState({ checking: false, available: false, downloaded: false, progress: 0, error: null });
  const [appSettings, setAppSettings] = useState({
    geminiKey: '',
    youtubeAccounts: [],
    ytdlpCookies: '',
    exportFolder: '',
    uploadPrivacy: 'public',
    uploadProxy: '',
  });

  // ── Automation State ──────────────────────────────────────────────────
  const [ytConnectionsData, setYtConnectionsData] = useState([]);
  
  const fetchYouTubeProfiles = async (campaignId, accounts) => {
    if (!electron || !accounts) return;
    const connections = [];
    for (let i = 0; i < accounts.length; i++) {
      if (accounts[i].tokens) {
        const res = await electron.ipcRenderer.invoke('youtube:check', { campaignId, accountIndex: i });
        connections.push({ index: i, ...res });
      }
    }
    setYtConnectionsData(connections);
  };
  const [tiktokConnection, setTiktokConnection] = useState({ connected: false, message: '', loading: false });
  const [uploadMode, setUploadMode] = useState('manual'); // 'manual' | 'auto'
  const [manualUpload, setManualUpload] = useState({ sourceType: 'file', videoPath: '', tiktokUrl: '', title: '', description: '', tags: '', privacy: 'public', categoryId: '22', uploading: false, result: null });
  const [activeCampaignId, setActiveCampaignId] = useState('default');
  
  const activeCampaign = useMemo(() => {
    return appSettings.campaigns?.find(c => c.id === activeCampaignId) || appSettings.campaigns?.[0] || {
      id: 'default', name: 'Default Campaign', youtubeAccounts: [], tiktokUsername: '', youtubeLink: '',
      videosPerDay: 3, uploadTimes: ['08:00', '15:00', '20:00'], uploadPrivacy: 'public', defaultTitle: '', defaultDescription: 'Uploaded by AutoTube', defaultTags: ''
    };
  }, [appSettings.campaigns, activeCampaignId]);

  const updateActiveCampaign = (updater) => {
    setAppSettings(s => {
      const camps = [...(s.campaigns || [])];
      let idx = camps.findIndex(c => c.id === activeCampaignId);
      if (idx === -1) {
        if (camps.length > 0) idx = 0;
        else return s;
      }
      const current = camps[idx];
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      camps[idx] = next;
      const newSettings = { ...s, campaigns: camps };
      if (electron) electron.ipcRenderer.invoke('settings:save', newSettings);
      return newSettings;
    });
  };
  const [schedulerStatus, setSchedulerStatus] = useState({ isRunning: false });
  const [uploadHistory, setUploadHistory] = useState([]);
  const [schedulerLogs, setSchedulerLogs] = useState([]);
  const [allStatuses, setAllStatuses] = useState({});
  
  useEffect(() => {
    if (!electron) return;
    const interval = setInterval(async () => {
      try {
        const statuses = await electron.ipcRenderer.invoke('scheduler:all_status');
        setAllStatuses(statuses || {});
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // ── Clipper AI Player State ─────────────────────────────────────────────
  const [playerInputVideo, setPlayerInputVideo] = useState(null);
  const [playerOutputVideos, setPlayerOutputVideos] = useState([]);
  const [outputVideoIndex, setOutputVideoIndex] = useState(0);
  const [playerOutputVideo, setPlayerOutputVideo] = useState(null); // Keep for compatibility if needed
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [numClipsToExtract, setNumClipsToExtract] = useState(3);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [extractedHighlights, setExtractedHighlights] = useState(null);
  const [isExtractingHighlights, setIsExtractingHighlights] = useState(false);
  const [scheduleCampaignId, setScheduleCampaignId] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [isPlayerProcessing, setIsPlayerProcessing] = useState(false);
  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);

  
  const handleExtractHighlights = async () => {
    if (!playerInputVideo) {
      alert("No video selected! Please click 'Browse File' to upload a video first.");
      return;
    }
    if (!electron) {
      alert("Electron API is not available. Please restart the app.");
      return;
    }
    setIsExtractingHighlights(true);
    setExtractedHighlights(null);
    try {
        const result = await electron.ipcRenderer.invoke('clipper:extract_highlights', playerInputVideo, numClipsToExtract);
        if (result.success) {
            setExtractedHighlights(result.data);
            alert("Highlights extracted successfully!");
        } else {
            alert('Failed to extract: ' + result.error);
        }
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        setIsExtractingHighlights(false);
    }
  };

  const handleProcessHighlight = (highlight) => {
    // Override settings for this run
    handlePlayerProcess({
       clip_start: highlight.start_time,
       clip_length: highlight.end_time - highlight.start_time,
       num_clips: 1
    });
  };

  const handlePreviewHighlight = (highlight) => {
     if (leftVideoRef.current) {
         leftVideoRef.current.currentTime = highlight.start_time;
         leftVideoRef.current.play();
     }
  };

  
  const handleUrlDownload = async () => {
    if (!urlInput) return;
    setIsDownloading(true);
    try {
        const result = await electron.ipcRenderer.invoke('clipper:download_url', urlInput);
        if (result.success) {
            setPlayerInputVideo(result.filePath);
            setPlayerOutputVideos([]);
            setOutputVideoIndex(0);
        } else {
            alert('Failed to download: ' + result.error);
        }
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        setIsDownloading(false);
    }
  };

  const handleProcessAllHighlights = async () => {
      if (!extractedHighlights || extractedHighlights.length === 0) return;
      setIsProcessingAll(true);
      setPlayerOutputVideos([]);
      setOutputVideoIndex(0);
      for (const hl of extractedHighlights) {
          // Process sequentially
          await handlePlayerProcess({
              clip_start: hl.start_time,
              clip_length: hl.end_time - hl.start_time,
              num_clips: 1
          });
      }
      setIsProcessingAll(false);
  };

  const handlePlayerUpload = async () => {
    if (electron) {
      const filePath = await electron.ipcRenderer.invoke('dialog:openFile');
      if (filePath) {
        setPlayerInputVideo(filePath);
        setPlayerOutputVideo(null);
      }
    }
  };

  const handleScheduleVideo = async (videoPath) => {
    if (!scheduleCampaignId) {
      alert("Please select a campaign to schedule this video to.");
      return;
    }
    if (!scheduleTime) {
      alert("Please specify a time to schedule this video (HH:MM).");
      return;
    }
    
    let campToStart = appSettings.campaigns.find(c => c.id === scheduleCampaignId);

    // Add the selected time to the campaign's uploadTimes if it doesn't already exist
    const campIndex = appSettings.campaigns.findIndex(c => c.id === scheduleCampaignId);
    if (campIndex !== -1) {
       const camp = appSettings.campaigns[campIndex];
       if (!camp.uploadTimes.includes(scheduleTime)) {
           const updatedCamp = { ...camp, uploadTimes: [...camp.uploadTimes, scheduleTime].sort(), videosPerDay: camp.videosPerDay + 1 };
           campToStart = updatedCamp;
           const newCampaigns = [...appSettings.campaigns];
           newCampaigns[campIndex] = updatedCamp;
           const newSettings = { ...appSettings, campaigns: newCampaigns };
           setAppSettings(newSettings);
           if (electron) electron.ipcRenderer.invoke('settings:save', newSettings);
       }
    }

    if (!electron) return;
    try {
      const res = await electron.ipcRenderer.invoke('scheduler:add_to_campaign', { campaignId: scheduleCampaignId, videoPath });
      if (res.success) {
        // Auto-start the scheduler for this campaign with the UPDATED times
        await electron.ipcRenderer.invoke('scheduler:start', campToStart || activeCampaign);
        if (typeof refreshSchedulerStatus === 'function') {
           refreshSchedulerStatus();
        } else {
           setSchedulerStatus(prev => ({ ...prev, isRunning: true }));
        }
        
        alert(`Video successfully scheduled for ${scheduleTime}! The Auto Scheduler is now running.`);
        // Reset inputs after successful schedule
        setScheduleCampaignId('');
        setScheduleTime('');
      } else {
        alert("Failed to schedule: " + res.error);
      }
    } catch (e) {
      alert("Error scheduling video: " + e.message);
    }
  };

  const handlePlayerProcess = async (overrideParams = {}) => {
    if (!playerInputVideo) return;
    setIsPlayerProcessing(true);
    setLogs(prev => [...prev, '> Starting Clipper AI on ' + playerInputVideo + '...']);
    
    if (electron) {
      const res = await electron.ipcRenderer.invoke('clipper:process_single', {
        videoPath: playerInputVideo,
        config: { ...activeCampaign, aspectRatio: aspectRatio, ...overrideParams }
      });
      
      if (res.success) {
        setPlayerOutputVideo(res.outputPath);
        setPlayerOutputVideos(prev => {
          const newVideos = [...prev, res.outputPath];
          setOutputVideoIndex(newVideos.length - 1);
          return newVideos;
        });
        setLogs(prev => [...prev, '> ✅ Success! Output saved to: ' + res.outputPath]);
      } else {
        setLogs(prev => [...prev, '> ❌ Failed: ' + res.error]);
      }
    }
    setIsPlayerProcessing(false);
  };
  
  const handleVideoSync = (sourceRef, targetRef) => {
    if (!sourceRef.current || !targetRef.current) return;
    const source = sourceRef.current;
    const target = targetRef.current;
    
    if (Math.abs(source.currentTime - target.currentTime) > 0.5) {
      target.currentTime = source.currentTime;
    }
    if (!source.paused && target.paused) target.play();
    if (source.paused && !target.paused) target.pause();
  };

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Generate the monthly schedule preview based on activeCampaign
  const schedulePreview = useMemo(() => {
    const { year, month } = calendarMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build uploaded dates set from history
    const uploadedDates = new Set();
    uploadHistory.forEach(item => {
      if (item.uploadedAt) {
        const d = new Date(item.uploadedAt);
        if (d.getFullYear() === year && d.getMonth() === month) {
          uploadedDates.add(d.getDate());
        }
      }
    });

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      const isPast = date < today;
      const isToday = date.getTime() === today.getTime();
      const hasUploads = uploadedDates.has(d);
      
      // Future days (or today) get planned uploads
      const plannedUploads = (!isPast || isToday) ? activeCampaign.uploadTimes.map(t => t) : [];
      
      days.push({ day: d, isPast, isToday, hasUploads, plannedUploads, date });
    }

    // Stats
    const futureDays = days.filter(d => !d.isPast || d.isToday);
    const totalPlanned = futureDays.length * activeCampaign.videosPerDay;
    const totalUploaded = uploadedDates.size;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return { days, firstDayOfWeek, daysInMonth, totalPlanned, totalUploaded, monthName: monthNames[month], year };
  }, [calendarMonth, activeCampaign.videosPerDay, activeCampaign.uploadTimes, uploadHistory]);

  useEffect(() => {
    if (electron) {
      electron.ipcRenderer.on('pipeline-log', (event, message) => {
        setLogs(prev => [...prev, `> ${message}`]);
      });
      electron.ipcRenderer.on('pipeline-status', (event, status) => {
        setIsRunning(false);
        if (status.success) {
          setLogs(prev => [...prev, `> 🎉 Finished! Saved to: ${status.outputPath}`]);
        } else {
          setLogs(prev => [...prev, `> ❌ Pipeline failed: ${status.error}`]);
        }
      });
      // Load saved settings on startup
      electron.ipcRenderer.invoke('settings:load').then(saved => {
        if (saved) {
          setAppSettings(s => ({ ...s, ...saved }));
          const firstCampaignId = saved.campaigns?.[0]?.id || 'default';
          setActiveCampaignId(firstCampaignId);
          fetchYouTubeProfiles(firstCampaignId, saved.campaigns?.find(c => c.id === firstCampaignId)?.youtubeAccounts);
        }
      });
    }
    return () => {
      if (electron) {
        electron.ipcRenderer.removeAllListeners('pipeline-log');
        electron.ipcRenderer.removeAllListeners('pipeline-status');
      }
    };
  }, []);

  const handleSaveSettings = async () => {
    if (electron) {
      await electron.ipcRenderer.invoke('settings:save', appSettings);
    }
    setSettingsSaved(true);
    setLogs(prev => [...prev, '> Settings saved successfully.']);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleOpenFile = (filePath) => {
    if (electron) electron.ipcRenderer.invoke('shell:open', filePath);
  };

  // Renders the Source Accounts and Schedule
  // ── Automation Handlers ────────────────────────────────────────────────

  const handleConnectYouTube = async (index) => {
    // Ensure credentials are saved first before authenticating
    if (electron) await electron.ipcRenderer.invoke('settings:save', appSettings);

    if (electron) {
      const res = await electron.ipcRenderer.invoke('youtube:auth', { campaignId: activeCampaignId, accountIndex: index });
      if (res.success) {
        // Reload settings to grab tokens
        const saved = await electron.ipcRenderer.invoke('settings:load');
        if (saved) {
          setAppSettings(s => ({ ...s, ...saved }));
          // handled in hook;
        }
        setLogs(prev => [...prev, `> ✅ YouTube Account ${index + 1} authenticated successfully!`]);
      } else {
        setLogs(prev => [...prev, `> ❌ YouTube Account ${index + 1} auth failed: ${res.error}`]);
      }
    }
  };

  const handleDisconnectYouTube = async (index) => {
    if (electron) {
      await electron.ipcRenderer.invoke('youtube:disconnect', { campaignId: activeCampaignId, accountIndex: index });
      const saved = await electron.ipcRenderer.invoke('settings:load');
      if (saved) {
        setAppSettings(s => ({ ...s, ...saved }));
        // handled in hook;
      }
      setLogs(prev => [...prev, `> 🔌 YouTube Account ${index + 1} disconnected.`]);
    }
  };

  const addYouTubeAccount = () => {
    updateActiveCampaign(c => ({
      ...c,
      youtubeAccounts: [...(c.youtubeAccounts || []), { clientId: '', clientSecret: '', tokens: null }]
    }));
  };

  const removeYouTubeAccount = (index) => {
    updateActiveCampaign(c => {
      const newAccs = [...(c.youtubeAccounts || [])];
      newAccs.splice(index, 1);
      return { ...c, youtubeAccounts: newAccs };
    });
  };

  const updateYouTubeAccount = (index, field, value) => {
    updateActiveCampaign(c => {
      const newAccs = [...(c.youtubeAccounts || [])];
      newAccs[index] = { ...newAccs[index], [field]: value };
      return { ...c, youtubeAccounts: newAccs };
    });
  };

  const handleCheckTikTok = async () => {
    setTiktokConnection(s => ({ ...s, loading: true }));
    if (electron) {
      const res = await electron.ipcRenderer.invoke('tiktok:check', activeCampaign.tiktokUsername);
      setTiktokConnection({ connected: res.connected, message: res.message || res.error, profileInfo: res.profileInfo, loading: false });
    }
  };

  useEffect(() => {
    if (activeCampaign?.tiktokUsername && !tiktokConnection.connected && !tiktokConnection.loading) {
      handleCheckTikTok();
    }
  }, [activeCampaign?.id]);

  const handleFetchTikTokMetadata = async () => {
    if (!manualUpload.tiktokUrl || !electron) return;
    setManualUpload(s => ({ ...s, fetching: true }));
    setLogs(prev => [...prev, '> 🔍 Fetching TikTok metadata...']);
    const res = await electron.ipcRenderer.invoke('tiktok:info', manualUpload.tiktokUrl);
    if (res && !res.error) {
      setManualUpload(s => ({ 
        ...s, 
        fetching: false,
        title: res.title || s.title,
        description: res.description || s.description,
        tags: res.tags || s.tags
      }));
      setLogs(prev => [...prev, '> ✅ Metadata fetched successfully.']);
    } else {
      setManualUpload(s => ({ ...s, fetching: false }));
      setLogs(prev => [...prev, `> ❌ Failed to fetch metadata: ${res.error}`]);
    }
  };

  const handleManualUpload = async () => {
    if (manualUpload.sourceType === 'file' && !manualUpload.videoPath) return;
    if (manualUpload.sourceType === 'tiktok' && !manualUpload.tiktokUrl) return;
    if (!manualUpload.title) return;

    setManualUpload(s => ({ ...s, uploading: true, result: null }));
    setLogs(prev => [...prev, `> ⚙️ Starting manual upload for ${manualUpload.sourceType === 'tiktok' ? 'TikTok Video' : 'Local File'}...`]);
    
    if (electron) {
      const metadata = {
        title: manualUpload.title,
        description: manualUpload.description,
        tags: manualUpload.tags.split(',').map(t => t.trim()).filter(Boolean),
        privacy: manualUpload.privacy,
        categoryId: manualUpload.categoryId,
      };

      let res;
      if (manualUpload.sourceType === 'file') {
        res = await electron.ipcRenderer.invoke('youtube:upload', { campaignId: activeCampaignId, videoPath: manualUpload.videoPath, metadata });
      } else {
        res = await electron.ipcRenderer.invoke('tiktok:to:youtube', { campaignId: activeCampaignId, url: manualUpload.tiktokUrl, metadata });
      }

      setManualUpload(s => ({ ...s, uploading: false, result: res }));
      if (res.success) {
        setLogs(prev => [...prev, `> ✅ Successfully uploaded to YouTube: ${res.videoUrl}`]);
        loadUploadHistory();
      } else {
        setLogs(prev => [...prev, `> ❌ Upload failed: ${res.error}`]);
      }
    }
  };

  const [allCampaignHistory, setAllCampaignHistory] = useState({});

  const loadUploadHistory = async () => {
    if (electron && appSettings.campaigns) {
      const histories = {};
      for (const campaign of appSettings.campaigns) {
        const history = await electron.ipcRenderer.invoke('youtube:history', campaign.id);
        histories[campaign.id] = history || [];
      }
      setAllCampaignHistory(histories);
      setUploadHistory(histories[activeCampaignId] || []);
    }
  };

  const handleForceUpload = async () => {
    if (!electron) return;
    setSchedulerStatus(s => ({ ...s, forcing: true }));
    setSchedulerLogs(prev => [...prev, '> ⚡ FORCING IMMEDIATE UPLOAD...']);
    const res = await electron.ipcRenderer.invoke('scheduler:force', activeCampaign);
    if (res.success) {
      setSchedulerLogs(prev => [...prev, '> ✅ Force upload complete!']);
      refreshSchedulerStatus();
      loadUploadHistory();
    } else {
      setSchedulerLogs(prev => [...prev, `> ❌ Force upload failed: ${res.error}`]);
    }
    setSchedulerStatus(s => ({ ...s, forcing: false }));
  };

  const handleStartScheduler = async () => {
    if (electron) {
      const res = await electron.ipcRenderer.invoke('scheduler:start', activeCampaign);
      if (res.success) {
        setSchedulerStatus({ isRunning: true });
        setLogs(prev => [...prev, '> 🚀 Auto-upload scheduler started!']);
      } else {
        setLogs(prev => [...prev, `> ❌ Scheduler error: ${res.error}`]);
      }
    }
  };

  const handleStopScheduler = async () => {
    if (electron) {
      await electron.ipcRenderer.invoke('scheduler:stop', activeCampaignId);
      setSchedulerStatus({ isRunning: false });
      setLogs(prev => [...prev, '> ⏹ Scheduler stopped.']);
    }
  };

  const refreshSchedulerStatus = async () => {
    if (electron) {
      const status = await electron.ipcRenderer.invoke('scheduler:status', activeCampaignId);
      setSchedulerStatus(status);
    }
  };

  // Load history and check connections on automation tab open
  useEffect(() => {
    if (activeNav === 'automation' || activeNav === 'settings') {
      fetchYouTubeProfiles(activeCampaignId, activeCampaign.youtubeAccounts);
      handleCheckTikTok();
      loadUploadHistory();
      refreshSchedulerStatus();
    }
  }, [activeNav, activeCampaignId, activeCampaign.youtubeAccounts]);

  // Listen for scheduler logs
  useEffect(() => {
    if (electron) {
      const handler = (event, msg) => {
        setSchedulerLogs(prev => [...prev.slice(-50), msg]);
        setLogs(prev => [...prev, `[Scheduler] ${msg}`]);
      };
      const channel1 = 'scheduler-log';
      const channel2 = `scheduler-log-${activeCampaignId}`;
      electron.ipcRenderer.on(channel1, handler);
      electron.ipcRenderer.on(channel2, handler);
      return () => {
        electron.ipcRenderer.removeListener(channel1, handler);
        electron.ipcRenderer.removeListener(channel2, handler);
      };
    }
  }, [activeCampaignId]);

  useEffect(() => {
    if (electron) {
      const onAvailable = () => setUpdateState(s => ({ ...s, checking: false, available: true }));
      const onNotAvailable = () => setUpdateState(s => ({ ...s, checking: false, available: false, error: 'You are on the latest version.' }));
      const onProgress = (e, info) => setUpdateState(s => ({ ...s, progress: info.percent }));
      const onDownloaded = () => setUpdateState(s => ({ ...s, downloaded: true }));

      electron.ipcRenderer.on('update_available', onAvailable);
      electron.ipcRenderer.on('update_not_available', onNotAvailable);
      electron.ipcRenderer.on('download_progress', onProgress);
      electron.ipcRenderer.on('update_downloaded', onDownloaded);

      return () => {
        electron.ipcRenderer.removeListener('update_available', onAvailable);
        electron.ipcRenderer.removeListener('update_not_available', onNotAvailable);
        electron.ipcRenderer.removeListener('download_progress', onProgress);
        electron.ipcRenderer.removeListener('update_downloaded', onDownloaded);
      };
    }
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateState(s => ({ ...s, checking: true, error: null }));
    const res = await electron.ipcRenderer.invoke('app:check_updates');
    if (!res.success) {
      setUpdateState(s => ({ ...s, checking: false, error: res.error }));
    }
  };

  const handleDownloadUpdate = () => {
    electron.ipcRenderer.invoke('app:download_update');
  };

  const handleInstallUpdate = () => {
    electron.ipcRenderer.invoke('app:install_update');
  };

  const renderClipperSettings = () => (
    <>
      {/* Clipper Settings */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scissors size={16} color="var(--brand-primary)" />
                  Clipper AI Settings
                </h4>
                <button 
                  onClick={() => updateActiveCampaign(s => ({ ...s, clipperEnabled: s.clipperEnabled === false ? true : false }))}
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '2rem',
                    padding: '0.2rem 0.6rem',
                    color: 'var(--text-main)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  title="Toggle Clipper AI on or off"
                >
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: activeCampaign.clipperEnabled !== false ? '#10b981' : '#ef4444',
                    boxShadow: activeCampaign.clipperEnabled !== false ? '0 0 8px #10b981' : '0 0 8px #ef4444'
                  }} />
                  {activeCampaign.clipperEnabled !== false ? 'ON' : 'BYPASS'}
                </button>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem', display: 'block' }}>Theme (Caption Style)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {/* None option */}
                  {(() => {
                    const isNone = (activeCampaign.clipperCaptionStyle || 'hormozi_green') === 'none';
                    return (
                      <div
                        onClick={() => updateActiveCampaign(s => ({ ...s, clipperCaptionStyle: 'none' }))}
                        style={{
                          background: isNone ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-primary)',
                          border: `2px solid ${isNone ? 'var(--brand-primary)' : 'transparent'}`,
                          borderRadius: '0.5rem',
                          padding: '0.75rem 0.5rem 0.5rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '70px',
                          boxShadow: isNone ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s ease',
                          opacity: isNone ? 1 : 0.7,
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ fontSize: '1.5rem' }}>🚫</div>
                        <div style={{ fontSize: '0.65rem', color: isNone ? '#fff' : 'var(--text-muted)', fontWeight: 600 }}>No Captions</div>
                      </div>
                    );
                  })()}
                  {CAPTION_THEMES.map(theme => {
                    const isSelected = (activeCampaign.clipperCaptionStyle || 'hormozi_green') === theme.id;
                    return (
                      <div 
                        key={theme.id}
                        onClick={() => updateActiveCampaign(s => ({ ...s, clipperCaptionStyle: theme.id }))}
                        style={{
                          background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-primary)',
                          border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'transparent'}`,
                          borderRadius: '0.5rem',
                          padding: '0.75rem 0.5rem 0.5rem',
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: '70px',
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s ease',
                          opacity: isSelected ? 1 : 0.7,
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '0.25rem',
                          right: '0.25rem',
                          background: '#ccff00',
                          color: '#000',
                          fontSize: '0.4rem',
                          fontWeight: 800,
                          padding: '0.1rem 0.3rem',
                          borderRadius: '1rem',
                          letterSpacing: '0.5px'
                        }}>
                          TRENDING
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {theme.render()}
                        </div>
                        <div style={{ 
                          width: '100%',
                          textAlign: 'center',
                          fontSize: '0.65rem',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          marginTop: '0.5rem',
                          paddingTop: '0.3rem',
                          borderTop: `1px solid ${isSelected ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`
                        }}>
                          {theme.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Background Music</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select className="input-field" style={{ flex: 1 }} value={activeCampaign.clipperMusic || ''} onChange={e => updateActiveCampaign(s => ({ ...s, clipperMusic: e.target.value, clipperMusicCustomPath: '' }))}>
                      <option value="">None</option>
                      <option value="Arijit_Singh-_Agar_Tum_Sath_Ho_-_Alka_Yagnik__A.R._Rehman__Irshad_Kamil_-_Yo.m4a">Agar Tum Sath Ho (Arijit Singh)</option>
                      <option value="Empire - Ogryzek _edit audio_ __ Non-copyright audios __ lol editz.m4a">Empire (Ogryzek)</option>
                      <option value="Montagem orquesta - sinf_nica _ edit audio _ _.m4a">Montagem Orquesta</option>
                      <option value="Murder-In-My-Mind_PagalWorlld.Com_.mp3">Murder In My Mind</option>
                      <option value="_Karan_Aujla__Official_Video__Tania__Sukh_Sanghera_Desi_Crew__Latest_Punjabi.mp3">Karan Aujla</option>
                      <option value="_Khairiyat__Chhichhore__Nitesh_Tiwari__Arijit_Singh__Sushant__Shraddha__Prit.mp3">Khairiyat</option>
                      <option value="another love - tom odell - edit audio.m4a">Another Love (Tom Odell)</option>
                      <option value="dum dum_ da di da   slowed _ reverb.m4a">Dum Dum (Slowed & Reverb)</option>
                      <option value="lady-gaga-bad-romance-slowed-reverb-bb-127808_456244124.mp3">Bad Romance (Slowed)</option>
                      <option value="ssvid.net---CANTO-DE-LUNA-Best-Part-Slowed-h6itam-ICEDMANE_v720P.m4a">Canto De Luna</option>
                      {activeCampaign.clipperMusicCustomPath && (
                        <option value={`__custom__${activeCampaign.clipperMusicCustomPath}`}>✅ {activeCampaign.clipperMusicCustomName || 'Custom Upload'}</option>
                      )}
                    </select>
                    <label className="btn-pill" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }} title="Upload your own music file">
                      <Upload size={13} /> Upload Music
                      <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" style={{ display: 'none' }} onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        // Save to userData music folder via IPC
                        const reader = new FileReader();
                        reader.onload = async ev => {
                          const buffer = ev.target.result;
                          const savedPath = await electron.ipcRenderer.invoke('music:save', { name: file.name, buffer });
                          if (savedPath) {
                            updateActiveCampaign(s => ({
                              ...s,
                              clipperMusic: `__custom__${savedPath}`,
                              clipperMusicCustomPath: savedPath,
                              clipperMusicCustomName: file.name
                            }));
                          }
                        };
                        reader.readAsArrayBuffer(file);
                      }} />
                    </label>
                  </div>
                  {activeCampaign.clipperMusicCustomPath && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--success)', margin: 0 }}>🎵 Custom: {activeCampaign.clipperMusicCustomName}</p>
                  )}



                  <YTMusicDownloader onSaved={(savedPath, name) => {
                    updateActiveCampaign(s => ({
                      ...s,
                      clipperMusic: `__custom__${savedPath}`,
                      clipperMusicCustomPath: savedPath,
                      clipperMusicCustomName: name
                    }));
                  }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Original Video Volume</label>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{activeCampaign.clipperVideoVolume !== undefined ? activeCampaign.clipperVideoVolume : 100}%</span>
                      </div>
                      <input 
                        type="range" className="range-slider" min="0" max="200" 
                        value={activeCampaign.clipperVideoVolume !== undefined ? activeCampaign.clipperVideoVolume : 100} 
                        onChange={e => updateActiveCampaign(s => ({ ...s, clipperVideoVolume: parseInt(e.target.value) }))} 
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Background Music Volume</label>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{activeCampaign.clipperMusicVolume !== undefined ? activeCampaign.clipperMusicVolume : 35}%</span>
                      </div>
                      <input 
                        type="range" className="range-slider" min="0" max="100" 
                        value={activeCampaign.clipperMusicVolume !== undefined ? activeCampaign.clipperMusicVolume : 35} 
                        onChange={e => updateActiveCampaign(s => ({ ...s, clipperMusicVolume: parseInt(e.target.value) }))} 
                        disabled={!activeCampaign.clipperMusic}
                        style={{ opacity: activeCampaign.clipperMusic ? 1 : 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Color Grade</label>
                  <select className="input-field" value={activeCampaign.clipperColorGrade || 'vibrant'} onChange={e => updateActiveCampaign(s => ({ ...s, clipperColorGrade: e.target.value }))}>
                    <option value="none">None</option>
                    <option value="vibrant">Vibrant / Pop</option>
                    <option value="teal_orange">Teal & Orange</option>
                    <option value="warm">Warm Cinematic</option>
                    <option value="cool">Cool / Moody</option>
                    <option value="vintage">Vintage Film</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Playback Speed</label>
                  <select className="input-field" value={activeCampaign.clipperSpeed || '1.2'} onChange={e => updateActiveCampaign(s => ({ ...s, clipperSpeed: e.target.value }))}>
                    <option value="1.0">1.0x (Normal)</option>
                    <option value="1.1">1.1x (Slightly Faster)</option>
                    <option value="1.2">1.2x (Faster - Bypass Flags)</option>
                    <option value="1.5">1.5x (Fast)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Transcribe Lang</label>
                  <select className="input-field" value={activeCampaign.clipperLanguage || 'auto'} onChange={e => updateActiveCampaign(s => ({ ...s, clipperLanguage: e.target.value }))}>
                    <option value="auto">Auto-Detect</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="hi">Hindi</option>
                    <option value="ur">Urdu</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Edge Crop (%)</label>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{activeCampaign.clipperEdgeCrop !== undefined ? activeCampaign.clipperEdgeCrop : 0}%</span>
                  </div>
                  <input 
                    type="range" className="range-slider" min="0" max="50" 
                    value={activeCampaign.clipperEdgeCrop !== undefined ? activeCampaign.clipperEdgeCrop : 0} 
                    onChange={e => updateActiveCampaign(s => ({ ...s, clipperEdgeCrop: parseInt(e.target.value) }))} 
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Static Zoom (x)</label>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{activeCampaign.clipperZoom !== undefined ? activeCampaign.clipperZoom : 1.0}x</span>
                  </div>
                  <input 
                    type="range" className="range-slider" min="1.0" max="3.0" step="0.1"
                    value={activeCampaign.clipperZoom !== undefined ? activeCampaign.clipperZoom : 1.0} 
                    onChange={e => updateActiveCampaign(s => ({ ...s, clipperZoom: parseFloat(e.target.value) }))} 
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Audio Pitch (x)</label>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)' }}>{activeCampaign.clipperAudioPitch !== undefined ? activeCampaign.clipperAudioPitch : 1.0}x</span>
                  </div>
                  <input 
                    type="range" className="range-slider" min="0.5" max="2.0" step="0.05"
                    value={activeCampaign.clipperAudioPitch !== undefined ? activeCampaign.clipperAudioPitch : 1.0} 
                    onChange={e => updateActiveCampaign(s => ({ ...s, clipperAudioPitch: parseFloat(e.target.value) }))} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCampaign.clipperFlip !== false} onChange={e => updateActiveCampaign(s => ({ ...s, clipperFlip: e.target.checked }))} />
                  Flip Horizontally
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCampaign.clipperBlurBackground || false} onChange={e => updateActiveCampaign(s => ({ ...s, clipperBlurBackground: e.target.checked }))} />
                  Blur Background (Fit Width)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCampaign.clipperAutoFaceTrack || false} onChange={e => updateActiveCampaign(s => ({ ...s, clipperAutoFaceTrack: e.target.checked }))} />
                  Auto-Face Tracking
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCampaign.clipperVignette !== false} onChange={e => updateActiveCampaign(s => ({ ...s, clipperVignette: e.target.checked }))} />
                  Vignette (Dark Corners)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCampaign.clipperGlow || false} onChange={e => updateActiveCampaign(s => ({ ...s, clipperGlow: e.target.checked }))} />
                  Cinematic Glow
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeCampaign.clipperGrain || false} onChange={e => updateActiveCampaign(s => ({ ...s, clipperGrain: e.target.checked }))} />
                  Film Grain
                </label>
              </div>
            </div>
    </>
  );

  const renderAutomationContent = () => (
    <div className="automation-setup" style={{ paddingBottom: '4rem' }}>
      {/* ═══ CAMPAIGN SELECTOR ═══ */}
      <div className="panel-box" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Rename Campaign</label>
          <input 
            type="text"
            className="input-field" 
            value={activeCampaign.name || ''} 
            onChange={(e) => updateActiveCampaign({ name: e.target.value })}
            style={{ fontSize: '1.1rem', fontWeight: 600, padding: '0.6rem', border: '1px solid transparent', background: 'var(--bg-input)' }}
          />
        </div>
      </div>
      {/* ═══ 1. ACCOUNT CONNECTIONS ═══ */}
      <div className="panel-box" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div className="panel-header"><Link size={18} color="var(--text-muted)" /> Account Connections</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          {/* YouTube Connection */}
          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Play size={22} color="#ff0000" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>YouTube</span>
              <div style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600,
                background: activeCampaign.youtubeAccounts?.[0]?.tokens ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: activeCampaign.youtubeAccounts?.[0]?.tokens ? '#10b981' : '#ef4444'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeCampaign.youtubeAccounts?.[0]?.tokens ? '#10b981' : '#ef4444' }} />
                {activeCampaign.youtubeAccounts?.[0]?.tokens ? 'Connected' : 'Not Connected'}
              </div>
            </div>
            
            <div className="setting-item" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Target YouTube Channel Link</label>
              <input type="text" className="input-field" placeholder="Paste YouTube Channel URL here..." value={activeCampaign.youtubeLink || ''} onChange={e => updateActiveCampaign({ youtubeLink: e.target.value })} style={{ padding: '0.5rem', fontSize: '0.8rem' }} />
            </div>

            {(() => {
              const primaryConn = ytConnectionsData.find(c => c.index === 0);
              const hasPrimaryTokens = activeCampaign.youtubeAccounts?.[0]?.tokens;

              if (hasPrimaryTokens && primaryConn) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-panel)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                    {primaryConn.thumbnail ? <img src={primaryConn.thumbnail} alt="Channel" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border-color)' }} />}
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{primaryConn.channelName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {primaryConn.channelId || 'Unknown'}</div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginBottom: '0.75rem' }}>Not authenticated</p>
                );
              }
            })()}
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!activeCampaign.youtubeAccounts?.[0]?.tokens ? (
                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={() => setActiveNav('settings')}>
                  🔗 Connect YouTube
                </button>
              ) : (
                <>
                  <button className="btn-pill" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: 'var(--success)' }} onClick={() => fetchYouTubeProfiles(activeCampaign.youtubeAccounts)}>
                    <RefreshCw size={12} /> Re-check
                  </button>
                  <button className="btn-pill" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: 'var(--danger)' }} onClick={() => handleDisconnectYouTube(0)}>
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TikTok Connection */}
          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🎵</span>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>TikTok</span>
              <div style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600,
                background: tiktokConnection.connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: tiktokConnection.connected ? '#10b981' : '#ef4444'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: tiktokConnection.connected ? '#10b981' : '#ef4444' }} />
                {tiktokConnection.connected ? 'Connected' : 'Not Connected'}
              </div>
            </div>

            <div className="setting-item" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Source TikTok Profile Link</label>
              <input type="text" className="input-field" placeholder="Paste TikTok Profile URL here (@username)..." value={activeCampaign.tiktokUsername || ''} onChange={e => updateActiveCampaign(s => ({ ...s, tiktokUsername: e.target.value }))} style={{ padding: '0.5rem', fontSize: '0.8rem' }} />
            </div>

            {tiktokConnection.connected && tiktokConnection.profileInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-panel)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                {tiktokConnection.profileInfo.avatar ? <img src={tiktokConnection.profileInfo.avatar} alt="Profile" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border-color)' }} />}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{tiktokConnection.profileInfo.displayName}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tiktokConnection.profileInfo.username}</div>
                </div>
              </div>
            )}

            {tiktokConnection.message?.includes('using cookies') ? (
              <p style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                ✅ Cookies Fetched Successfully!
              </p>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {tiktokConnection.message || 'Load cookies.txt in API Settings to connect.'}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-pill" style={{ flex: 1, fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: 'var(--accent)' }} onClick={handleCheckTikTok} disabled={tiktokConnection.loading}>
                {tiktokConnection.loading ? <><RefreshCw size={12} className="spin" /> Checking...</> : '🔄 Check Connection'}
              </button>
              {tiktokConnection.connected && (
                <button className="btn-pill" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => {
                  updateActiveCampaign(s => ({ ...s, tiktokUsername: '' }));
                  setTiktokConnection({ connected: false, message: '', loading: false });
                }}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 2. SOURCE FOLDER TOGGLE ═══ */}
      <div className="panel-box" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div className="panel-header"><FolderOpen size={18} color="var(--text-muted)" /> Automation Source</div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="radio" name="automationSource" checked={activeCampaign.sourceType !== 'local_folder'} onChange={() => updateActiveCampaign({ sourceType: 'tiktok' })} style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: '0.9rem' }}>TikTok Profile</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="radio" name="automationSource" checked={activeCampaign.sourceType === 'local_folder'} onChange={() => updateActiveCampaign({ sourceType: 'local_folder' })} style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: '0.9rem' }}>Local Folder</span>
          </label>
        </div>

        {activeCampaign.sourceType === 'local_folder' && (
          <div className="setting-item" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Select Video Folder</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="input-field" placeholder="Select folder containing videos..." readOnly value={activeCampaign.localFolder || ''} />
              <button className="btn-pill" style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }} onClick={async () => {
                if (electron) {
                  const fp = await electron.ipcRenderer.invoke('dialog:openDirectory');
                  if (fp) updateActiveCampaign({ localFolder: fp });
                }
              }}>
                <FolderOpen size={14} /> Browse
              </button>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Videos will be automatically picked from here and moved to a "Done" folder once uploaded.</p>
          </div>
        )}
      </div>

      {/* ═══ 3. SCHEDULE PREVIEW CALENDAR ═══ */}
      <div className="panel-box" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={18} color="var(--text-muted)" /> Schedule Preview</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-pill" style={{ padding: '0.3rem', color: 'var(--text-muted)', minWidth: 'unset' }}
              onClick={() => setCalendarMonth(s => {
                const d = new Date(s.year, s.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', minWidth: '140px', textAlign: 'center' }}>
              {schedulePreview.monthName} {schedulePreview.year}
            </span>
            <button className="btn-pill" style={{ padding: '0.3rem', color: 'var(--text-muted)', minWidth: 'unset' }}
              onClick={() => setCalendarMonth(s => {
                const d = new Date(s.year, s.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Month Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '0.75rem', padding: '0.75rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{schedulePreview.totalPlanned}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Planned This Month</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', padding: '0.75rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{schedulePreview.totalUploaded}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Days Uploaded</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(56,189,248,0.04) 100%)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '0.75rem', padding: '0.75rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>{activeCampaign.videosPerDay}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Per Day</div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{ background: 'var(--bg-input)', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.3rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {Array.from({ length: schedulePreview.firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: '0.5rem' }} />
            ))}
            {schedulePreview.days.map(day => (
              <div key={day.day} style={{
                aspectRatio: '1',
                borderRadius: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                fontSize: '0.8rem',
                fontWeight: day.isToday ? 700 : 500,
                color: day.isPast && !day.isToday ? 'var(--text-muted)' : 'var(--text-main)',
                opacity: day.isPast && !day.isToday ? 0.4 : 1,
                background: day.isToday
                  ? 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(249,115,22,0.1) 100%)'
                  : day.hasUploads
                    ? 'rgba(16,185,129,0.08)'
                    : 'transparent',
                border: day.isToday ? '1.5px solid var(--accent)' : '1px solid transparent',
                cursor: 'default',
                transition: 'all 0.15s ease',
              }}>
                <span>{day.day}</span>
                {(day.plannedUploads.length > 0 || day.hasUploads) && (
                  <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                    {day.hasUploads && (
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                    )}
                    {day.plannedUploads.length > 0 && !day.hasUploads && (
                      <>
                        {day.plannedUploads.slice(0, 3).map((_, i) => (
                          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', opacity: 0.7 }} />
                        ))}
                        {day.plannedUploads.length > 3 && (
                          <span style={{ fontSize: '0.5rem', color: 'var(--accent)', lineHeight: 1, marginTop: '-1px' }}>+</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', opacity: 0.7 }} /> Planned
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Uploaded
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 14, height: 14, borderRadius: '3px', border: '1.5px solid var(--accent)', background: 'rgba(249,115,22,0.15)' }} /> Today
          </div>
        </div>
      </div>

      {/* ═══ 4. UPLOAD CONFIGURATION ═══ */}

          <div className="panel-box" style={{ marginBottom: '1.5rem' }}>
            <div className="panel-header"><Clock size={18} color="var(--text-muted)" /> Upload Configuration</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="setting-item" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Videos Per Day</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <input type="range" min={1} max={10} value={activeCampaign.videosPerDay} onChange={e => {
                    const num = parseInt(e.target.value);
                    updateActiveCampaign(s => {
                      const newTimes = [...s.uploadTimes];
                      if (num > newTimes.length) {
                        while (newTimes.length < num) newTimes.push('12:00');
                      } else if (num < newTimes.length) {
                        newTimes.length = num;
                      }
                      return { ...s, videosPerDay: num, uploadTimes: newTimes };
                    });
                  }} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem', minWidth: '2rem', textAlign: 'center' }}>{activeCampaign.videosPerDay}</span>
                </div>
                
                <div style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                  {activeCampaign.uploadTimes.map((time, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Upload {index + 1}</label>
                      <input type="time" className="input-field" style={{ padding: '0.4rem' }} value={time} onChange={e => {
                        const newTime = e.target.value;
                        updateActiveCampaign(s => {
                          const newTimes = [...s.uploadTimes];
                          newTimes[index] = newTime;
                          return { ...s, uploadTimes: newTimes };
                        });
                      }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="setting-item">
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Privacy</label>
                <select className="input-field" value={activeCampaign.privacy} onChange={e => updateActiveCampaign(s => ({ ...s, privacy: e.target.value }))}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>
            </div>

            <div className="setting-item" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Default Description</label>
              <textarea className="input-field" rows={2} placeholder="Default description for auto-uploaded videos..." style={{ resize: 'vertical' }} value={activeCampaign.defaultDescription} onChange={e => updateActiveCampaign(s => ({ ...s, defaultDescription: e.target.value }))} />
            </div>

            <div className="setting-item" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Default Tags (comma separated)</label>
              <input type="text" className="input-field" placeholder="e.g. shorts, viral, trending" value={activeCampaign.defaultTags} onChange={e => updateActiveCampaign(s => ({ ...s, defaultTags: e.target.value }))} />
            </div>

            {renderClipperSettings()}

            {/* Scheduler Status */}
            {schedulerStatus.isRunning && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Activity size={14} color="#10b981" />
                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Scheduler Running</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div>Uploaded Today: <strong style={{ color: 'var(--text-main)' }}>{schedulerStatus.videosUploadedToday || 0}</strong></div>
                  <div>Remaining: <strong style={{ color: 'var(--text-main)' }}>{schedulerStatus.videosRemaining || 0}</strong></div>
                  <div>Total: <strong style={{ color: 'var(--text-main)' }}>{schedulerStatus.totalUploaded || 0}</strong></div>
                </div>
                {schedulerStatus.nextUploadTime && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Next upload: {new Date(schedulerStatus.nextUploadTime).toLocaleTimeString()}</p>
                )}
              </div>
            )}

            {/* Scheduler Logs */}
            {schedulerLogs.length > 0 && (
              <div style={{ background: 'var(--bg-input)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', maxHeight: '120px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--success)' }}>
                {schedulerLogs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {!schedulerStatus.isRunning ? (
                <button className="btn-primary" style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  onClick={handleStartScheduler} disabled={ytConnectionsData.some(c => c.index === 0) === false}>
                  <Play size={16} fill="white" /> Start Auto Upload
                </button>
              ) : (
                <button className="btn-pill" style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={handleStopScheduler}>
                  <Pause size={16} /> Stop Scheduler
                </button>
              )}
              <button className="btn-pill" style={{ padding: '0.75rem', color: 'var(--text-muted)' }} onClick={refreshSchedulerStatus}>
                <RefreshCw size={16} />
              </button>
            </div>
            
            <button className="btn-pill" style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={handleForceUpload} disabled={schedulerStatus.forcing || ytConnectionsData.some(c => c.index === 0) === false || !tiktokConnection.connected}>
              {schedulerStatus.forcing ? <><RefreshCw size={16} className="spin" /> Forcing Upload...</> : <><Activity size={16} /> Force Upload Next Video</>}
            </button>
            {ytConnectionsData.some(c => c.index === 0) === false && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.5rem', textAlign: 'center' }}>⚠️ Connect YouTube account first</p>}
          </div>


      {/* ═══ 5. UPLOAD HISTORY ═══ */}
      <div className="panel-box">
        <div className="panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><History size={18} color="var(--text-muted)" /> Upload History</div>
          <span className="status-badge">{uploadHistory.length} uploads</span>
        </div>

        {uploadHistory.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>No uploads yet. Upload your first video above!</p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', fontWeight: 500 }}>Video</th>
                  <th style={{ padding: '0.5rem', fontWeight: 500 }}>YouTube URL</th>
                  <th style={{ padding: '0.5rem', fontWeight: 500 }}>Date</th>
                  <th style={{ padding: '0.5rem', fontWeight: 500 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...uploadHistory].filter(item => typeof item === 'object' && item.status).reverse().map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.sourcePath?.split(/[\\/]/).pop()}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <a href={item.videoUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.75rem' }}>{item.videoUrl}</a>
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(item.uploadedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ color: item.status === 'success' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{item.status === 'success' ? '✅' : '❌'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-layout">
      
      {/* LEFT SIDEBAR */}
      <div className="left-sidebar">
        <div className="brand">
          <Play fill="var(--accent)" color="var(--accent)" size={24} />
          <span>AutoRepost</span>
        </div>

        <div className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaigns</div>
          
          {(appSettings.campaigns || []).map(c => {
             const isRunning = allStatuses[c.id];
             return (
               <div key={c.id} className={`nav-item ${activeNav === 'automation' && activeCampaignId === c.id ? 'active' : ''}`} style={{ display: 'flex', flexDirection: 'column', padding: '0.6rem 1rem' }} onClick={() => {
                 setActiveNav('automation');
                 setActiveCampaignId(c.id);
               }}>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>{c.name}</span>
                   </div>
                   <button onClick={(e) => {
                      e.stopPropagation();
                      if(confirm(`Delete campaign "${c.name}"?`)) {
                        electron.ipcRenderer.invoke('scheduler:stop', c.id);
                        setAppSettings(s => {
                           const newCamps = s.campaigns.filter(x => x.id !== c.id);
                           const newSettings = { ...s, campaigns: newCamps };
                           if (electron) electron.ipcRenderer.invoke('settings:save', newSettings);
                           return newSettings;
                        });
                        if(activeCampaignId === c.id) {
                          const newActive = appSettings.campaigns.find(x => x.id !== c.id)?.id || 'default';
                          setActiveCampaignId(newActive);
                        }
                      }
                   }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center' }}>
                     <Trash2 size={14} />
                   </button>
                 </div>
                 {allCampaignHistory[c.id] && allCampaignHistory[c.id].length > 0 && (
                   <div style={{ padding: '0.2rem 0 0 1.2rem', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                     <History size={10} /> {allCampaignHistory[c.id].length} uploads
                   </div>
                 )}
               </div>
             );
          })}
          
          <div className="nav-item" onClick={() => {
            const newId = `c-${Date.now()}`;
            const name = `New Campaign ${Math.floor(Math.random() * 1000)}`;
            setAppSettings(s => {
              const newSettings = {
                ...s,
                campaigns: [...(s.campaigns || []), {
                  id: newId, name, youtubeAccounts: [], tiktokUsername: '', youtubeLink: '',
                  videosPerDay: 3, uploadTimes: ['08:00', '15:00', '20:00'], uploadPrivacy: 'public', defaultTitle: '', defaultDescription: 'Uploaded by AutoTube', defaultTags: ''
                }]
              };
              if (electron) electron.ipcRenderer.invoke('settings:save', newSettings);
              return newSettings;
            });
            setActiveCampaignId(newId);
            setActiveNav('automation');
          }} style={{ color: 'var(--accent)', justifyContent: 'center', fontWeight: 600, border: '1px dashed rgba(249,115,22,0.3)', margin: '0.5rem 1rem', padding: '0.5rem', background: 'transparent' }}>
            + Add Campaign
          </div>


          <div style={{ padding: '1rem 1rem 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>System</div>

          <div className={`nav-item ${activeNav === 'player' ? 'active' : ''}`} onClick={() => setActiveNav('player')}>
            <Play size={18} />
            Clipper AI Player
          </div>
          <div className={`nav-item ${activeNav === 'extractor' ? 'active' : ''}`} onClick={() => setActiveNav('extractor')}>
            <Scissors size={18} />
            Viral Highlight Extractor
          </div>
          <div className={`nav-item ${activeNav === 'console' ? 'active' : ''}`} onClick={() => setActiveNav('console')}>
            <Terminal size={18} /> Console
          </div>
          <div className={`nav-item ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => setActiveNav('settings')}>
            <KeyRound size={18} /> API Settings
          </div>
        </div>

        <div className="stats-grid" style={{ marginTop: 'auto' }}>
          <div className="stat-item">
            <h3>{uploadHistory.length}</h3>
            <p>Uploads</p>
          </div>
          <div className="stat-item">
            <h3>{schedulerStatus.isRunning ? 'ON' : 'OFF'}</h3>
            <p>Scheduler</p>
          </div>
        </div>



        <div className="export-folder" style={{ cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => {
          if (confirm('Are you sure you want to exit the application and stop all automation?')) {
            if (electron) electron.ipcRenderer.invoke('app:exit');
          }
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trash2 size={16} /> Exit App
          </span>
        </div>
      </div>

      {/* DYNAMIC CENTER/MAIN CONTENT */}
      <div className="center-column">
        {activeNav === 'automation' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1>Background Automation</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Setup automated YouTube uploading and scheduled runs.</p>
            </div>
            {renderAutomationContent()}
          </>
        )}


        
        
                {(activeNav === 'player' || activeNav === 'extractor') && (
          <div className="player-tab" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '4rem' }}>
            
            {/* Top Section: Dual Players */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: '400px' }}>
                {/* Left Player */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Original Source</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>16:9 Landscape</span>
                  </div>
                  {playerInputVideo ? (
                    <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <video 
                        ref={leftVideoRef}
                        src={`file:///${playerInputVideo.replace(/\\\\/g, '/')}`} 
                        controls 
                        style={{ width: '100%', maxHeight: '400px' }}
                      />
                    </div>
                  ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.1))', gap: '1.5rem', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', width: '200px', height: '200px', background: 'var(--brand-primary)', filter: 'blur(100px)', opacity: 0.2, borderRadius: '50%' }} />
                          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 1 }}>
                              <FolderOpen size={40} color="var(--brand-primary)" />
                          </div>
                          <div style={{ textAlign: 'center', zIndex: 1 }}>
                              <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.1rem' }}>No Source Selected</h3>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Upload a file or paste a YouTube/TikTok link below.</span>
                          </div>
                      </div>
                    )}
                </div>

                {/* Right Player (Carousel) */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'var(--brand-primary)', color: '#000', borderBottom: '1px solid var(--border-color)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>AI Generated Output</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {/* Aspect Ratio Buttons */}
                          {[{val:'9:16',label:'▯ Vertical',c:'#3b82f6'},{val:'1:1',label:'⬜ Square',c:'#ec4899'},{val:'16:9',label:'▭ Horizontal',c:'#8b5cf6'}].map(r => (
                            <button
                              key={r.val}
                              onClick={() => setAspectRatio(r.val)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.65rem',
                                  borderRadius: '4px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  background: aspectRatio === r.val ? r.c : 'rgba(0,0,0,0.2)',
                                  color: '#fff',
                                  outline: aspectRatio === r.val ? `2px solid ${r.c}` : 'none',
                                  outlineOffset: '2px',
                                  transition: 'all 0.2s'
                                }}
                            >{r.label}</button>
                          ))}
                          {/* Download Button */}
                          {(playerOutputVideo || (playerOutputVideos && playerOutputVideos.length > 0)) && (
                            <button
                              onClick={() => {
                                const vidPath = playerOutputVideos?.length > 0 ? playerOutputVideos[outputVideoIndex] : playerOutputVideo;
                                if (vidPath && electron) electron.ipcRenderer.invoke('shell:open', vidPath);
                              }}
                              style={{
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.65rem',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                                background: '#10b981',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
                                transition: 'all 0.2s'
                              }}
                            >
                              <Download size={12} /> Save
                            </button>
                          )}
                          {playerOutputVideos.length > 1 && (
                              <>
                                  <button onClick={() => setOutputVideoIndex(Math.max(0, outputVideoIndex - 1))} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 0.4rem' }}>&larr;</button>
                                  <span style={{ fontSize: '0.75rem' }}>{outputVideoIndex + 1} / {playerOutputVideos.length}</span>
                                  <button onClick={() => setOutputVideoIndex(Math.min(playerOutputVideos.length - 1, outputVideoIndex + 1))} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 0.4rem' }}>&rarr;</button>
                              </>
                          )}
                      </div>
                    </div>
                  {(() => {
                    if (playerOutputVideos.length > 0) {
                        const currentVideo = playerOutputVideos[outputVideoIndex];
                        return (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '1rem', gap: '1rem' }}>
                                <video 
                                    src={(currentVideo && currentVideo.startsWith('http')) ? currentVideo : (currentVideo ? `file:///${currentVideo.replace(/\\\\/g, '/')}` : '')} 
                                    controls 
                                    style={{ height: '100%', maxHeight: '340px', borderRadius: '0.5rem', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                                />
                            </div>
                        );
                    }
                    if (playerOutputVideo) {
                        return (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '1rem', gap: '1rem' }}>
                                <video 
                                    src={playerOutputVideo.startsWith('http') ? playerOutputVideo : `file:///${playerOutputVideo.replace(/\\\\/g, '/')}`} 
                                    controls 
                                    style={{ height: '100%', maxHeight: '340px', borderRadius: '0.5rem', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                                />
                            </div>
                        );
                    }
                    if (playerInputVideo && !isPlayerProcessing) {
                        const zoom = activeCampaign.clipperZoom !== undefined ? activeCampaign.clipperZoom : 1.0;
                        const cg = activeCampaign.clipperColorGrade || 'vibrant';
                        let f = '';
                        if (cg === 'vibrant') f += ' contrast(1.2) saturate(1.5)';
                        if (cg === 'teal_orange') f += ' hue-rotate(-15deg) saturate(1.3) contrast(1.1)';
                        if (cg === 'warm') f += ' sepia(0.3) saturate(1.2)';
                        if (cg === 'cool') f += ' hue-rotate(15deg) saturate(0.9) brightness(0.95)';
                        if (cg === 'vintage') f += ' sepia(0.5) contrast(0.8) brightness(1.1)';
                        f = f.trim() || 'none';
                        const theme = CAPTION_THEMES.find(t => t.id === (activeCampaign.clipperCaptionStyle || 'hormozi_green'));
                        // Map aspectRatio state to CSS aspect-ratio value
                        const previewAspect = aspectRatio === '16:9' ? '16/9' : aspectRatio === '1:1' ? '1/1' : '9/16';
                        const previewMaxH = aspectRatio === '16:9' ? '220px' : '380px';
                        const previewMaxW = aspectRatio === '16:9' ? '100%' : aspectRatio === '1:1' ? '220px' : '160px';
                        return (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 50%, #f59e0b 100%)', padding: '1rem', position: 'relative' }}>
                                <div style={{ maxHeight: previewMaxH, maxWidth: previewMaxW, width: '100%', aspectRatio: previewAspect, borderRadius: '0.5rem', overflow: 'hidden', position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.5)', background: '#000', transition: 'all 0.3s ease' }}>
                                    <video 
                                        src={`file:///${playerInputVideo.replace(/\\/g, '/')}`} 
                                        controls={false} autoPlay muted loop
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, filter: f, transition: 'all 0.3s ease' }}
                                    />
                                    {activeCampaign.clipperVignette !== false && (
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, boxShadow: 'inset 0 0 80px rgba(0,0,0,0.8)', pointerEvents: 'none' }}/>
                                    )}
                                    <div style={{ position: 'absolute', top: '70%', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                        {(activeCampaign.clipperCaptionStyle !== 'none' && theme) ? theme.render() : null}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,40,80,0.9)', color: '#fff', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 800 }}>LIVE PREVIEW</div>
                                <div style={{ position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#aaa', fontSize: '0.6rem', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700 }}>{aspectRatio}</div>
                            </div>
                        );
                    }


                    return (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(16,185,129,0.15))', gap: '1.5rem', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', width: '200px', height: '200px', background: '#10b981', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%' }} />
                            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 1 }}>
                                <Activity size={40} color="#10b981" />
                            </div>
                            <div style={{ textAlign: 'center', zIndex: 1 }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.1rem' }}>Ready for AI Processing</h3>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configure settings and run the pipeline</span>
                            </div>
                        </div>
                    );
                  })()}
                </div>
            </div>

            {/* Action Bar (Upload & Process) */}
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexWrap: 'wrap', gap: '1rem' }}>
               <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                 <button className="btn-pill" onClick={handlePlayerUpload} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><Upload size={18}/> Browse File</button>
               </div>
               
               <button 
                  className="btn-primary" 
                  style={{ 
                      fontSize: '1.05rem', padding: '0.8rem 2rem', borderRadius: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', 
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', 
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                      color: '#fff', fontWeight: 700, 
                      opacity: (!playerInputVideo || isPlayerProcessing) ? 0.5 : 1, transition: 'all 0.2s', border: 'none' 
                  }}
                  onClick={() => handlePlayerProcess()}
                  disabled={!playerInputVideo || isPlayerProcessing}
                >
                  {isPlayerProcessing ? <><RefreshCw size={18} className="spin" /> Generating Magic...</> : <><Scissors size={18} /> Run AI Processing</>}
                </button>
            </div>

              {/* Saved AI Clips Gallery */}
              {playerOutputVideos.length > 0 && (
                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Saved AI Clips</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                             <select className="input-field" value={scheduleCampaignId} onChange={e => setScheduleCampaignId(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.8rem', minWidth: '150px' }}>
                               <option value="">-- Select Campaign --</option>
                               {(appSettings.campaigns || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                             <input type="time" className="input-field" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.8rem', width: '100px' }} />
                             <button className="btn-primary" onClick={() => handleScheduleVideo(playerOutputVideos[outputVideoIndex])} style={{ padding: '0.4rem 1.5rem', fontSize: '0.85rem', background: '#10b981', border: 'none', color: '#fff' }}>
                                Confirm Schedule
                             </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {playerOutputVideos.map((video, idx) => (
                            <div key={idx} onClick={() => setOutputVideoIndex(idx)} style={{ width: '120px', flexShrink: 0, cursor: 'pointer', borderRadius: '0.5rem', overflow: 'hidden', border: outputVideoIndex === idx ? '2px solid var(--brand-primary)' : '2px solid transparent', opacity: outputVideoIndex === idx ? 1 : 0.6, transition: 'all 0.2s', background: '#000', position: 'relative' }}>
                                <video src={video.startsWith('http') ? video : `file:///${video.replace(/\\\\/g, '/')}`} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '0.4rem', fontSize: '0.65rem', textAlign: 'center', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>Clip {idx + 1}</div>
                            </div>
                        ))}
                    </div>
                </div>
              )}

            {/* AI Viral Highlight Extractor */}
            {activeNav === 'extractor' && (
            <div style={{ padding: '1.5rem', background: 'var(--bg-panel)', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 600 }}>AI Viral Highlight Extractor</h3>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Use Gemini 1.5 Pro to find the best hooks automatically.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clips to find:</span>
                            <input 
                                type="number" 
                                min="1" max="10" 
                                value={numClipsToExtract} 
                                onChange={e => setNumClipsToExtract(Number(e.target.value))}
                                style={{ width: '50px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.3rem', borderRadius: '0.5rem', textAlign: 'center' }}
                            />
                        </div>
                        <button 
                            className="btn-primary" 
                            onClick={handleExtractHighlights}
                            disabled={!playerInputVideo || isExtractingHighlights}
                            style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, opacity: (!playerInputVideo || isExtractingHighlights) ? 0.5 : 1 }}
                        >
                            {isExtractingHighlights ? 'Analyzing Video...' : 'Extract Viral Highlights'}
                        </button>
                        {extractedHighlights && extractedHighlights.length > 0 && (
                            <button 
                                className="btn-primary" 
                                onClick={handleProcessAllHighlights}
                                disabled={isProcessingAll}
                                style={{ background: 'var(--success)', color: '#000', fontWeight: 700, opacity: isProcessingAll ? 0.5 : 1 }}
                            >
                                {isProcessingAll ? 'Processing...' : 'Process All'}
                            </button>
                        )}
                    </div>
                </div>
                
                {extractedHighlights && (
                    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {extractedHighlights.map((hl, idx) => (
                            <div key={idx} style={{ minWidth: '280px', maxWidth: '320px', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{hl.title}</h4>
                                    <span style={{ background: '#22c55e', color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>{hl.viral_score}/100</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    {Math.floor(hl.start_time / 60)}:{(Math.floor(hl.start_time % 60)).toString().padStart(2, '0')} - {Math.floor(hl.end_time / 60)}:{(Math.floor(hl.end_time % 60)).toString().padStart(2, '0')}
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>{hl.reason}</p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handlePreviewHighlight(hl)} className="btn-pill" style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}>Preview</button>
                                    <button onClick={() => handleProcessHighlight(hl)} className="btn-primary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}>Clip & Process</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}

            {/* Settings */}
            {activeNav === 'player' && (
            <div style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 600 }}>Clipper Parameters</h3>
                {renderClipperSettings()}
            </div>
            )}
          </div>
        )}
{activeNav === 'clipping' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <iframe 
              src="http://127.0.0.1:8000" 
              style={{ flex: 1, border: 'none', borderRadius: '12px', background: 'var(--bg-panel)' }} 
              title="Clipping Tool"
            />
          </div>
        )}

        {activeNav === 'console' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1>Console Logs</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>View system execution logs.</p>
            </div>
            <div className="panel-box" style={{ fontFamily: 'monospace', color: 'var(--success)', backgroundColor: 'var(--bg-input)', padding: '1rem', minHeight: '300px', maxHeight: '500px', overflowY: 'auto' }}>
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </>
        )}

        {activeNav === 'settings' && (
          <>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>API & App Settings</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enter your keys once — they are saved locally and loaded automatically every time you start the app.</p>
              </div>
              <button
                className="btn-primary"
                onClick={handleSaveSettings}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: settingsSaved ? 'var(--success)' : undefined }}
              >
                {settingsSaved ? <><CheckCircle2 size={16}/> Saved!</> : <><ShieldCheck size={16}/> Save All Settings</>}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Gemini API */}
              <div className="panel-box settings-section">
                <div className="section-title"><KeyRound size={16} /> Google Gemini API</div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Used for AI script rewriting and video analysis. Get your key from <span style={{ color: 'var(--accent)' }}>aistudio.google.com</span>.</p>
                <div className="setting-item">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Gemini API Key</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="AIzaSy..."
                      value={appSettings.geminiKey}
                      onChange={e => {
                        setAppSettings(s => ({ ...s, geminiKey: e.target.value }));
                        setGeminiValidation(null);
                      }}
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn-pill" 
                      onClick={async () => {
                        setGeminiValidation('testing');
                        if (electron) {
                          const res = await electron.ipcRenderer.invoke('validate-gemini', appSettings.geminiKey);
                          setGeminiValidation(res.success ? 'valid' : 'invalid');
                        }
                      }}
                      disabled={!appSettings.geminiKey || geminiValidation === 'testing'}
                    >
                      {geminiValidation === 'testing' ? 'Testing...' : 'Verify Key'}
                    </button>
                  </div>
                </div>
                {geminiValidation === 'valid' && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={12}/> Key is valid and working!
                  </p>
                )}
                {geminiValidation === 'invalid' && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    ❌ Key is invalid or expired
                  </p>
                )}
                {!geminiValidation && appSettings.geminiKey && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Key entered (unverified)</p>
                )}
              </div>

              {/* YouTube OAuth Multiple Accounts */}
              <div className="panel-box settings-section">
                <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><Activity size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }}/> YouTube OAuth Credentials</div>
                  <button className="btn-pill" style={{ fontSize: '0.7rem' }} onClick={addYouTubeAccount}>+ Add Key</button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Multiple keys allow the scheduler to bypass daily upload limits by rotating accounts automatically. Get keys from <span style={{ color: 'var(--accent)' }}>console.cloud.google.com</span>.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(activeCampaign.youtubeAccounts || []).map((acc, index) => (
                    <div key={index} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                        <button className="btn-pill" style={{ color: 'var(--danger)', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => removeYouTubeAccount(index)}>Remove</button>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Key {index + 1} 
                        {acc.tokens ? <span style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 'normal', background: 'rgba(16,185,129,0.1)', padding: '0.1rem 0.4rem', borderRadius: '1rem' }}>Authenticated</span> : <span style={{ color: 'var(--danger)', fontSize: '0.7rem', fontWeight: 'normal', background: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.4rem', borderRadius: '1rem' }}>Not Authenticated</span>}
                      </div>

                      <div className="setting-item">
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client ID</label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="856105870023-xxxx.apps.googleusercontent.com"
                          value={acc.clientId || ''}
                          onChange={e => updateYouTubeAccount(index, 'clientId', e.target.value)}
                        />
                      </div>
                      <div className="setting-item" style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client Secret</label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="GOCSPX-..."
                          value={acc.clientSecret || ''}
                          onChange={e => updateYouTubeAccount(index, 'clientSecret', e.target.value)}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!acc.tokens ? (
                          <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }} onClick={() => handleConnectYouTube(index)} disabled={!acc.clientId || !acc.clientSecret}>
                            🔗 Authenticate Account
                          </button>
                        ) : (
                          <button className="btn-pill" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: 'var(--danger)' }} onClick={() => handleDisconnectYouTube(index)}>
                            Disconnect
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {(!activeCampaign.youtubeAccounts || activeCampaign.youtubeAccounts.length === 0) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No YouTube keys added yet.</div>
                  )}
                </div>
              </div>              {/* TikTok Cookies */}
              <div className="panel-box settings-section">
                <div className="section-title"><FileText size={16} /> TikTok Cookies</div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>To bypass downloads blocks, type the name of your browser (e.g., chrome, edge) or paste a cookies.txt file.</p>
                <div className="setting-item">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Browser Name OR Cookies text</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <textarea
                      className="input-field"
                      placeholder="Type: chrome, edge, firefox, brave, safari, opera... OR paste sessionid=..."
                      rows={3}
                      value={appSettings.ytdlpCookies}
                      onChange={e => {
                        setAppSettings(s => ({ ...s, ytdlpCookies: e.target.value }));
                        setCookieValidation(null);
                      }}
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn-pill" 
                      onClick={async () => {
                        setCookieValidation('testing');
                        if (electron) {
                          await electron.ipcRenderer.invoke('settings:save', appSettings);
                          const res = await electron.ipcRenderer.invoke('tiktok:check', 'https://www.tiktok.com/@tiktok');
                          setCookieValidation(res.connected ? 'valid' : 'invalid');
                        }
                      }}
                      disabled={!appSettings.ytdlpCookies || cookieValidation === 'testing'}
                    >
                      {cookieValidation === 'testing' ? 'Testing...' : 'Test Cookies'}
                    </button>
                  </div>
                </div>
                {cookieValidation === 'valid' && (
                  <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                    ✅ Cookies Verified Successfully!
                  </p>
                )}
                {cookieValidation === 'invalid' && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    ❌ Failed to verify cookies
                  </p>
                )}
                <label className="btn-pill" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <FolderOpen size={14} /> Load cookies file (.txt or .json)
                  <input type="file" accept=".txt,.json" style={{ display: 'none' }} onChange={async e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    let text = await file.text();
                    
                    if (file.name.endsWith('.json')) {
                      try {
                        const json = JSON.parse(text);
                        let netscape = "# Netscape HTTP Cookie File\n";
                        json.forEach(c => {
                          const domain = c.domain || '';
                          const incSub = domain.startsWith('.') ? 'TRUE' : 'FALSE';
                          const path = c.path || '/';
                          const sec = c.secure ? 'TRUE' : 'FALSE';
                          const exp = c.expirationDate ? Math.round(c.expirationDate) : 0;
                          netscape += `${domain}\t${incSub}\t${path}\t${sec}\t${exp}\t${c.name}\t${c.value}\n`;
                        });
                        text = netscape;
                      } catch(err) {
                        console.error('Failed to parse JSON', err);
                      }
                    }
                    
                    setAppSettings(s => ({ ...s, ytdlpCookies: text }));
                    setCookieValidation(null);
                  }} />
                </label>
              </div>

              {/* Export & Proxy */}
              <div className="panel-box settings-section">
                <div className="section-title"><FolderOpen size={16} /> Export & Network</div>
                <div className="setting-item">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Export Folder</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="C:\Users\...\Videos\Output"
                      value={appSettings.exportFolder}
                      readOnly
                    />
                    <button 
                      className="btn-pill" 
                      onClick={async () => {
                        if (electron) {
                          const dir = await electron.ipcRenderer.invoke('dialog:openDirectory');
                          if (dir) setAppSettings(s => ({ ...s, exportFolder: dir }));
                        }
                      }}
                    >
                      Browse Native Folder
                    </button>
                  </div>
                </div>
                <div className="setting-item">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload Proxy (Optional)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="http://ip:port:user:pass"
                    value={appSettings.uploadProxy}
                    onChange={e => setAppSettings(s => ({ ...s, uploadProxy: e.target.value }))}
                  />
                </div>
                <div className="setting-item">
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Default Upload Privacy</label>
                  <select
                    className="input-field"
                    value={appSettings.uploadPrivacy}
                    onChange={e => setAppSettings(s => ({ ...s, uploadPrivacy: e.target.value }))}
                  >
                    <option value="public">Public (Immediate)</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              {/* App Updates */}
              <div className="panel-box settings-section">
                <div className="section-title"><FolderOpen size={16} /> Software Updates</div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Check for and download the latest over-the-air updates for AutoTube.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {!updateState.available && !updateState.downloaded && (
                    <button 
                      className="btn-primary" 
                      onClick={handleCheckUpdate}
                      disabled={updateState.checking}
                    >
                      {updateState.checking ? 'Checking for updates...' : 'Check for Updates'}
                    </button>
                  )}

                  {updateState.available && !updateState.downloaded && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                       <p style={{ color: 'var(--success)' }}>A new update is available!</p>
                       {updateState.downloading ? (
                         <div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                             <span>Downloading...</span>
                             <span>{Math.round(updateState.progress || 0)}%</span>
                           </div>
                           <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                             <div style={{ width: `${updateState.progress || 0}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 0.2s' }} />
                           </div>
                         </div>
                       ) : (
                         <button 
                           className="btn-primary" 
                           onClick={() => {
                             setUpdateState(s => ({ ...s, downloading: true }));
                             handleDownloadUpdate();
                           }}
                         >
                            Download Update
                         </button>
                       )}
                       {updateState.progress > 0 && (
                          <div style={{ background: '#333', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                             <div style={{ background: 'var(--success)', height: '100%', width: `${updateState.progress}%` }}></div>
                          </div>
                       )}
                     </div>
                  )}

                  {updateState.downloaded && (
                    <button className="btn-primary" style={{ background: 'var(--success)' }} onClick={handleInstallUpdate}>
                      Restart and Install Update
                    </button>
                  )}

                  {updateState.error && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{updateState.error}</p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(249,115,22,0.05)', border: '1px solid var(--accent-soft)', borderRadius: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                🔒 All keys are stored <strong style={{ color: 'var(--text)' }}>locally on your computer only</strong> using Electron's secure config store. They are never sent anywhere except the APIs you configure above.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
