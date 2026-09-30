const CONFIG = {
  SPREADSHEET_ID: '', // 空欄なら、このGASプロジェクトに紐づくスプレッドシートを使用
  CARD_SHEET: 'Cards',
  DECK_SHEET: 'Decks',
  IMAGE_FOLDER_NAME: 'OriginalTCG_CardImages'
};

const CARD_HEADERS = [
  'id','name','category','type','rarity','image','hp',
  'abilityName','abilityText',
  'attack1Name','attack1Damage','attack1Energy','attack1Text',
  'attack2Name','attack2Damage','attack2Energy','attack2Text',
  'weakness','resistance','retreat','description',
  'abilityCode','attack1Code','attack2Code',
  'imageScale','imageFit','imageY','imageX','imageHeight','artLayout',
  'preEvolution','textSize'
];

const DECK_HEADERS = [
  'id', 'name', 'description', 'totalCount', 'cardsJson', 'updatedAt', 'userEmail'
];

/**
 * getCurrentUser — ログイン中のGoogleアカウント(Gmail)を取得
 */
function getCurrentUser() {
  let email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    email = '';
  }
  return { email: email, isLoggedIn: !!email };
}

/**
 * doGet — GASウェブアプリのエントリポイント。
 *
 * ビルド済みの単一HTML (index_local.html) を配信することで、
 * GASテンプレートエンジンが JavaScript の ${...} 構文と干渉するのを防ぐ。
 * デプロイ前に必ず 'node build_local.js' を実行してから clasp push すること。
 */
