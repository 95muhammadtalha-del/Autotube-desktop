const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Update States
code = code.replace(
    "const [playerOutputVideo, setPlayerOutputVideo] = useState(null);",
    "const [playerOutputVideos, setPlayerOutputVideos] = useState([]);\n  const [outputVideoIndex, setOutputVideoIndex] = useState(0);\n  const [playerOutputVideo, setPlayerOutputVideo] = useState(null); // Keep for compatibility if needed\n  const [urlInput, setUrlInput] = useState('');\n  const [isDownloading, setIsDownloading] = useState(false);\n  const [numClipsToExtract, setNumClipsToExtract] = useState(3);\n  const [isProcessingAll, setIsProcessingAll] = useState(false);"
);

// Update URL download handler
if (!code.includes('const handleUrlDownload')) {
    const handlers = `
  const handleUrlDownload = async () => {
    if (!urlInput) return;
    setIsDownloading(true);
    try {
        const result = await window.ipcRenderer.invoke('clipper:download_url', urlInput);
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
`;
    code = code.replace(
        "const handlePlayerUpload = async () => {",
        handlers + "\n  const handlePlayerUpload = async () => {"
    );
}

// Update extract highlights to pass numClips
code = code.replace(
    "await window.ipcRenderer.invoke('clipper:extract_highlights', playerInputVideo);",
    "await window.ipcRenderer.invoke('clipper:extract_highlights', playerInputVideo, numClipsToExtract);"
);

// We need to modify `handlePlayerProcess` to push to `playerOutputVideos` instead of overwriting `playerOutputVideo`.
// Let's find handlePlayerProcess.
// Wait, in `handlePlayerProcess`, there's a loop that sets the video url: `setPlayerOutputVideo(result.url);`.
code = code.replace(
    "setPlayerOutputVideo(result.url);",
    "setPlayerOutputVideo(result.url);\n                setPlayerOutputVideos(prev => [...prev, result.url]);"
);

// Now for the massive player-tab replacement.
// We will replace everything from `{activeNav === 'player' && (` to `{activeNav === 'clipping' && (`
const tabStartStr = "{activeNav === 'player' && (";
const tabEndStr = "{activeNav === 'clipping' && (";
const idxStartTab = code.indexOf(tabStartStr);
const idxEndTab = code.indexOf(tabEndStr);

const newTabCode = `{activeNav === 'player' && (
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
                        src={\`file:///\${playerInputVideo.replace(/\\\\\\\\/g, '/')}\`} 
                        controls 
                        style={{ width: '100%', maxHeight: '400px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', gap: '1rem', padding: '2rem' }}>
                      <FolderOpen size={48} opacity={0.5} />
                      <span style={{textAlign: 'center'}}>No source video selected.<br/>Upload a file or paste a YouTube/TikTok link below.</span>
                    </div>
                  )}
                </div>

                {/* Right Player (Carousel) */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'var(--brand-primary)', color: '#000', borderBottom: '1px solid var(--border-color)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>AI Generated Output</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {playerOutputVideos.length > 1 && (
                            <>
                                <button onClick={() => setOutputVideoIndex(Math.max(0, outputVideoIndex - 1))} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 0.4rem' }}>&larr;</button>
                                <span style={{ fontSize: '0.75rem' }}>{outputVideoIndex + 1} / {playerOutputVideos.length}</span>
                                <button onClick={() => setOutputVideoIndex(Math.min(playerOutputVideos.length - 1, outputVideoIndex + 1))} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 0.4rem' }}>&rarr;</button>
                            </>
                        )}
                        <span style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>9:16 Vertical</span>
                    </div>
                  </div>
                  {(() => {
                    if (playerOutputVideos.length > 0) {
                        const currentVideo = playerOutputVideos[outputVideoIndex];
                        return (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '1rem' }}>
                                <video 
                                    src={(currentVideo && currentVideo.startsWith('http')) ? currentVideo : (currentVideo ? \`file:///\${currentVideo.replace(/\\\\\\\\/g, '/')}\` : '')} 
                                    controls 
                                    style={{ height: '100%', maxHeight: '380px', borderRadius: '0.5rem', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                                />
                            </div>
                        );
                    }
                    if (playerOutputVideo) {
                        return (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '1rem' }}>
                                <video 
                                    src={playerOutputVideo.startsWith('http') ? playerOutputVideo : \`file:///\${playerOutputVideo.replace(/\\\\\\\\/g, '/')}\`} 
                                    controls 
                                    style={{ height: '100%', maxHeight: '380px', borderRadius: '0.5rem', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
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
                        return (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', padding: '1rem', position: 'relative' }}>
                                <div style={{ height: '100%', maxHeight: '380px', aspectRatio: '9/16', borderRadius: '0.5rem', overflow: 'hidden', position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.5)', background: '#000' }}>
                                    <video 
                                        src={\`file:///\${playerInputVideo.replace(/\\\\\\\\/g, '/')}\`} 
                                        controls={false} autoPlay muted loop
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: \`scale(\${zoom})\`, filter: f, transition: 'all 0.3s ease' }}
                                    />
                                    {activeCampaign.clipperVignette !== false && (
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, boxShadow: 'inset 0 0 80px rgba(0,0,0,0.8)', pointerEvents: 'none' }}/>
                                    )}
                                    <div style={{ position: 'absolute', top: '70%', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                                        {theme ? theme.render() : null}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,40,80,0.9)', color: '#fff', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 800 }}>LIVE PREVIEW</div>
                            </div>
                        );
                    }
                    return (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', gap: '1rem' }}>
                            <Activity size={48} opacity={0.5} />
                            <span>Ready for AI Processing</span>
                        </div>
                    );
                  })()}
                </div>
            </div>

            {/* Action Bar (Upload & Process) */}
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexWrap: 'wrap', gap: '1rem' }}>
               <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                 <input 
                    type="text" 
                    placeholder="Paste YouTube or TikTok URL..." 
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    style={{ flex: 1, maxWidth: '300px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.6rem 1rem', borderRadius: '2rem', fontSize: '0.85rem' }}
                 />
                 <button className="btn-pill" onClick={handleUrlDownload} disabled={isDownloading || !urlInput} style={{ background: 'rgba(255,255,255,0.1)' }}>
                    {isDownloading ? 'Downloading...' : 'Load URL'}
                 </button>
                 <span style={{ margin: '0 0.5rem', color: 'var(--text-muted)' }}>OR</span>
                 <button className="btn-pill" onClick={handlePlayerUpload} style={{ background: 'rgba(255,255,255,0.05)' }}><Upload size={16}/> Browse File</button>
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

            {/* AI Viral Highlight Extractor */}
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

            {/* Settings */}
            <div style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 600 }}>Clipper Parameters</h3>
                {renderClipperSettings()}
            </div>
          </div>
        )}
`;

code = code.substring(0, idxStartTab) + newTabCode + code.substring(idxEndTab);
fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx modified');
