const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. State Refactoring
content = content.replace(
  /const \[autoConfig, setAutoConfig\] = useState\(\{[\s\S]*?\}\);/,
  `const [activeCampaignId, setActiveCampaignId] = useState('default');
  
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
      return { ...s, campaigns: camps };
    });
  };`
);

// 2. Initialization & Listeners
content = content.replace(
  /electron\.ipcRenderer\.invoke\('settings:load'\)\.then\(saved => \{[\s\S]*?\}\);/,
  `electron.ipcRenderer.invoke('settings:load').then(saved => {
        if (saved) {
          setAppSettings(s => ({ ...s, ...saved }));
          const firstCampaignId = saved.campaigns?.[0]?.id || 'default';
          setActiveCampaignId(firstCampaignId);
          fetchYouTubeProfiles(firstCampaignId, saved.campaigns?.find(c => c.id === firstCampaignId)?.youtubeAccounts);
        }
      });`
);

content = content.replace(
  /const fetchYouTubeProfiles = async \(accounts\) => \{[\s\S]*?setYtConnectionsData\(connections\);\n  \};/,
  `const fetchYouTubeProfiles = async (campaignId, accounts) => {
    if (!electron || !accounts) return;
    const connections = [];
    for (let i = 0; i < accounts.length; i++) {
      if (accounts[i].tokens) {
        const res = await electron.ipcRenderer.invoke('youtube:check', { campaignId, accountIndex: i });
        connections.push({ index: i, ...res });
      }
    }
    setYtConnectionsData(connections);
  };`
);

content = content.replace(
  /useEffect\(\(\) => \{\n    if \(activeNav === 'automation'\) \{[\s\S]*?\}\n  \}, \[activeNav\]\);/,
  `useEffect(() => {
    if (activeNav === 'automation' || activeNav === 'settings') {
      fetchYouTubeProfiles(activeCampaignId, activeCampaign.youtubeAccounts);
      handleCheckTikTok();
      loadUploadHistory();
      refreshSchedulerStatus();
    }
  }, [activeNav, activeCampaignId, activeCampaign.youtubeAccounts]);`
);

// Update scheduler logs
content = content.replace(
  /electron\.ipcRenderer\.on\('scheduler-log', \(event, msg\) => \{[\s\S]*?\}\);/,
  `const channel = \`scheduler-log-\${activeCampaignId}\`;
      const handler = (event, msg) => {
        setSchedulerLogs(prev => [...prev.slice(-50), msg]);
        setLogs(prev => [...prev, \`[Scheduler] \${msg}\`]);
      };
      electron.ipcRenderer.on(channel, handler);
      return () => {
        electron.ipcRenderer.removeListener(channel, handler);
      };`
);

// Add Campaign Selector
content = content.replace(
  /<div className="automation-setup" style=\{\{ paddingBottom: '4rem' \}\}>/,
  `<div className="automation-setup" style={{ paddingBottom: '4rem' }}>
      {/* ═══ CAMPAIGN SELECTOR ═══ */}
      <div className="panel-box" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Active Campaign</label>
          <select 
            className="input-field" 
            value={activeCampaignId} 
            onChange={(e) => setActiveCampaignId(e.target.value)}
          >
            {(appSettings.campaigns || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: '1.15rem' }}>
          <button className="btn-primary" onClick={() => {
            const name = prompt('Enter new campaign name:');
            if (name) {
              const newId = \`c-\${Date.now()}\`;
              setAppSettings(s => ({
                ...s,
                campaigns: [...(s.campaigns || []), {
                  id: newId, name, youtubeAccounts: [], tiktokUsername: '', youtubeLink: '',
                  videosPerDay: 3, uploadTimes: ['08:00', '15:00', '20:00'], uploadPrivacy: 'public', defaultTitle: '', defaultDescription: 'Uploaded by AutoTube', defaultTags: ''
                }]
              }));
              setActiveCampaignId(newId);
            }
          }}>+ New Campaign</button>
        </div>
      </div>`
);

// Mass replacements
content = content.replace(/autoConfig/g, 'activeCampaign');
content = content.replace(/setAutoConfig/g, 'updateActiveCampaign');
content = content.replace(/appSettings\.youtubeAccounts/g, 'activeCampaign.youtubeAccounts');
content = content.replace(/fetchYouTubeProfiles\(saved\.youtubeAccounts\)/g, '// handled in hook');
content = content.replace(/fetchYouTubeProfiles\(appSettings\.youtubeAccounts\)/g, '// handled in hook');


// Fix IPC Calls
content = content.replace(/invoke\('youtube:auth', index\)/g, `invoke('youtube:auth', { campaignId: activeCampaignId, accountIndex: index })`);
content = content.replace(/invoke\('youtube:disconnect', index\)/g, `invoke('youtube:disconnect', { campaignId: activeCampaignId, accountIndex: index })`);
content = content.replace(/invoke\('youtube:upload', \{ videoPath/g, `invoke('youtube:upload', { campaignId: activeCampaignId, videoPath`);
content = content.replace(/invoke\('tiktok:to:youtube', \{ url/g, `invoke('tiktok:to:youtube', { campaignId: activeCampaignId, url`);
content = content.replace(/invoke\('tiktok:check', activeCampaign\.tiktokLink\)/g, `invoke('tiktok:check', activeCampaign.tiktokUsername)`);
content = content.replace(/invoke\('youtube:history'\)/g, `invoke('youtube:history', activeCampaignId)`);
content = content.replace(/invoke\('scheduler:force', activeCampaign\)/g, `invoke('scheduler:force', activeCampaign)`);
content = content.replace(/invoke\('scheduler:start', activeCampaign\)/g, `invoke('scheduler:start', activeCampaign)`);
content = content.replace(/invoke\('scheduler:stop'\)/g, `invoke('scheduler:stop', activeCampaignId)`);
content = content.replace(/invoke\('scheduler:status'\)/g, `invoke('scheduler:status', activeCampaignId)`);

// Special cleanup for TikTok
content = content.replace(/activeCampaign\.tiktokLink/g, 'activeCampaign.tiktokUsername');

fs.writeFileSync('src/App.jsx', content);
