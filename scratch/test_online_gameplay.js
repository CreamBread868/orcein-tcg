const fs = require('fs');

const storage = {};
global.window = global;
global.window.addEventListener = () => {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); }
};

const createMockElement = () => ({
  value: '',
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

console.log('BattleSystem loaded.');

// Test online room flow:
// 1. Host creates room
let hostRoomRes;
window.google.script.run.withSuccessHandler(res => { hostRoomRes = res; }).createOnlineRoom(
  [{ name: 'ピカチュウ', category: 'たね', hp: 70, type: '雷' }],
  'Host Room',
  'host@test.com',
  { prizeCount: 6 }
);

setTimeout(() => {
  const roomId = hostRoomRes.roomId;
  console.log('Host created room:', roomId);

  // Host opens waiting room
  window.BattleSystem.state.mode = 'online';
  window.BattleSystem.state.online.roomId = roomId;
  window.BattleSystem.state.online.role = 'host';
  window.BattleSystem.state.online.myDeck = [{ name: 'ピカチュウ', category: 'たね', hp: 70, type: '雷' }];
  window.BattleSystem.startWaitingRoomPolling();

  // 2. Guest joins room
  let guestJoinRes;
  window.google.script.run.withSuccessHandler(res => { guestJoinRes = res; }).joinOnlineRoom(
    roomId,
    [{ name: 'ヒトカゲ', category: 'たね', hp: 70, type: '炎' }],
    'guest@test.com'
  );

  setTimeout(() => {
    console.log('Guest joined:', guestJoinRes.ok);

    // Let polling run for 3 seconds to complete match start
    setTimeout(() => {
      console.log('Host match phase:', window.BattleSystem.state.phase);
      console.log('Host turn player:', window.BattleSystem.state.turnPlayer);
      console.log('Host player deck size:', window.BattleSystem.state.player.deck.length);

      // Now simulate Host broadcasting an action (e.g. play basic)
      const testCard = { name: 'ピカチュウ', category: 'たね', hp: 70 };
      window.BattleSystem.broadcastOnlineAction('play_basic', { card: testCard, slotType: 'active' });

      setTimeout(() => {
        const rooms = JSON.parse(localStorage.getItem('orbital_mock_rooms'));
        const room = rooms.find(r => r.roomId === roomId);
        console.log('Room actions in storage:', room.actions);
      }, 100);
    }, 3000);
  }, 500);
}, 200);
