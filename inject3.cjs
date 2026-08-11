const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const tabStartStr = "{activeNav === 'player' && (";
const tabEndStr = "{activeNav === 'clipping' && (";
const idxStartTab = code.indexOf(tabStartStr);
const idxEndTab = code.indexOf(tabEndStr);

if (idxStartTab !== -1 && idxEndTab !== -1) {
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
                        src={\`file:///\${playerInputVideo.replace(/\\\\\\\\/g, '/')}\`} 
                        controls 
                        style={{ width: '100%', maxHeight: '400px' }}
                      />
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', gap: '1rem' }}>
                      <FolderOpen size={48} opacity={0.5} />
                      <span>No source video selected</span>
                      <button className="btn-primary" onClick={handlePlayerUpload} style={{ marginTop: '0.5rem' }}>Browse Video</button>
                    </div>
                  )}
                </div>

                {/* Right Player */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'var(--brand-primary)', color: '#000', borderBottom: '1px solid var(--border-color)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>AI Generated Output</span>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>9:16 Vertical</span>
                  </div>
                  {(() => {
                    if (playerOutputVideo) {
                        return (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '1rem' }}>
                                <video 
                                    src={\`file:///\${playerOutputVideo.replace(/\\\\\\\\/g, '/')}\`} 
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

            {/* Action Bar */}
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '1rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 <button className="btn-pill" onClick={handlePlayerUpload} style={{ background: 'rgba(255,255,255,0.05)' }}><Upload size={16}/> Change Video</button>
                 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {playerInputVideo || 'Waiting for upload...'}
                 </span>
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
                  onClick={handlePlayerProcess}
                  disabled={!playerInputVideo || isPlayerProcessing}
                >
                  {isPlayerProcessing ? <><RefreshCw size={18} className="spin" /> Generating Magic...</> : <><Scissors size={18} /> Run AI Processing</>}
                </button>
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
    console.log('Successfully updated player block');
} else {
    console.log('Could not find player block');
}
