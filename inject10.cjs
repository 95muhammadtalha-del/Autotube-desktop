const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Sidebar Nav
const oldSidebar = `
          <div className={\`nav-item \${activeNav === 'player' ? 'active' : ''}\`} onClick={() => setActiveNav('player')}>
            <Play size={18} />
            Clipper Player
          </div>
          <div className={\`nav-item \${activeNav === 'clipping' ? 'active' : ''}\`} onClick={() => setActiveNav('clipping')}>
            <Scissors size={18} /> Clipping
          </div>`;

const newSidebar = `
          <div className={\`nav-item \${activeNav === 'clipping' ? 'active' : ''}\`} onClick={() => setActiveNav('clipping')}>
            <Scissors size={18} /> Clipping
          </div>
          <div className={\`nav-item \${activeNav === 'extractor' ? 'active' : ''}\`} onClick={() => setActiveNav('extractor')}>
            <Activity size={18} /> Viral Highlight Extractor
          </div>
          <div className={\`nav-item \${activeNav === 'player' ? 'active' : ''}\`} onClick={() => setActiveNav('player')}>
            <Play size={18} />
            Clipper AI Player
          </div>`;

if (code.includes('Clipper Player')) {
    code = code.replace(oldSidebar, newSidebar);
}

// 2. Wrap the player UI
const oldTabStart = "{activeNav === 'player' && (";
const newTabStart = "{(activeNav === 'player' || activeNav === 'extractor') && (";
if (code.includes(oldTabStart)) {
    code = code.replace(oldTabStart, newTabStart);
}

// 3. Conditional Extractor Panel
const extractorStart = "{/* AI Viral Highlight Extractor */}";
const extractorPanelStr = `            {/* AI Viral Highlight Extractor */}
            {activeNav === 'extractor' && (
            <div style={{ padding: '1.5rem', background: 'var(--bg-panel)', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>`;

// We need to find the `div` start right after `AI Viral Highlight Extractor`
// It currently is:
//             {/* AI Viral Highlight Extractor */}
//             <div style={{ padding: '1.5rem', background: 'var(--bg-panel)'...
if (code.includes(extractorStart)) {
    code = code.replace(
        `{/* AI Viral Highlight Extractor */}
            <div style={{ padding: '1.5rem'`,
        `{/* AI Viral Highlight Extractor */}
            {activeNav === 'extractor' && (
            <div style={{ padding: '1.5rem'`
    );
    // Find the end of this div... it's right before `{/* Settings */}`
    code = code.replace(
        `                )}
            </div>

            {/* Settings */}`,
        `                )}
            </div>
            )}

            {/* Settings */}`
    );
}

// 4. Conditional Settings Panel
const settingsStart = "{/* Settings */}";
if (code.includes(settingsStart)) {
    code = code.replace(
        `{/* Settings */}
            <div style={{ marginTop: '1rem' }}>`,
        `{/* Settings */}
            {activeNav === 'player' && (
            <div style={{ marginTop: '1rem' }}>`
    );
    // End of settings is `</div>` right before `</div>` right before `)}`
    code = code.replace(
        `                {renderClipperSettings()}
            </div>
          </div>
        )}`,
        `                {renderClipperSettings()}
            </div>
            )}
          </div>
        )}`
    );
}

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx sidebar updated');
