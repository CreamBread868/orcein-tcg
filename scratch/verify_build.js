const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const hasHiddenRule = html.includes('#packOpeningOverlay.hidden');
const overlayMatch = html.match(/id="packOpeningOverlay"[^>]*class="([^"]+)"/);

console.log('--- BUILD VERIFICATION ---');
console.log('CSS includes #packOpeningOverlay.hidden:', hasHiddenRule);
console.log('packOpeningOverlay class list:', overlayMatch ? overlayMatch[1] : 'NOT FOUND');

const dailyBonusMatch = html.match(/id="dailyBonusModal"[^>]*class="([^"]+)"/);
console.log('dailyBonusModal class list:', dailyBonusMatch ? dailyBonusMatch[1] : 'NOT FOUND');

const pages = html.match(/id="page-[^"]+"/g);
console.log('Found page elements:', pages);