function doGet() {
  try {
    ensureCardSheet_();
    ensureDeckSheet_();
  } catch (e) {
    console.warn('Sheet initialization error in doGet:', e);
  }

  var htmlOutput;
  try {
    htmlOutput = HtmlService.createHtmlOutputFromFile('index_local');
  } catch (err) {
    htmlOutput = HtmlService.createTemplateFromFile('Index').evaluate();
  }

  return htmlOutput
    .setTitle('ORBITAL TCG (v64)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * include() — Index.html の <?!= include('FileName'); ?> から呼ばれる。
 * ローカル確認用。GAS本番では doGet が index_local を直接配信するため不使用。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('スプレッドシートが見つかりません。CONFIG.SPREADSHEET_IDを設定してください。');
  return active;
}

function ensureCardSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.CARD_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.CARD_SHEET);

  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, CARD_HEADERS.length).setValues([CARD_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missingHeaders = CARD_HEADERS.filter(h => !existingHeaders.includes(h));
  if (missingHeaders.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  return sheet;
}

function ensureDeckSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.DECK_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.DECK_SHEET);

  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, DECK_HEADERS.length).setValues([DECK_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missingHeaders = DECK_HEADERS.filter(h => !existingHeaders.includes(h));
  if (missingHeaders.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  return sheet;
}

/* ---------- カード・デッキCRUD ---------- */

function getDecks(userEmail) {
  const sheet = ensureDeckSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const allDecks = rows
    .filter(row => row.some(v => v !== ''))
    .map(row => rowToDeck_(row, headers));

  const currentUserEmail = userEmail || getCurrentUser().email;
  if (!currentUserEmail) {
    return allDecks;
  }

  // 自分のデッキ + 全体共通/サンプルデッキ（userEmailが空または'sample'）
  return allDecks.filter(deck => {
    return !deck.userEmail || deck.userEmail === 'sample' || deck.userEmail === currentUserEmail;
  });
}

function getDeck(deckId) {
  if (!deckId) return null;
  return getDecks().find(deck => String(deck.id) === String(deckId)) || null;
}

function saveDeck(deck, adminToken, userEmail) {
  const currentEmail = userEmail || getCurrentUser().email || '';
  if (!deck || !String(deck.name || '').trim()) {
    throw new Error('デッキ名は必須です。');
  }

  const normalized = normalizeDeck_(deck);
  if (!normalized.userEmail) {
    normalized.userEmail = currentEmail;
  }

  const sheet = ensureDeckSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const lastRow = sheet.getLastRow();
    const rows = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
      : [];

    const idColIdx = headers.indexOf('id');
    const existingIndex = rows.findIndex(row => String(row[idColIdx >= 0 ? idColIdx : 0]) === String(normalized.id));
    const rowData = deckToRow_(normalized, headers);

    if (existingIndex >= 0) {
      const emailColIdx = headers.indexOf('userEmail');
      const ownerEmail = emailColIdx >= 0 ? String(rows[existingIndex][emailColIdx] || '') : '';
      if (ownerEmail && currentEmail && ownerEmail !== currentEmail && !adminToken) {
        throw new Error('他のユーザーのデッキは上書きできません。「コピーして新規作成」してください。');
      }

      sheet.getRange(existingIndex + 2, 1, 1, rowData.length)
        .setValues([rowData]);
      return {ok: true, mode: 'updated', deck: normalized};
    }

    sheet.appendRow(rowData);
    return {ok: true, mode: 'created', deck: normalized};
  } finally {
    lock.releaseLock();
  }
}

function deleteDeck(deckId, adminToken, userEmail) {
  if (!deckId) throw new Error('デッキIDがありません。');
  const currentEmail = userEmail || getCurrentUser().email || '';

  const sheet = ensureDeckSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return {ok: false, message: 'デッキがありません。'};

    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const idColIdx = headers.indexOf('id');
    const emailColIdx = headers.indexOf('userEmail');

    const index = rows.findIndex(row => String(row[idColIdx >= 0 ? idColIdx : 0]) === String(deckId));
    if (index < 0) return {ok: false, message: 'デッキが見つかりません。'};

    const ownerEmail = emailColIdx >= 0 ? String(rows[index][emailColIdx] || '') : '';
    if (ownerEmail && currentEmail && ownerEmail !== currentEmail && !adminToken) {
      throw new Error('他のユーザーのデッキは削除できません。');
    }

    sheet.deleteRow(index + 2);
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}

function getCards() {
  const sheet = ensureCardSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows
    .filter(row => row.some(v => v !== ''))
    .map(row => rowToCard_(row, headers));
}

function getCard(id) {
  if (!id) return null;
  return getCards().find(card => String(card.id) === String(id)) || null;
}

function hashPassword_(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

// 初回だけApps Scriptエディタから setupAdminPassword('任意のパスワード') を実行してください。
function setupAdminPassword(password) {
  password = password || '3838';
  if (String(password).length < 4) throw new Error('管理者パスワードは4文字以上にしてください。');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', hashPassword_(password));
  return '管理者パスワードを設定しました。';
}

function loginAdmin(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  if (!stored) throw new Error('管理者パスワードが未設定です。Apps Scriptエディタで setupAdminPassword() を一度実行してください。');
  if (hashPassword_(password) !== stored) throw new Error('パスワードが違います。');
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('ADMIN_SESSION_' + token, '1', 21600);
  return {ok:true, token:token, expiresIn:21600};
}

function logoutAdmin(token) {
  if (token) CacheService.getScriptCache().remove('ADMIN_SESSION_' + token);
  return {ok:true};
}

function requireAdmin_(token) {
  if (!token || CacheService.getScriptCache().get('ADMIN_SESSION_' + token) !== '1') {
    throw new Error('管理者ログインが必要です。');
  }
}

function saveCard(card, adminToken) {
  requireAdmin_(adminToken);
  if (!card || !String(card.name || '').trim()) {
    throw new Error('カード名は必須です。');
  }

  const normalized = normalizeCard_(card);
  const sheet = ensureCardSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const lastRow = sheet.getLastRow();
    const rows = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
      : [];

    const idColIdx = headers.indexOf('id');
    const existingIndex = rows.findIndex(row => String(row[idColIdx >= 0 ? idColIdx : 0]) === String(normalized.id));
    const rowData = cardToRow_(normalized, headers);

    if (existingIndex >= 0) {
      sheet.getRange(existingIndex + 2, 1, 1, rowData.length)
        .setValues([rowData]);
      return {ok: true, mode: 'updated', card: normalized};
    }

    sheet.appendRow(rowData);
    return {ok: true, mode: 'created', card: normalized};
  } finally {
    lock.releaseLock();
  }
}

function deleteCard(id, adminToken) {
  requireAdmin_(adminToken);
  if (!id) throw new Error('カードIDがありません。');

  const sheet = ensureCardSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return {ok: false, message: 'カードがありません。'};

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const index = ids.findIndex(row => String(row[0]) === String(id));
    if (index < 0) return {ok: false, message: 'カードが見つかりません。'};

    sheet.deleteRow(index + 2);
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}

function createImageFolder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.IMAGE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.IMAGE_FOLDER_NAME);
}

