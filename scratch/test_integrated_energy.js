const fs = require('fs');
const path = require('path');

// Read built index_local.html or individual files to test in simulated browser context
const html = fs.readFileSync(path.join(__dirname, '../index_local.html'), 'utf8');

// Simple DOM & browser mock
const window = {
  CardSystem: {},
  BattleSystem: {},
  ORBITAL_EFFECT_API: {},
  App: { toast: (m) => console.log('TOAST:', m) },
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
    addEventListener: () => {},
    body: { appendChild() {} }
  },
  addEventListener: () => {}
};
global.window = window;
global.document = window.document;

// Extract script contents by searching for their unique identifiers
const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
for (const s of scripts) {
  const code = s.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
  if (code.includes('CardSystem = {') || code.includes('BattleSystem = {') || code.includes('ORBITAL_EFFECT_API = {')) {
    try {
      eval(code);
    } catch (e) {
      // Ignore DOM setup errors during script load
    }
  }
}

console.log('--- Testing BattleSystem.parseEnergyCount ---');
const countTests = [
  { str: '無色', expected: 1 },
  { str: '無', expected: 1 },
  { str: 'ドラゴン', expected: 1 },
  { str: 'なし', expected: 0 },
  { str: '0', expected: 0 },
  { str: '0個', expected: 0 },
  { str: '-', expected: 0 },
  { str: '不要', expected: 0 },
  { str: '', expected: 0 },
  { str: null, expected: 0 },
  { str: '炎,炎,無', expected: 3 },
  { str: '炎,炎,無色', expected: 3 },
  { str: '炎炎無色', expected: 3 },
  { str: '雷雷無', expected: 3 },
  { str: '炎2', expected: 2 },
  { str: '雷×3', expected: 3 },
  { str: '炎、炎、無色', expected: 3 },
  { str: 2, expected: 2 }
];

let failed = 0;
for (const ct of countTests) {
  const actual = window.BattleSystem.parseEnergyCount(ct.str);
  if (actual !== ct.expected) {
    console.error(`FAIL parseEnergyCount("${ct.str}"): expected ${ct.expected}, got ${actual}`);
    failed++;
  } else {
    console.log(`PASS parseEnergyCount("${ct.str}") => ${actual}`);
  }
}

console.log('\n--- Testing BattleSystem.renderCostText ---');
const renderTests = [
  { str: '無色', expected: '⚪無色' },
  { str: 'なし', expected: 'なし (0個)' },
  { str: '', expected: 'なし (0個)' },
  { str: '炎炎無色', expected: '🔥炎 🔥炎 ⚪無色' }
];

for (const rt of renderTests) {
  const actual = window.BattleSystem.renderCostText(rt.str);
  if (actual !== rt.expected) {
    console.error(`FAIL renderCostText("${rt.str}"): expected "${rt.expected}", got "${actual}"`);
    failed++;
  } else {
    console.log(`PASS renderCostText("${rt.str}") => "${actual}"`);
  }
}

console.log('\n--- Testing BattleSystem.checkEnergyRequirement ---');
const checkTests = [
  {
    name: '1 Colorless with 1 Fire attached',
    attacker: { energy: 1, attachedEnergies: ['炎'], type: '炎' },
    req: '無色',
    expectedCan: true
  },
  {
    name: 'Free attack with 0 energy attached',
    attacker: { energy: 0, attachedEnergies: [], type: '草' },
    req: 'なし',
    expectedCan: true
  },
  {
    name: 'Charizard "炎炎無色" with 2 Fire + 1 Water',
    attacker: { energy: 3, attachedEnergies: ['炎', '炎', '水'], type: '炎' },
    req: '炎炎無色',
    expectedCan: true
  },
  {
    name: 'Charizard "炎,炎,無色" with 1 Fire + 2 Water (type mismatch)',
    attacker: { energy: 3, attachedEnergies: ['炎', '水', '水'], type: '炎' },
    req: '炎,炎,無色',
    expectedCan: false,
    expectedReason: 'type'
  },
  {
    name: 'Pikachu "雷,雷,無" with 2 Lightning (count insufficient)',
    attacker: { energy: 2, attachedEnergies: ['雷', '雷'], type: '雷' },
    req: '雷,雷,無',
    expectedCan: false,
    expectedReason: 'count'
  }
];

for (const chk of checkTests) {
  const actual = window.BattleSystem.checkEnergyRequirement(chk.attacker, chk.req);
  if (actual.canAttack !== chk.expectedCan) {
    console.error(`FAIL checkEnergyRequirement ${chk.name}: expected ${chk.expectedCan}, got ${actual.canAttack} (${actual.missingDesc})`);
    failed++;
  } else if (chk.expectedReason && actual.reason !== chk.expectedReason) {
    console.error(`FAIL checkEnergyRequirement ${chk.name}: expected reason ${chk.expectedReason}, got ${actual.reason}`);
    failed++;
  } else {
    console.log(`PASS checkEnergyRequirement ${chk.name} => canAttack=${actual.canAttack} (${actual.missingDesc || 'OK'})`);
  }
}

console.log('\n--- Testing ActionEngine.attachEnergy & discardEnergy synchronization ---');
const poke = { name: 'ピカチュウ', type: '雷', energy: 0, attachedEnergies: [] };
window.ORBITAL_EFFECT_API.attachEnergy({}, poke, 2);
if (poke.energy !== 2 || poke.attachedEnergies.length !== 2 || poke.attachedEnergies[0] !== '雷') {
  console.error(`FAIL ActionEngine.attachEnergy: energy=${poke.energy}, attached=${JSON.stringify(poke.attachedEnergies)}`);
  failed++;
} else {
  console.log(`PASS ActionEngine.attachEnergy => energy=${poke.energy}, attached=${JSON.stringify(poke.attachedEnergies)}`);
}

window.ORBITAL_EFFECT_API.discardEnergy({}, poke, 1);
if (poke.energy !== 1 || poke.attachedEnergies.length !== 1) {
  console.error(`FAIL ActionEngine.discardEnergy: energy=${poke.energy}, attached=${JSON.stringify(poke.attachedEnergies)}`);
  failed++;
} else {
  console.log(`PASS ActionEngine.discardEnergy => energy=${poke.energy}, attached=${JSON.stringify(poke.attachedEnergies)}`);
}

if (failed === 0) {
  console.log('\n🌟 ALL INTEGRATED TESTS PASSED SUCCESSFULLY! 🌟');
} else {
  console.error(`\n❌ ${failed} INTEGRATED TESTS FAILED!`);
  process.exit(1);
}
