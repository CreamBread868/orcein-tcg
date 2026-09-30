const fs = require('fs');

// Mock localStorage and window
const storage = {};
global.window = global;
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); }
};

const html = fs.readFileSync('c:/Projects/orbital_tcg/index_local.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);

// Find the MockRunner script
let mockScript = '';
for (const s of scriptMatch) {
  if (s.includes('MockRunner')) {
    mockScript = s.replace(/<\/?script>/g, '');
    break;
  }
}

// Evaluate mock script
eval(mockScript);

// Test Host creates room
let hostRes;
window.google.script.run.withSuccessHandler((res) => { hostRes = res; }).createOnlineRoom([], 'Test Room', 'host@test.com', { prizeCount: 6 });

setTimeout(() => {
  const roomId = hostRes.roomId;

  // Guest joins IMMEDIATELY without host polling first
  let joinRes;
  window.google.script.run.withSuccessHandler((res) => { joinRes = res; }).joinOnlineRoom(roomId, [], 'guest@test.com');

  setTimeout(() => {
    // Guest polls FIRST!
    let guestPoll1;
    window.google.script.run.withSuccessHandler((res) => { guestPoll1 = res; }).pollOnlineRoom(roomId, 'guest', 0);

    setTimeout(() => {
      console.log('Guest Poll 1 status:', guestPoll1.status, 'hostConnected:', guestPoll1.hostConnected, 'guestConnected:', guestPoll1.guestConnected);
      console.log('Guest Poll 1 actions count:', guestPoll1.actions.length);

      // Host polls
      let hostPoll1;
      window.google.script.run.withSuccessHandler((res) => { hostPoll1 = res; }).pollOnlineRoom(roomId, 'host', 0);

      setTimeout(() => {
        console.log('Host Poll 1 status:', hostPoll1.status, 'actions count:', hostPoll1.actions.length);
        if (hostPoll1.actions.length > 0) {
          console.log('Match start action payload:', hostPoll1.actions[0].type);
        }
      }, 100);
    }, 100);
  }, 100);
}, 100);