/**
 * base64Data は「data:image/png;base64,...」形式を想定。
 * HTMLから画像ファイルを送る場合に使用。
 */
function uploadCardImage(fileName, mimeType, base64Data, adminToken) {
  requireAdmin_(adminToken);
  if (!base64Data) throw new Error('画像データがありません。');

  const folder = createImageFolder_();
  const raw = String(base64Data).split(',').pop();
  const bytes = Utilities.base64Decode(raw);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/png', fileName || 'card-image');
  const file = folder.createFile(blob);

  // Webアプリで表示しやすいURLを返す。
  // Driveの共有設定は環境に応じて変更してください。
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Workspace等で外部共有が禁止されている場合は、ファイルIDを返す。
  }

  return {
    ok: true,
    id: file.getId(),
    url: 'https://lh3.googleusercontent.com/d/' + file.getId(),
    name: file.getName()
  };
}

/* ---------- オンライン対戦 (Online Battle Room System) ---------- */

function getOnlineRoomList() {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('ORBITAL_ROOM_LIST');
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    const now = Date.now();
    // 2時間以内の有効なルームのみ返す
    return list.filter(r => (now - (r.timestamp || 0)) < 7200000 && r.status !== 'finished');
  } catch (e) {
    return [];
  }
}

function updateRoomListIndex_(roomId, name, hostName, status) {
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const raw = cache.get('ORBITAL_ROOM_LIST');
    let list = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    list = list.filter(r => (now - (r.timestamp || 0)) < 7200000 && r.roomId !== roomId);
    if (status !== 'finished') {
      list.unshift({
        roomId: roomId,
        name: name,
        hostName: hostName,
        status: status,
        timestamp: now
      });
    }
    cache.put('ORBITAL_ROOM_LIST', JSON.stringify(list.slice(0, 30)), 21600);
  } catch (e) {
    console.warn('Failed to update room list index:', e);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function createOnlineRoom(deck, roomName, userEmail, rules) {
  if (!deck) throw new Error('対戦デッキが必要です。');
  const hostEmail = userEmail || getCurrentUser().email || '';
  const hostName = hostEmail ? hostEmail.split('@')[0] : ('プレイヤー' + Math.floor(Math.random() * 900 + 100));
  const roomId = 'ROOM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const name = String(roomName || (hostName + 'の部屋')).trim();

  const room = {
    roomId: roomId,
    name: name,
    status: 'waiting', // waiting | active | finished
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: rules || { prizeCount: 6 },
    host: {
      role: 'host',
      email: hostEmail,
      name: hostName,
      deck: deck
    },
    guest: null,
    turnPlayer: 'host',
    turnNumber: 1,
    actions: [],
    lastSeq: 0
  };

  const cache = CacheService.getScriptCache();
  cache.put('ORBITAL_ROOM_' + roomId, JSON.stringify(room), 21600);
  updateRoomListIndex_(roomId, name, hostName, 'waiting');

  return {
    ok: true,
    roomId: roomId,
    role: 'host',
    room: {
      roomId: roomId,
      name: name,
      status: 'waiting',
      host: { name: hostName, email: hostEmail },
      rules: room.rules
    }
  };
}

function joinOnlineRoom(roomId, deck, userEmail) {
  if (!roomId) throw new Error('ルームIDが必要です。');
  if (!deck) throw new Error('対戦デッキが必要です。');

  const cleanRoomId = String(roomId).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const raw = cache.get('ORBITAL_ROOM_' + cleanRoomId);
    if (!raw) {
      return { ok: false, message: 'ルームが見つかりません。期限切れか解散された可能性があります。' };
    }
    const room = JSON.parse(raw);
    if (room.status !== 'waiting') {
      return { ok: false, message: 'このルームはすでに対戦中か終了しています。' };
    }

    const guestEmail = userEmail || getCurrentUser().email || '';
    const guestName = guestEmail ? guestEmail.split('@')[0] : ('ゲスト' + Math.floor(Math.random() * 900 + 100));

    room.guest = {
      role: 'guest',
      email: guestEmail,
      name: guestName,
      deck: deck
    };
    room.status = 'active';
    room.updatedAt = new Date().toISOString();

    // 先攻後攻の決定
    const firstPlayer = Math.random() < 0.5 ? 'host' : 'guest';
    room.turnPlayer = firstPlayer;
    room.turnNumber = 1;
    room.lastSeq = 1;
    room.actions = [
      {
        seq: 1,
        by: 'system',
        type: 'game_start',
        payload: {
          firstPlayer: firstPlayer,
          hostDeck: room.host.deck,
          guestDeck: deck,
          rules: room.rules,
          hostName: room.host.name,
          guestName: guestName
        },
        time: Date.now()
      }
    ];

    cache.put('ORBITAL_ROOM_' + cleanRoomId, JSON.stringify(room), 21600);
    updateRoomListIndex_(cleanRoomId, room.name, room.host.name, 'active');

    return {
      ok: true,
      roomId: cleanRoomId,
      role: 'guest',
      room: {
        roomId: cleanRoomId,
        name: room.name,
        status: 'active',
        host: { name: room.host.name, email: room.host.email },
        guest: { name: guestName, email: guestEmail },
        rules: room.rules,
        firstPlayer: firstPlayer
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function pollOnlineRoom(roomId, playerRole, lastSeq) {
  if (!roomId) return { ok: false, message: 'ルームIDが必要です。' };
  const cleanRoomId = String(roomId).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const raw = cache.get('ORBITAL_ROOM_' + cleanRoomId);
  if (!raw) {
    return { ok: false, status: 'closed', message: 'ルームが存在しないか終了しました。' };
  }

  try {
    const room = JSON.parse(raw);
    const fromSeq = Number(lastSeq) || 0;
    const actions = (room.actions || []).filter(a => a.seq > fromSeq);

    return {
      ok: true,
      status: room.status,
      roomId: room.roomId,
      name: room.name,
      host: room.host ? { name: room.host.name, email: room.host.email } : null,
      guest: room.guest ? { name: room.guest.name, email: room.guest.email } : null,
      actions: actions,
      lastSeq: room.lastSeq || 0,
      updatedAt: room.updatedAt
    };
  } catch (e) {
    return { ok: false, message: 'ルーム状態の読み取りに失敗しました。' };
  }
}

function submitOnlineAction(roomId, playerRole, action) {
  if (!roomId || !action) return { ok: false, message: '引数が不足しています。' };
  const cleanRoomId = String(roomId).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const raw = cache.get('ORBITAL_ROOM_' + cleanRoomId);
    if (!raw) return { ok: false, message: 'ルームが見つかりません。' };

    const room = JSON.parse(raw);
    room.lastSeq = (room.lastSeq || 0) + 1;
    const actionEntry = {
      seq: room.lastSeq,
      by: playerRole,
      type: action.type,
      payload: action.payload || null,
      time: Date.now()
    };

    if (!room.actions) room.actions = [];
    room.actions.push(actionEntry);
    if (room.actions.length > 200) {
      room.actions = room.actions.slice(-200);
    }

    if (action.type === 'surrender' || action.type === 'game_over') {
      room.status = 'finished';
      updateRoomListIndex_(cleanRoomId, room.name, room.host ? room.host.name : '', 'finished');
    }

    room.updatedAt = new Date().toISOString();
    cache.put('ORBITAL_ROOM_' + cleanRoomId, JSON.stringify(room), 21600);

    return { ok: true, lastSeq: room.lastSeq };
  } finally {
    lock.releaseLock();
  }
}

function leaveOnlineRoom(roomId, playerRole) {
  if (!roomId) return { ok: true };
  const cleanRoomId = String(roomId).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const raw = cache.get('ORBITAL_ROOM_' + cleanRoomId);
    if (raw) {
      const room = JSON.parse(raw);
      room.status = 'finished';
      room.lastSeq = (room.lastSeq || 0) + 1;
      if (!room.actions) room.actions = [];
      room.actions.push({
        seq: room.lastSeq,
        by: playerRole,
        type: 'player_left',
        payload: { role: playerRole },
        time: Date.now()
      });
      cache.put('ORBITAL_ROOM_' + cleanRoomId, JSON.stringify(room), 3600);
      updateRoomListIndex_(cleanRoomId, room.name, room.host ? room.host.name : '', 'finished');
    }
  } catch (e) {
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
  return { ok: true };
}

/* ---------- 内部変換 ---------- */

function normalizeCard_(card) {
  const out = {};
  CARD_HEADERS.forEach(key => out[key] = card[key] == null ? '' : card[key]);

  if (!out.id) out.id = 'card_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  out.name = String(out.name).trim();
  out.category = out.category || 'たね';
  out.preEvolution = String(out.preEvolution || '').trim();
  out.type = out.type || '無';
  out.rarity = out.rarity || 'N';
  out.hp = toNumberOrBlank_(out.hp);
  out.attack1Damage = out.attack1Damage == null ? '' : String(out.attack1Damage).trim();
  out.attack2Damage = out.attack2Damage == null ? '' : String(out.attack2Damage).trim();
  out.retreat = toNumberOrBlank_(out.retreat);
  ['abilityCode','attack1Code','attack2Code'].forEach(key => {
    out[key] = normalizeEffectCode_(out[key]);
  });
  out.imageScale = toNumberOrBlank_(out.imageScale) !== '' ? Number(out.imageScale) : 100;
  out.imageFit = (out.imageFit === 'contain' || out.imageFit === 'fill') ? out.imageFit : 'cover';
  out.imageY = toNumberOrBlank_(out.imageY) !== '' ? Number(out.imageY) : 50;
  out.imageX = toNumberOrBlank_(out.imageX) !== '' ? Number(out.imageX) : 50;
  out.imageHeight = toNumberOrBlank_(out.imageHeight) !== '' ? Number(out.imageHeight) : '';
  out.artLayout = (out.artLayout === 'full' || out.artLayout === 'wide') ? out.artLayout : 'standard';
  return out;
}

function normalizeEffectCode_(value) {
  if (value === '' || value == null) return '';
  const code = String(value);
  if (code.length > 20000) throw new Error('効果コードは20000文字以内にしてください。');
  if (/\beval\s*\(|Function\s*\(|document\.|window\.|fetch\s*\(|XmlService\b|UrlFetchApp\b|ScriptApp\b/.test(code)) {
    throw new Error('カード効果コードに使用できないAPIが含まれています。');
  }
  return code;
}

function toNumberOrBlank_(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function rowToCard_(row, headers) {
  const card = {};
  const hList = Array.isArray(headers) && headers.length > 0 ? headers : CARD_HEADERS;
  hList.forEach((key, i) => {
    if (key) card[key] = row[i] == null ? '' : row[i];
  });
  return card;
}

function cardToRow_(card, headers) {
  const hList = Array.isArray(headers) && headers.length > 0 ? headers : CARD_HEADERS;
  return hList.map(key => card[key] == null ? '' : card[key]);
}

function normalizeDeck_(deck) {
  const out = {};
  out.id = deck.id || ('deck_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  out.name = String(deck.name || '').trim();
  out.description = String(deck.description || '').trim();
  out.userEmail = String(deck.userEmail || '').trim();

  let cards = Array.isArray(deck.cards) ? deck.cards : [];
  if (typeof deck.cardsJson === 'string' && deck.cardsJson && cards.length === 0) {
    try { cards = JSON.parse(deck.cardsJson); } catch (e) {}
  }

  let totalCount = 0;
  const cleanCards = [];
  cards.forEach(c => {
    if (!c || !c.id) return;
    const count = Math.max(1, Math.min(60, Number(c.count) || 1));
    totalCount += count;
    cleanCards.push({ id: String(c.id), count: count });
  });

  out.totalCount = totalCount;
  out.cardsJson = JSON.stringify(cleanCards);
  out.updatedAt = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss');
  return out;
}

function rowToDeck_(row, headers) {
  const deck = {};
  const hList = Array.isArray(headers) && headers.length > 0 ? headers : DECK_HEADERS;
  hList.forEach((key, i) => {
    if (key) deck[key] = row[i] == null ? '' : row[i];
  });
  try {
    deck.cards = deck.cardsJson ? JSON.parse(deck.cardsJson) : [];
  } catch (e) {
    deck.cards = [];
  }
  return deck;
}

function deckToRow_(deck, headers) {
  const hList = Array.isArray(headers) && headers.length > 0 ? headers : DECK_HEADERS;
  return hList.map(key => deck[key] == null ? '' : deck[key]);
}

