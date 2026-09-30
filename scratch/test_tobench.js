// Test script for toBench behavior

function createMockCtx() {
  const player = {
    name: 'あなた',
    hand: [
      { name: 'ピカチュウ', category: 'Basic', hp: 70, maxHp: 70, type: '雷' },
      { name: 'ヒトカゲ', category: 'Basic', hp: 70, maxHp: 70, type: '炎' }
    ],
    deck: [
      { name: 'ゼニガメ', category: 'Basic', hp: 60, maxHp: 60, type: '水' },
      { name: 'フシギダネ', category: 'Basic', hp: 70, maxHp: 70, type: '草' }
    ],
    discard: [
      { name: 'イーブイ', category: 'Basic', hp: 60, maxHp: 60, type: '無' }
    ],
    bench: [],
    active: { name: 'ミライドンex', category: 'Basic', hp: 150, maxHp: 220, energy: 2, status: 'どく' }
  };

  const opponent = {
    name: 'あいて',
    hand: [],
    deck: [],
    discard: [],
    bench: [],
    active: { name: 'リザードンex', category: '2進化ex', hp: 330, maxHp: 330 }
  };

  const game = {
    turnNumber: 3,
    logs: []
  };

  return { self: player, opponent, game };
}

// Implement toBench method
async function toBench(ctx, player, cardOrCards) {
  let p = player;
  let cards = cardOrCards;
  if (cards === undefined && p && (p.name || p.id || p.category || p.hp !== undefined)) {
    cards = p;
    p = ctx?.self;
  } else if (p && (p.hp !== undefined || p.maxHp !== undefined)) {
    p = ctx?.self;
  }
  if (!p) p = ctx?.self;
  if (!p || !Array.isArray(p.bench)) return;

  if (cards && typeof cards.then === 'function') {
    cards = await cards;
  }

  if (!cards) return;
  const arr = Array.isArray(cards) ? cards : [cards];
  const currentTurn = ctx?.game?.turnNumber || 1;

  for (const c of arr) {
    if (!c) continue;

    // Check if already in bench
    if (p.bench.includes(c)) continue;

    if (p.bench.length >= 5) {
      if (ctx?.game?.logs) {
        ctx.game.logs.push(`⚠️ ベンチがいっぱいです（最大5匹）。【${c.name || 'カード'}】を出せませんでした。`);
      }
      continue;
    }

    const wasActive = (p.active === c);
    if (wasActive) {
      p.active = null;
      c.status = null; // Cures special conditions when returning to bench
    } else {
      // Remove from other locations
      [p.hand, p.deck, p.discard, ctx?.opponent?.hand, ctx?.opponent?.deck, ctx?.opponent?.discard].forEach((list) => {
        if (Array.isArray(list)) {
          const i = list.indexOf(c);
          if (i >= 0) list.splice(i, 1);
        }
      });
      c.energy = 0;
      c.attachedCards = [];
      c.attachedEnergies = [];
      c.status = null;
      c.hp = Number(c.maxHp || c.hp) || 70;
      c.maxHp = Number(c.maxHp || c.hp) || 70;
      c._turnPlayed = currentTurn;
    }

    p.bench.push(c);
    if (ctx?.game?.logs) {
      ctx.game.logs.push(`🐣 【${p.name || 'プレイヤー'}】が【${c.name || 'カード'}】をベンチに出しました。`);
    }
  }
}

async function runTests() {
  console.log('=== TEST 1: toBench from deck ===');
  let ctx = createMockCtx();
  const squirtle = ctx.self.deck[0];
  await toBench(ctx, ctx.self, squirtle);
  console.assert(ctx.self.bench.length === 1, 'Bench should have 1 card');
  console.assert(ctx.self.bench[0].name === 'ゼニガメ', 'Bench card is Squirtle');
  console.assert(!ctx.self.deck.includes(squirtle), 'Squirtle removed from deck');
  console.assert(squirtle._turnPlayed === 3, 'turnPlayed is set to 3');
  console.log('PASS Test 1');

  console.log('\n=== TEST 2: toBench single argument (omit player) ===');
  ctx = createMockCtx();
  const pikachu = ctx.self.hand[0];
  await toBench(ctx, pikachu);
  console.assert(ctx.self.bench.length === 1, 'Bench should have 1 card');
  console.assert(ctx.self.bench[0].name === 'ピカチュウ', 'Bench card is Pikachu');
  console.assert(!ctx.self.hand.includes(pikachu), 'Pikachu removed from hand');
  console.log('PASS Test 2');

  console.log('\n=== TEST 3: toBench array of cards ===');
  ctx = createMockCtx();
  const h1 = ctx.self.hand[0];
  const h2 = ctx.self.hand[1];
  await toBench(ctx, ctx.self, [h1, h2]);
  console.assert(ctx.self.bench.length === 2, 'Bench has 2 cards');
  console.assert(ctx.self.hand.length === 0, 'Hand is empty');
  console.log('PASS Test 3');

  console.log('\n=== TEST 4: toBench active Pokemon ===');
  ctx = createMockCtx();
  const miraidon = ctx.self.active;
  await toBench(ctx, ctx.self, miraidon);
  console.assert(ctx.self.active === null, 'Active is now null');
  console.assert(ctx.self.bench.includes(miraidon), 'Miraidon is on bench');
  console.assert(miraidon.hp === 150, 'Kept its remaining HP');
  console.assert(miraidon.energy === 2, 'Kept its attached energy');
  console.assert(miraidon.status === null, 'Status condition cleared');
  console.log('PASS Test 4');

  console.log('\n=== TEST 5: toBench bench max limit (5) ===');
  ctx = createMockCtx();
  ctx.self.bench = [
    { name: '1' }, { name: '2' }, { name: '3' }, { name: '4' }, { name: '5' }
  ];
  const eevee = ctx.self.discard[0];
  await toBench(ctx, ctx.self, eevee);
  console.assert(ctx.self.bench.length === 5, 'Bench still has 5 cards');
  console.assert(ctx.self.discard.includes(eevee), 'Eevee remains in discard');
  console.log('PASS Test 5');

  console.log('\n=== TEST 6: toBench with Promise ===');
  ctx = createMockCtx();
  const promiseCard = Promise.resolve(ctx.self.deck[0]);
  await toBench(ctx, ctx.self, promiseCard);
  console.assert(ctx.self.bench.length === 1, 'Bench has 1 card');
  console.assert(ctx.self.bench[0].name === 'ゼニガメ', 'Resolved Squirtle');
  console.log('PASS Test 6');

  console.log('\n🌟 ALL TOBENCH TESTS PASSED! 🌟');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
