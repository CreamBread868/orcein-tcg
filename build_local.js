const fs = require('fs');
const path = require('path');

// Master template with full HTML structure
const templatePath = path.join(__dirname, 'index_template.html');
if (!fs.existsSync(templatePath)) {
  fs.copyFileSync(path.join(__dirname, 'restored_index.html'), templatePath);
}

let indexHtml = fs.readFileSync(templatePath, 'utf8');

const includes = {
  'CSS': 'CSS.html',
  'ActionEngine.js': 'ActionEngine.js.html',
  'EffectEditor.js': 'EffectEditor.js.html',
  'CardSystem.js': 'CardSystem.js.html',
  'DeckSystem.js': 'DeckSystem.js.html',
  'BattleSystem.js': 'BattleSystem.js.html',
  'App.js': 'App.js.html'
};

// 1. Replace GAS include statements if present
indexHtml = indexHtml.replace(/<\?!=\s*include\(['"]([^'"]+)['"]\);\s*\?>/g, (match, p1) => {
  const file = includes[p1];
  if (file && fs.existsSync(path.join(__dirname, file))) {
    console.log('Inlining include:', file);
    return fs.readFileSync(path.join(__dirname, file), 'utf8');
  }
  return match;
});

// 2. Replace already-inlined component script blocks safely (using negative lookahead for </script>)
for (const [key, file] of Object.entries(includes)) {
  if (fs.existsSync(path.join(__dirname, file))) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    if (file === 'BattleSystem.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?console\.log\('\[ORBITAL\] BattleSystem\.js\.html started execution'\);[\s\S]*?console\.log\('\[ORBITAL\] BattleSystem\.js\.html finished execution[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined BattleSystem.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'EffectEditor.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?console\.log\('\[ORBITAL\] EffectEditor\.js\.html started execution'\);[\s\S]*?console\.log\('\[ORBITAL\] EffectEditor\.js\.html finished execution[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined EffectEditor.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'CardSystem.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?console\.log\('\[ORBITAL\] CardSystem\.js\.html started execution'\);[\s\S]*?console\.log\('\[ORBITAL\] CardSystem\.js\.html finished execution[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined CardSystem.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'DeckSystem.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?window\.DeckSystem\s*=\s*function\s*\(\)[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined DeckSystem.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'App.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?const App = \{[\s\S]*?window\.App = App;[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined App.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    }
  }
}

// Write compiled output to index.html, index_local.html, and Index.html
fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml, 'utf8');
fs.writeFileSync(path.join(__dirname, 'index_local.html'), indexHtml, 'utf8');
if (fs.existsSync(path.join(__dirname, 'Index.html'))) {
  fs.writeFileSync(path.join(__dirname, 'Index.html'), indexHtml, 'utf8');
}

// GAS loader HTML (fetches index.html -> Index.html -> index_local.html with failover)
const gasLoaderHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ORBITAL TCG</title>
  <style>
    body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#060713; font-family:sans-serif; color:#f8fafc; }
    #gas-loader-screen { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 40%, #0f172a 0%, #020617 100%); z-index:999999; }
    .brand-logo { width:76px; height:76px; border-radius:22px; background:linear-gradient(135deg, #6366f1, #38bdf8); display:grid; place-items:center; font-size:38px; font-weight:900; color:#fff; box-shadow:0 0 50px rgba(99,102,241,0.7); animation:startupPulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1); margin-bottom:20px; }
    @keyframes startupPulse { 0%, 100% { transform:scale(1); box-shadow:0 0 40px rgba(99,102,241,0.7); } 50% { transform:scale(1.08); box-shadow:0 0 60px rgba(56,189,248,0.9); } }
    .brand-title { font-size:28px; font-weight:900; letter-spacing:0.14em; background:linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:24px; }
    .spinner { width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .status-msg { margin-top:18px; font-size:13px; color:#94a3b8; font-weight:600; letter-spacing:0.05em; }
  </style>
</head>
<body>
  <div id="gas-loader-screen">
    <div class="brand-logo">O</div>
    <div class="brand-title">ORBITAL TCG</div>
    <div class="spinner"></div>
    <div id="gas-loader-status" class="status-msg">🐙 GitHubから最新プログラムを読み込んでいます...</div>
  </div>

  <script>
    (function() {
      var repo = localStorage.getItem('ORBITAL_GITHUB_REPO') || 'CreamBread868/orcein-tcg';
      var cleanRepo = repo.replace(/^https?:\\/\\/github\\.com\\//i, '').replace(/\\/$/, '');
      if (cleanRepo.indexOf('/') === -1) cleanRepo += '/orcein-tcg';
      var rawBase = 'https://raw.githubusercontent.com/' + cleanRepo + '/main/';

      console.log('🐙 GAS Bootstrapping from GitHub:', rawBase);

      fetch(rawBase + 'index.html?t=' + Date.now())
        .then(function(res) {
          if (!res.ok) return fetch(rawBase + 'Index.html?t=' + Date.now());
          return res;
        })
        .then(function(res) {
          if (!res.ok) return fetch(rawBase + 'index_local.html?t=' + Date.now());
          return res;
        })
        .then(function(res) {
          if (!res.ok) throw new Error('GitHubからのプログラム取得に失敗しました (HTTP ' + res.status + ')');
          return res.text();
        })
        .then(function(html) {
          document.open();
          document.write(html);
          document.close();
        })
        .catch(function(err) {
          console.error('GitHub Bootstrap Error:', err);
          var st = document.getElementById('gas-loader-status');
          if (st) st.textContent = '❌ エラー: ' + err.message + ' (再読み込みしてください)';
        });
    })();
  </script>
</body>
</html>`;

const gasDir = path.join(__dirname, 'gas');
if (fs.existsSync(gasDir)) {
  fs.writeFileSync(path.join(gasDir, 'index_local.html'), gasLoaderHtml, 'utf8');
}

console.log('Successfully generated index.html, index_local.html, and gas/index_local.html!');
