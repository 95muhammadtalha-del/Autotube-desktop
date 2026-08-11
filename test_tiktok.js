import https from 'https';

function fetchProfile(username) {
  return new Promise((resolve, reject) => {
    https.get(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/"secUid":"([^"]+)"/);
        if (match) {
          resolve(match[1]);
        } else {
          resolve("Not found in HTML. Length: " + data.length + " Status: " + res.statusCode);
        }
      });
    }).on('error', reject);
  });
}

fetchProfile('emthenutritionist').then(console.log).catch(console.error);
