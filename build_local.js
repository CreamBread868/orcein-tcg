const fs = require('fs');
const path = require('path');

let indexHtml = fs.readFileSync(path.join(__dirname, 'Index.html'), 'utf8');

const includes = {
  'CSS': 'CSS.html',
  'ActionEngine.js': 'ActionEngine.js.html',
  'EffectEditor.js': 'EffectEditor.js.html',
  'CardSystem.js': 'CardSystem.js.html',
  'DeckSystem.js': 'DeckSystem.js.html',
  'BattleSystem.js': 'BattleSystem.js.html',
  'App.js': 'App.js.html'
};

indexHtml = indexHtml.replace(/<\?!=\s*include\(['"]([^'"]+)['"]\);\s*\?>/g, (match, p1) => {
  const file = includes[p1];
  if (file && fs.existsSync(path.join(__dirname, file))) {
    console.log('Inlining', file);
    return fs.readFileSync(path.join(__dirname, file), 'utf8');
  }
  console.warn('Could not find file for include', p1);
  return match;
});

// ローカル確認用
fs.writeFileSync(path.join(__dirname, 'index_local.html'), indexHtml, 'utf8');

// GitHub Pages 用メインエントリファイル (index.html)
fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml, 'utf8');

console.log('Successfully generated index_local.html and index.html for GitHub Pages! Length:', indexHtml.length);

