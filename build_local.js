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
    if (file === 'CSS.html') {
      const regex = /<style>[\s\S]*?<\/style>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined CSS.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'BattleSystem.js.html') {
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
    .brand-title { font-size:28px; font-weight:900; letter-spacing:0.14em; background:linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:16px; }
    .status-msg { margin-top:14px; font-size:13px; color:#94a3b8; font-weight:600; letter-spacing:0.05em; min-height:20px; text-align:center; }
    .progress-bar-box { width:300px; max-width:85vw; height:10px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden; margin-top:16px; border:1px solid rgba(255,255,255,0.12); box-shadow:inset 0 1px 3px rgba(0,0,0,0.6); position:relative; }
    .progress-bar-fill { width:0%; height:100%; background:linear-gradient(90deg, #6366f1, #38bdf8, #a855f7); background-size:200% 100%; border-radius:999px; transition:width 0.2s cubic-bezier(0.4, 0, 0.2, 1); animation:shimmer 2s infinite linear; }
    @keyframes shimmer { 0% { background-position:0% 50%; } 100% { background-position:200% 50%; } }
    .progress-text { margin-top:8px; font-size:13px; color:#38bdf8; font-weight:800; letter-spacing:0.06em; }
  </style>
</head>
<body>
  <div id="gas-loader-screen">
    <div class="brand-logo">O</div>
    <div class="brand-title">ORBITAL TCG</div>
    <div class="progress-bar-box">
      <div id="gas-progress-fill" class="progress-bar-fill"></div>
    </div>
    <div id="gas-progress-text" class="progress-text">0%</div>
    <div id="gas-loader-status" class="status-msg">📡 初期化中...</div>
  </div>

  <script>
    (function() {
      window._is_gas_env = true;
      var savedG = window.google || (window.top && window.top.google) || (window.parent && window.parent.google);
      window._saved_google = savedG;

      window._resetRepoConfig = function() {
        try { localStorage.removeItem('ORBITAL_GITHUB_REPO'); } catch(e) {}
        location.reload();
      };

      var fillEl = document.getElementById('gas-progress-fill');
      var textEl = document.getElementById('gas-progress-text');
      var statusEl = document.getElementById('gas-loader-status');

      function setProgress(pct, msg) {
        if (fillEl) fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
        if (textEl) textEl.textContent = Math.min(100, Math.max(0, Math.round(pct))) + '%';
        if (statusEl && msg) statusEl.textContent = msg;
      }

      var currentPct = 5;
      setProgress(currentPct, '📡 GitHubサーバーへ接続中...');

      var progressInterval = setInterval(function() {
        if (currentPct < 88) {
          currentPct += Math.random() * 12 + 4;
          if (currentPct > 88) currentPct = 88;
          var msg = currentPct < 40 ? '📦 プログラムを取得中...' : (currentPct < 75 ? '⚡ JS/CSSコンポーネント展開中...' : '⚙️ DOM構築準備中...');
          setProgress(currentPct, msg);
        }
      }, 120);

      var repo = localStorage.getItem('ORBITAL_GITHUB_REPO') || 'CreamBread868/orcein-tcg';
      var cleanRepo = repo.replace(/^https?:\\/\\/github\\.com\\//i, '').replace(/\\/$/, '');
      if (cleanRepo.indexOf('/') === -1) cleanRepo += '/orcein-tcg';
      var rawBase = 'https://raw.githubusercontent.com/' + cleanRepo + '/main/';

      console.log('🐙 GAS Bootstrapping from GitHub:', rawBase, 'GAS Google Object:', !!savedG);

      function showResetUI(msg) {
        clearInterval(progressInterval);
        if (statusEl) {
          statusEl.innerHTML = '<span style="color:#ef4444;font-weight:bold;">' + msg + '</span><br/><br/>' +
            '<button onclick="window._resetRepoConfig()" style="padding:10px 18px;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;border:none;border-radius:10px;font-weight:bold;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.4);">🧹 リポジトリ設定をリセットして再読み込み</button>';
        }
      }

      var bootTimer = setTimeout(function() {
        console.warn('GitHub bootstrap timeout');
        showResetUI('⏰ GitHubからの取得がタイムアウトしました。');
      }, 8000);

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
          clearInterval(progressInterval);
          clearTimeout(bootTimer);
          setProgress(100, '✨ 起動完了！');
          setTimeout(function() {
            document.open();
            document.write(html);
            document.close();
            window._is_gas_env = true;
            if (savedG) {
              window.google = savedG;
              window._saved_google = savedG;
              console.log('✅ Real google.script.run restored to window.google!');
            }
          }, 80);
        })
        .catch(function(err) {
          clearInterval(progressInterval);
          clearTimeout(bootTimer);
          console.error('GitHub Bootstrap Error:', err);
          showResetUI('❌ エラー: ' + err.message);
        });
    })();
  </script>
</body>
</html>`;

const gasDir = path.join(__dirname, 'gas');
if (fs.existsSync(gasDir)) {
  fs.writeFileSync(path.join(gasDir, 'index_local.html'), gasLoaderHtml, 'utf8');
}

console.log('Successfully generated index.html, index_local.html, and gas/index_local.html with full CSS & JS compiled!');
