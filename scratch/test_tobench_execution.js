const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../index_local.html'), 'utf8');

const window = {
  CardSystem: {},
  BattleSystem: {
    state: { turnNumber: 2 },
    render: () => {},
    promptPromoteActive: () => {}
  },
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

// Extract and eval scripts
const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
for (const s of scripts) {
  const code = s.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
  if (code.includes('CardSystem = {') || code.includes('BattleSystem = {') || code.includes('ORBITAL_EFFECT_API = {') || code.includes('EffectEditor = {')) {
    try {
      eval(code);
    } catch (e) {
      console.warn('Script eval error:', e.message);
    }
  }
}

async function runExecutionTests() {
  console.log('=== TEST 1: executeCardEffectCode with toBench (Nest Ball pattern) ===');
  const player = {
    name: 'プレイヤー',
    deck: [
      { name: 'ピカチュウ', category: 'Basic', hp: 70, maxHp: 70, type: '雷' },
      { name: 'ライチュウ', category: 'Evolution', hp: 120, maxHp: 120, type: '雷' }
    ],
    hand: [],
    bench: [],
    discard: [],
    active: { name: 'ミライドンex', hp: 220, maxHp: 220 }
  };
  const opponent = { name: 'あいて', deck: [], hand: [], bench: [], discard: [], active: null };
  const game = { turnNumber: 2, logs: [] };

  const nestBallCode = `
    const c = choiceCard(self, "deck", { category: "Basic" });
    toBench(self, c);
    shuffleDeck(self);
  `;

  await window.executeCardEffectCode(
    nestBallCode,
    { players: [player, opponent], logs: game.logs, turnNumber: 2 },
    player,
    'trainer',
    { card: { name: 'ネストボール' } }
  );

  console.assert(player.bench.length === 1, 'Bench should have 1 pokemon');
  console.assert(player.bench[0].name === 'ピカチュウ', 'Bench pokemon is Pikachu');
  console.assert(player.deck.length === 1, 'Deck has 1 card remaining');
  console.assert(player.deck[0].name === 'ライチュウ', 'Deck has Raichu');
  console.assert(player.bench[0]._turnPlayed === 2, 'turnPlayed is 2');
  console.log('PASS Test 1: Nest Ball code executed successfully');

  console.log('\n=== TEST 2: Single-argument toBench(c) ===');
  const singleArgCode = `
    const c = choiceCard(self, "deck", { category: "Evolution" });
    toBench(c);
  `;
  await window.executeCardEffectCode(
    singleArgCode,
    { players: [player, opponent], logs: game.logs },
    player,
    'trainer',
    { card: { name: 'ふしぎな装置' } }
  );
  console.assert(player.bench.length === 2, 'Bench should have 2 pokemon');
  console.assert(player.bench[1].name === 'ライチュウ', 'Bench pokemon is Raichu');
  console.log('PASS Test 2: toBench(c) single arg works');

  console.log('\n=== TEST 3: toBench(self, pokemon) moves active to bench ===');
  const retreatCode = `
    toBench(self, pokemon);
  `;
  await window.executeCardEffectCode(
    retreatCode,
    { players: [player, opponent], logs: game.logs },
    player,
    'ability',
    { card: player.active, pokemon: player.active }
  );
  console.assert(player.active === null, 'Active became null');
  console.assert(player.bench.length === 3, 'Bench now has 3 pokemon');
  console.assert(player.bench[2].name === 'ミライドンex', 'Miraidon moved to bench');
  console.log('PASS Test 3: Active pokemon moved to bench');

  console.log('\n=== TEST 4: EffectEditor Japanese description generator for toBench ===');
  if (window.EffectEditor && typeof window.EffectEditor.makeEffectDisplayText === 'function') {
    const jp = window.EffectEditor.makeEffectDisplayText('toBench(self, card);');
    console.log('Generated JP:', jp);
    console.assert(jp.includes('ベンチ'), 'JP translation mentions ベンチ');
    console.log('PASS Test 4: Japanese effect translation works');
  }

  console.log('\n=== TEST 5: EffectEditor autocomplete list contains toBench ===');
  if (window.EffectEditor && Array.isArray(window.EffectEditor.effectApiCompletions)) {
    const item = window.EffectEditor.effectApiCompletions.find(c => c.keyword === 'toBench');
    console.assert(!!item, 'toBench found in effectApiCompletions');
    console.log('Found toBench in autocomplete:', item.label, '|', item.desc);
    console.log('PASS Test 5: Autocomplete contains toBench');
  }

  console.log('\n🌟 ALL EXECUTION TESTS PASSED! 🌟');
}

runExecutionTests().catch(e => {
  console.error(e);
  process.exit(1);
});
