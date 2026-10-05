const fs = require('fs');
const path = require('path');

// Master template with full HTML structure
const templatePath = path.join(__dirname, 'index_template.html');
if (!fs.existsSync(templatePath)) {
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    fs.copyFileSync(path.join(__dirname, 'index.html'), templatePath);
  }
}

let indexHtml = fs.readFileSync(fs.existsSync(templatePath) ? templatePath : path.join(__dirname, 'index.html'), 'utf8');

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

// 2. Replace inlined component script blocks safely
for (const [key, file] of Object.entries(includes)) {
  if (fs.existsSync(path.join(__dirname, file))) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    if (file === 'CSS.html') {
      const regex = /<style>[\s\S]*?<\/style>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined CSS.html block');
        indexHtml = indexHtml.replace(regex, () => '<style>\n' + content + '\n</style>');
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
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?console\.log\('\[ORBITAL\] DeckSystem\.js\.html started execution'\);[\s\S]*?console\.log\('\[ORBITAL\] DeckSystem\.js\.html finished execution[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined DeckSystem.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'ActionEngine.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?ActionEngine\.js\.html started execution[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined ActionEngine.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    } else if (file === 'App.js.html') {
      const regex = /<script>(?:(?!<\/script>)[\s\S])*?console\.log\('\[ORBITAL\] App\.js\.html started execution'\);[\s\S]*?console\.log\('\[ORBITAL\] App\.js\.html finished execution[\s\S]*?<\/script>/;
      if (regex.test(indexHtml)) {
        console.log('Replacing inlined App.js.html block');
        indexHtml = indexHtml.replace(regex, () => content);
      }
    }
  }
}

// Write master compiled files
fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml, 'utf8');
fs.writeFileSync(path.join(__dirname, 'index_local.html'), indexHtml, 'utf8');

const gasDir = path.join(__dirname, 'gas');
if (fs.existsSync(gasDir)) {
  fs.writeFileSync(path.join(gasDir, 'index.html'), indexHtml, 'utf8');
  fs.writeFileSync(path.join(gasDir, 'index_local.html'), indexHtml, 'utf8');
  console.log('Successfully synced index files to gas/ directory!');
}

console.log('Successfully generated index.html and index_local.html!');
