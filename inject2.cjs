const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const targetStart = "{activeNav === 'player' && (";
const targetEnd = "{activeNav === 'clipping' && (";

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const newPlayerCode = `        {activeNav === 'player' && (
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
                        onPlay={() => handleVideoSync(leftVideoRef, rightVideoRef)}
                        onPause={() => handleVideoSync(leftVideoRef, rightVideoRef)}
                        onSeeked={() => handleVideoSync(leftVideoRef, rightVideoRef)}
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
                  {playerOutputVideo ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '1rem' }}>
                      <video 
                        ref={rightVideoRef} 
                        src={\`file:///\${playerOutputVideo.replace(/\\\\\\\\/g, '/')}\`} 
                        controls 
                        style={{ height: '100%', maxHeight: '380px', borderRadius: '0.5rem', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                        onPlay={() => handleVideoSync(rightVideoRef, leftVideoRef)}
                        onPause={() => handleVideoSync(rightVideoRef, leftVideoRef)}
                        onSeeked={() => handleVideoSync(rightVideoRef, leftVideoRef)}
                      />
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', gap: '1rem' }}>
                      <Activity size={48} opacity={0.5} />
                      <span>Ready for AI Processing</span>
                    </div>
                  )}
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
                  style={{ fontSize: '1.05rem', padding: '0.8rem 2rem', borderRadius: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--brand-primary)', color: '#000', fontWeight: 700, opacity: (!playerInputVideo || isPlayerProcessing) ? 0.5 : 1, transition: 'all 0.2s' }}
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

    code = code.substring(0, startIndex) + newPlayerCode + code.substring(endIndex);
    fs.writeFileSync('src/App.jsx', code);
    console.log('Successfully updated player layout.');
} else {
    console.log('Could not find player section.');
}
