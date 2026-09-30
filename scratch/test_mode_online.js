const fs = require('fs');

const storage = {};
global.window = global;
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); }
};

const createMockElement = () => ({
  style: {},
  dataset: {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
  addEventListener: () => {},
  appendChild: () => {},
  querySelector: () => createMockElement(),
  querySelectorAll: () => []
});

global.document = {
  getElementById: () => createMockElement(),
  querySelector: () => createMockElement(),
  querySelectorAll: () => [],
  createElement: () => createMockElement(),
  addEventListener: () => {},
  body: createMockElement()
};

const html = fs.readFileSync('c:/Projects/orbital_tcg/index_local.html', 'utf8');

// Extract script tags
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g);
scripts.forEach(s => {
  try {
    eval(s.replace(/<\/?script>/g, ''));
  } catch(e) {}
});

console.log('Initial BattleSystem mode:', window.BattleSystem.state.mode);

// Trigger startOnlineMatch
window.BattleSystem.startOnlineMatch([], [], 'host', 6, 'HostPlayer', 'GuestPlayer', 12345);

console.log('After startOnlineMatch, mode:', window.BattleSystem.state.mode);
console.log('Opponent name:', window.BattleSystem.state.opponent.name);
console.log('Phase:', window.BattleSystem.state.phase);

// Now trigger opponent turn
window.BattleSystem.startTurn('opponent');
console.log('Turn player:', window.BattleSystem.state.turnPlayer);
console.log('Is BattleSystem mode online?', window.BattleSystem.state.mode === 'online');
