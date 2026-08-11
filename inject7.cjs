const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Add state variables for highlights
if (!code.includes('const [extractedHighlights')) {
    code = code.replace(
        "const [playerOutputVideo, setPlayerOutputVideo] = useState(null);",
        "const [playerOutputVideo, setPlayerOutputVideo] = useState(null);\n  const [extractedHighlights, setExtractedHighlights] = useState(null);\n  const [isExtractingHighlights, setIsExtractingHighlights] = useState(false);\n"
    );
}

// Add handleExtractHighlights
if (!code.includes('const handleExtractHighlights =')) {
    const fn = `
  const handleExtractHighlights = async () => {
    if (!playerInputVideo) return;
    setIsExtractingHighlights(true);
    setExtractedHighlights(null);
    try {
        const result = await window.ipcRenderer.invoke('clipper:extract_highlights', playerInputVideo);
        if (result.success) {
            setExtractedHighlights(result.data);
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
`;
    code = code.replace(
        "const handlePlayerUpload = async () => {",
        fn + "\n  const handlePlayerUpload = async () => {"
    );
}

// We need to pass overrideParams to handlePlayerProcess if provided
if (code.includes('const handlePlayerProcess = async () => {') && !code.includes('overrideParams')) {
    code = code.replace(
        "const handlePlayerProcess = async () => {",
        "const handlePlayerProcess = async (overrideParams = {}) => {"
    );
    code = code.replace(
        "const options = {",
        "const options = { ...overrideParams,"
    );
}

// We need to pass the options to clipper:process_single. Wait, let's look at process_single
// We don't have to change process_single if it just passes options directly to python
// But let's check `App.jsx` handlePlayerProcess to ensure it merges overrides correctly.

// UI for Viral Highlights Extraction
const uiCode = `
            {/* AI Viral Highlight Extractor */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-panel)', borderRadius: '1rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 600 }}>AI Viral Highlight Extractor</h3>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Use Gemini 1.5 Pro to find the best 30-60s hooks in your video automatically.</p>
                    </div>
                    <button 
                        className="btn-primary" 
                        onClick={handleExtractHighlights}
                        disabled={!playerInputVideo || isExtractingHighlights}
                        style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, opacity: (!playerInputVideo || isExtractingHighlights) ? 0.5 : 1 }}
                    >
                        {isExtractingHighlights ? 'Analyzing Video...' : 'Extract Viral Highlights'}
                    </button>
                </div>
                
                {extractedHighlights && (
                    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {extractedHighlights.map((hl, idx) => (
                            <div key={idx} style={{ minWidth: '280px', maxWidth: '320px', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
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
`;

if (code.includes("{/* Settings */}")) {
    code = code.replace("{/* Settings */}", uiCode);
    fs.writeFileSync('src/App.jsx', code);
    console.log('Injected UI');
} else {
    console.log('Could not find settings block');
}
