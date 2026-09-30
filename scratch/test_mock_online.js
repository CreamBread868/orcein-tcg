const fs = require('fs');

// Mock localStorage and window
const storage = {};
global.window = global;
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); }
};

const html = fs.readFileSync('c:/Projects/orbital_tcg/Index.html', 'utf8');
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

// Test creating room
let hostRes;
window.google.script.run.withSuccessHandler((res) => { hostRes = res; }).createOnlineRoom([], 'Test Room', 'host@test.com', { prizeCount: 6 });

setTimeout(() => {
  const roomId = hostRes.roomId;

  // Host poll 1
  let hostPoll1;
  window.google.script.run.withSuccessHandler((res) => { hostPoll1 = res; }).pollOnlineRoom(roomId, 'host', 0);

  setTimeout(() => {
    // Guest joins
    let joinRes;
    window.google.script.run.withSuccessHandler((res) => { joinRes = res; }).joinOnlineRoom(roomId, [], 'guest@test.com');

    setTimeout(() => {
      // Guest poll 1
      let guestPoll1;
      window.google.script.run.withSuccessHandler((res) => { guestPoll1 = res; }).pollOnlineRoom(roomId, 'guest', 0);

      setTimeout(() => {
        // Host poll 2
        let hostPoll2;
        window.google.script.run.withSuccessHandler((res) => { hostPoll2 = res; }).pollOnlineRoom(roomId, 'host', 0);

        setTimeout(() => {
          console.log('Host Poll 2 actions:', hostPoll2.actions);

          // Guest poll 2 (Guest should also get the game_start action!)
          let guestPoll2;
          window.google.script.run.withSuccessHandler((res) => { guestPoll2 = res; }).pollOnlineRoom(roomId, 'guest', 0);

          setTimeout(() => {
            console.log('Guest Poll 2 actions:', guestPoll2.actions);
          }, 100);
        }, 100);
      }, 100);
    }, 100);
  }, 100);
}, 100);
