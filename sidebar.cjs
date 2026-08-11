const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add Trash2 to imports
content = content.replace(/import \{/, 'import {\\n  Trash2,');

// 2. Add allStatuses state and effect
content = content.replace(
  /const \[schedulerLogs, setSchedulerLogs\] = useState\(\[\]\);/,
  `const [schedulerLogs, setSchedulerLogs] = useState([]);
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
  }, []);`
);

// 3. Replace Sidebar nav-menu
content = content.replace(
  /<div className="nav-menu">[\s\S]*?<div className="stats-grid" style=\{\{ marginTop: 'auto' \}\}>/,
  `<div className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaigns</div>
          
          {(appSettings.campaigns || []).map(c => {
             const isRunning = allStatuses[c.id];
             return (
               <div key={c.id} className={\`nav-item \${activeNav === 'automation' && activeCampaignId === c.id ? 'active' : ''}\`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem' }} onClick={() => {
                 setActiveNav('automation');
                 setActiveCampaignId(c.id);
               }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>{c.name}</span>
                 </div>
                 <button onClick={(e) => {
                    e.stopPropagation();
                    if(confirm(\`Delete campaign "\${c.name}"?\`)) {
                      electron.ipcRenderer.invoke('scheduler:stop', c.id);
                      setAppSettings(s => {
                         const newCamps = s.campaigns.filter(x => x.id !== c.id);
                         return { ...s, campaigns: newCamps };
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
             );
          })}
          
          <div className="nav-item" onClick={() => {
            const newId = \`c-\${Date.now()}\`;
            const name = \`New Campaign \${Math.floor(Math.random() * 1000)}\`;
            setAppSettings(s => ({
              ...s,
              campaigns: [...(s.campaigns || []), {
                id: newId, name, youtubeAccounts: [], tiktokUsername: '', youtubeLink: '',
                videosPerDay: 3, uploadTimes: ['08:00', '15:00', '20:00'], uploadPrivacy: 'public', defaultTitle: '', defaultDescription: 'Uploaded by AutoTube', defaultTags: ''
              }]
            }));
            setActiveCampaignId(newId);
            setActiveNav('automation');
          }} style={{ color: 'var(--accent)', justifyContent: 'center', fontWeight: 600, border: '1px dashed rgba(249,115,22,0.3)', margin: '0.5rem 1rem', padding: '0.5rem', background: 'transparent' }}>
            + Add Campaign
          </div>

          <div style={{ padding: '1rem 1rem 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>System</div>
          <div className={\`nav-item \${activeNav === 'console' ? 'active' : ''}\`} onClick={() => setActiveNav('console')}>
            <Terminal size={18} /> Console
          </div>
          <div className={\`nav-item \${activeNav === 'settings' ? 'active' : ''}\`} onClick={() => setActiveNav('settings')}>
            <KeyRound size={18} /> API Settings
          </div>
        </div>

        <div className="stats-grid" style={{ marginTop: 'auto' }}>`
);

// 4. Transform the old Campaign Selector in Automation tab into just the "Rename Campaign" block
content = content.replace(
  /<div className="panel-box" style=\{\{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' \}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  `<div className="panel-box" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
      </div>`
);

fs.writeFileSync('src/App.jsx', content);
