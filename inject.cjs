const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Insert State variables right after 'const [calendarMonth'
const stateInsertCode = `
  // ── Clipper AI Player State ─────────────────────────────────────────────
  const [playerInputVideo, setPlayerInputVideo] = useState(null);
  const [playerOutputVideo, setPlayerOutputVideo] = useState(null);
  const [isPlayerProcessing, setIsPlayerProcessing] = useState(false);
  const leftVideoRef = useRef(null);
  const rightVideoRef = useRef(null);

  const handlePlayerUpload = async () => {
    if (electron) {
      const filePath = await electron.ipcRenderer.invoke('dialog:openFile');
      if (filePath) {
        setPlayerInputVideo(filePath);
        setPlayerOutputVideo(null);
      }
    }
  };

  const handlePlayerProcess = async () => {
    if (!playerInputVideo) return;
    setIsPlayerProcessing(true);
    setLogs(prev => [...prev, '> Starting Clipper AI on ' + playerInputVideo + '...']);
    
    if (electron) {
      const res = await electron.ipcRenderer.invoke('clipper:process_single', {
        videoPath: playerInputVideo,
        config: activeCampaign
      });
      
      if (res.success) {
        setPlayerOutputVideo(res.outputPath);
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
`;

const stateTarget = 'const [calendarMonth, setCalendarMonth] = useState(() => {';
let idx = code.indexOf(stateTarget);
if (idx !== -1) {
    code = code.substring(0, idx) + stateInsertCode + '\n  ' + code.substring(idx);
    console.log('Inserted Player State');
}

// 2. Insert Nav item
const clippingNavTarget = '          <div className={`nav-item ${activeNav === \'clipping\' ? \'active\' : \'\'}`} onClick={() => setActiveNav(\'clipping\')}>';
const playerNavCode = `
          <div className={\`nav-item \${activeNav === 'player' ? 'active' : ''}\`} onClick={() => setActiveNav('player')}>
            <Play size={18} />
            Clipper Player
          </div>
`;
idx = code.indexOf(clippingNavTarget);
if (idx !== -1) {
    code = code.substring(0, idx) + playerNavCode + code.substring(idx);
    console.log('Inserted Nav Item');
}

// 3. Insert the page content rendering
const renderTarget = '{activeNav === \'clipping\' && (';
const playerPageCode = `
        {activeNav === 'player' && (
          <div className="player-tab" style={{ paddingBottom: '4rem' }}>
            <div className="panel-box" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
               <div className="panel-header"><Upload size={18} color="var(--text-muted)" /> Select Video</div>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 <button className="btn-primary" onClick={handlePlayerUpload}>Browse Local Video...</button>
                 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {playerInputVideo || 'No video selected'}
                 </span>
               </div>
            </div>

            {renderClipperSettings()}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
              <button 
                className="btn-primary" 
                style={{ fontSize: '1.1rem', padding: '1rem 3rem', borderRadius: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--brand-primary)', color: '#000' }}
                onClick={handlePlayerProcess}
                disabled={!playerInputVideo || isPlayerProcessing}
              >
                {isPlayerProcessing ? <><RefreshCw size={20} className="spin" /> Processing AI...</> : <><Scissors size={20} /> Run Clipper AI</>}
              </button>
            </div>

            {(playerInputVideo || playerOutputVideo) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, textAlign: 'center' }}>Original Video</div>
                  {playerInputVideo ? (
                    <video 
                      ref={leftVideoRef} 
                      src={\`file://\${playerInputVideo}\`} 
                      controls 
                      style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
                      onPlay={() => handleVideoSync(leftVideoRef, rightVideoRef)}
                      onPause={() => handleVideoSync(leftVideoRef, rightVideoRef)}
                      onSeeked={() => handleVideoSync(leftVideoRef, rightVideoRef)}
                    />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No Original</div>
                  )}
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--brand-primary)', color: '#000', borderBottom: '1px solid var(--border-color)', fontWeight: 600, textAlign: 'center' }}>AI Edited Video (9:16)</div>
                  {playerOutputVideo ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                      <video 
                        ref={rightVideoRef} 
                        src={\`file://\${playerOutputVideo}\`} 
                        controls 
                        style={{ height: '400px', aspectRatio: '9/16', background: '#000' }}
                        onPlay={() => handleVideoSync(rightVideoRef, leftVideoRef)}
                        onPause={() => handleVideoSync(rightVideoRef, leftVideoRef)}
                        onSeeked={() => handleVideoSync(rightVideoRef, leftVideoRef)}
                      />
                    </div>
                  ) : (
                    <div style={{ height: '400px', aspectRatio: '9/16', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Processing Required</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
`;
idx = code.indexOf(renderTarget);
if (idx !== -1) {
    code = code.substring(0, idx) + playerPageCode + code.substring(idx);
    console.log('Inserted Player Page UI');
}

fs.writeFileSync('src/App.jsx', code);
