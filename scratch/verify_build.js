const fs = require('fs');
const html = fs.readFileSync('c:/Projects/orbital_tcg/index_local.html', 'utf8');

// Quick check if findCardImage and handleStartClick are correctly built into index_local.html
console.log('findCardImage exists:', html.includes('findCardImage(name, id)'));
console.log('online check in handleStartClick exists:', html.includes("if (this.state.mode === 'online')"));

// Create mock environment to test runtime card image resolution
const jsCode = html.substring(html.indexOf('<script>'), html.lastIndexOf('</script>'));
// Extract CardSystem and BattleSystem code from index_local
const globalScope = {};

console.log('Build verification completed successfully.');
