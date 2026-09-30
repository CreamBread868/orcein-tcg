const CONFIG = {
  SPREADSHEET_ID: '', // 空欄なら、このGASプロジェクトに紐づくスプレッドシートを使用
  CARD_SHEET: 'Cards',
  DECK_SHEET: 'Decks',
  USER_SHEET: 'Users',
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

const USER_HEADERS = [
  'email', 'displayName', 'avatar', 'createdAt', 'updatedAt'
];

/**
 * getUserProfile — Gmailアドレスに基づくユーザープロフィール取得
 */
function getUserProfile(userEmail) {
  let email = String(userEmail || '').trim().toLowerCase();
  if (!email) {
    try {
      email = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    } catch (e) {
      email = '';
    }
  }
  if (!email) {
    email = 'player@gmail.com';
  }

  try {
    const sheet = ensureUserSheet_();
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toLowerCase() === email) {
        const cDate = rows[i][3] ? (rows[i][3] instanceof Date ? rows[i][3].toISOString() : String(rows[i][3])) : '';
        const uDate = rows[i][4] ? (rows[i][4] instanceof Date ? rows[i][4].toISOString() : String(rows[i][4])) : '';
        return {
          email: String(rows[i][0]),
          displayName: String(rows[i][1] || rows[i][0].split('@')[0]),
          avatar: String(rows[i][2] || '👤'),
          createdAt: cDate,
          updatedAt: uDate,
          isLoggedIn: true
        };
      }
    }
    const defaultName = email.split('@')[0] || 'プレイヤー';
    const now = new Date().toISOString();
    const newProfile = {
      email: email,
      displayName: defaultName,
      avatar: '👤',
      createdAt: now,
      updatedAt: now,
      isLoggedIn: true
    };
    sheet.appendRow([email, defaultName, '👤', now, now]);
    return newProfile;
  } catch (e) {
    console.warn('getUserProfile error:', e);
    return {
      email: email,
      displayName: email.split('@')[0] || 'プレイヤー',
      avatar: '👤',
      isLoggedIn: !!email
    };
  }
}

function saveUserProfile(profile) {
  if (!profile || !profile.email) return { ok: false, message: 'ユーザーEmailが必要です。' };
  const email = String(profile.email).trim().toLowerCase();
  const displayName = String(profile.displayName || email.split('@')[0]).trim();
  const avatar = String(profile.avatar || '👤').trim();
  const now = new Date().toISOString();

  try {
    const sheet = ensureUserSheet_();
    const rows = sheet.getDataRange().getValues();
    let foundRow = -1;
    let createdDate = now;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toLowerCase() === email) {
        foundRow = i + 1;
        createdDate = rows[i][3] ? (rows[i][3] instanceof Date ? rows[i][3].toISOString() : String(rows[i][3])) : now;
        break;
      }
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, 2, 1, 4).setValues([[displayName, avatar, createdDate, now]]);
    } else {
      sheet.appendRow([email, displayName, avatar, now, now]);
    }

    return {
      ok: true,
      profile: {
        email: email,
        displayName: displayName,
        avatar: avatar,
        createdAt: createdDate,
        updatedAt: now,
        isLoggedIn: true
      }
    };
  } catch (e) {
    console.error('saveUserProfile error:', e);
    return { ok: false, message: '保存中にエラーが発生しました: ' + (e.message || e) };
  }
}

function getAllUsers() {
  try {
    const sheet = ensureUserSheet_();
    const rows = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0]) {
        list.push({
          email: String(rows[i][0]),
          displayName: String(rows[i][1] || rows[i][0].split('@')[0]),
          avatar: String(rows[i][2] || '👤')
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * getCurrentUser — ログイン中のGoogleアカウント(Gmail)を取得
 */
function getCurrentUser(userEmail) {
  return getUserProfile(userEmail);
}

/**
 * doGet — GASウェブアプリのエントリポイント。
 */
function doGet() {
  try {
    ensureCardSheet_();
    ensureDeckSheet_();
    ensureUserSheet_();
    ensureUpdateSheet_();
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

function ensureUserSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.USER_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.USER_SHEET);

  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missingHeaders = USER_HEADERS.filter(h => !existingHeaders.includes(h));
  if (missingHeaders.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  return sheet;
}

function ensureUpdateSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('Updates');
  if (!sheet) sheet = ss.insertSheet('Updates');
  if (sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([['id', 'version', 'title', 'notes', 'publishedAt', 'syncCards']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- アプデ配信 (App Update Distribution) ---------- */

function publishAppUpdate(updateData, adminToken) {
  if (!updateData || !updateData.version || !updateData.title) {
    throw new Error('バージョン番号とアップデートタイトルは必須です。');
  }
  const sheet = ensureUpdateSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const version = String(updateData.version).trim();
    const title = String(updateData.title).trim();
    const notes = String(updateData.notes || '').trim();
    const syncCards = !!updateData.syncCards;
    const now = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss');
    const updateObj = {
      id: 'upd_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10),
      version: version,
      title: title,
      notes: notes,
      publishedAt: now,
      syncCards: syncCards
    };

    sheet.appendRow([updateObj.id, updateObj.version, updateObj.title, updateObj.notes, updateObj.publishedAt, syncCards ? 'TRUE' : 'FALSE']);

    const cache = CacheService.getScriptCache();
    safeCachePut_(cache, 'ORBITAL_LATEST_UPDATE', updateObj, 86400 * 7);

    if (syncCards) {
      try {
        cache.remove('ORBITAL_ALL_CARDS_RAW');
        cache.remove('ORBITAL_ALL_DECKS_RAW');
      } catch (e) {}
    }

    return { ok: true, update: updateObj };
  } catch (e) {
    console.error('publishAppUpdate error:', e);
    return { ok: false, message: '配信処理エラー: ' + (e.message || e) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getLatestAppUpdate() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('ORBITAL_LATEST_UPDATE');
    if (cached) {
      return { ok: true, update: JSON.parse(cached) };
    }
    const sheet = ensureUpdateSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { ok: true, update: null };
    }
    const row = sheet.getRange(lastRow, 1, 1, 6).getValues()[0];
    const updateObj = {
      id: String(row[0]),
      version: String(row[1]),
      title: String(row[2]),
      notes: String(row[3]),
      publishedAt: row[4] instanceof Date ? Utilities.formatDate(row[4], 'JST', 'yyyy-MM-dd HH:mm:ss') : String(row[4]),
      syncCards: String(row[5]).toUpperCase() === 'TRUE'
    };
    safeCachePut_(cache, 'ORBITAL_LATEST_UPDATE', updateObj, 86400 * 7);
    return { ok: true, update: updateObj };
  } catch (e) {
    return { ok: true, update: null };
  }
}

/* ---------- カード・デッキCRUD ---------- */

function getDecks(userEmail) {
  try {
    const sheet = ensureDeckSheet_();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return rows
      .filter(row => row.some(v => v !== ''))
      .map(row => rowToDeck_(row, headers));
  } catch (err) {
    console.error('getDecks error:', err);
    return [];
  }
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

function sanitizeCardForCache_(c) {
  if (!c) return null;
  var img = String(c.image || '');
  if (img.length > 300 || img.indexOf('cdn.discordapp.com') !== -1) {
    img = '';
  }
  return {
    id: String(c.id || ''),
    name: String(c.name || ''),
    category: String(c.category || ''),
    type: String(c.type || ''),
    rarity: String(c.rarity || ''),
    hp: c.hp != null ? c.hp : '',
    abilityName: String(c.abilityName || ''),
    abilityText: String(c.abilityText || ''),
    abilityCode: String(c.abilityCode || ''),
    attack1Name: String(c.attack1Name || ''),
    attack1Damage: c.attack1Damage != null ? c.attack1Damage : '',
    attack1Energy: String(c.attack1Energy || ''),
    attack1Text: String(c.attack1Text || ''),
    attack1Code: String(c.attack1Code || ''),
    attack2Name: String(c.attack2Name || ''),
    attack2Damage: c.attack2Damage != null ? c.attack2Damage : '',
    attack2Energy: String(c.attack2Energy || ''),
    attack2Text: String(c.attack2Text || ''),
    attack2Code: String(c.attack2Code || ''),
    weakness: String(c.weakness || ''),
    resistance: String(c.resistance || ''),
    retreat: c.retreat != null ? c.retreat : '',
    preEvolution: String(c.preEvolution || ''),
    image: img,
    count: c.count || 1
  };
}

function sanitizeDeckForCache_(deck) {
  if (!Array.isArray(deck)) return [];
  return deck.map(sanitizeCardForCache_).filter(Boolean);
}

function safeCachePut_(cache, key, dataObj, expirationSeconds) {
  try {
    var str = JSON.stringify(dataObj);
    var originalLen = str.length;
    if (str.length > 70000 && dataObj && Array.isArray(dataObj.actions)) {
      if (dataObj.actions.length > 12) {
        dataObj.actions = dataObj.actions.slice(-12);
      }
      str = JSON.stringify(dataObj);
    }
    if (str.length > 70000 && dataObj) {
      // デッキやアクション履歴から重い画像・効果コード等のデータをストリップ
      if (dataObj.host && Array.isArray(dataObj.host.deck)) {
        dataObj.host.deck.forEach(function(c) { if (c) { c.image = ''; c.abilityCode = ''; c.attack1Code = ''; c.attack2Code = ''; } });
      }
      if (dataObj.guest && Array.isArray(dataObj.guest.deck)) {
        dataObj.guest.deck.forEach(function(c) { if (c) { c.image = ''; c.abilityCode = ''; c.attack1Code = ''; c.attack2Code = ''; } });
      }
      if (Array.isArray(dataObj.actions)) {
        dataObj.actions.forEach(function(act) {
          if (act && act.payload) {
            if (act.type === 'game_start') {
              if (Array.isArray(act.payload.hostDeck)) act.payload.hostDeck.forEach(function(c) { if (c) c.image = ''; });
              if (Array.isArray(act.payload.guestDeck)) act.payload.guestDeck.forEach(function(c) { if (c) c.image = ''; });
            }
          }
        });
      }
      str = JSON.stringify(dataObj);
    }

    if (str.length > 95000) {
      console.warn('⚠️ [GAS Cache Alert] Key: ' + key + ' data size (' + str.length + ' chars) is near 100KB limit! Truncating actions.');
      if (dataObj && Array.isArray(dataObj.actions) && dataObj.actions.length > 5) {
        dataObj.actions = dataObj.actions.slice(-5);
        str = JSON.stringify(dataObj);
      }
    }

    cache.put(key, str, expirationSeconds || 21600);
    console.log('📦 [GAS Cache Put] Key: ' + key + ' | Size: ' + str.length + ' bytes (orig: ' + originalLen + ')');
  } catch (e) {
    console.error('❌ [GAS safeCachePut_ Error] Key: ' + key + ' | Error: ' + (e.message || e), e);
  }
}

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
    safeCachePut_(cache, 'ORBITAL_ROOM_LIST', list.slice(0, 30), 21600);
  } catch (e) {
    console.warn('Failed to update room list index:', e);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function createOnlineRoom(deck, roomName, userEmail, rules) {
  if (!deck) throw new Error('対戦デッキが必要です。');
  const hostProfile = getUserProfile(userEmail);
  const hostEmail = hostProfile.email || userEmail || '';
  const hostName = (hostProfile.avatar ? hostProfile.avatar + ' ' : '') + (hostProfile.displayName || 'プレイヤー');
  const roomId = 'ROOM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const name = String(roomName || (hostProfile.displayName + 'の部屋')).trim();
  const cleanDeck = sanitizeDeckForCache_(deck);
  const now = Date.now();

  const room = {
    roomId: roomId,
    name: name,
    status: 'waiting', // waiting | active | finished
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hostConnectedAt: now,
    hostReady: true,
    guestConnectedAt: null,
    guestReady: false,
    rules: rules || { prizeCount: 6 },
    host: {
      role: 'host',
      email: hostEmail,
      name: hostName,
      deck: cleanDeck
    },
    guest: null,
    turnPlayer: 'host',
    turnNumber: 1,
    actions: [],
    lastSeq: 0
  };

  const cache = CacheService.getScriptCache();
  safeCachePut_(cache, 'ORBITAL_ROOM_' + roomId, room, 21600);
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

  try {
    lock.waitLock(5000);
    const raw = cache.get('ORBITAL_ROOM_' + cleanRoomId);
    if (!raw) {
      return { ok: false, message: 'ルームが見つかりません。期限切れか解散された可能性があります。' };
    }
    const room = JSON.parse(raw);
    if (room.status !== 'waiting' && room.status !== 'connecting') {
      return { ok: false, message: 'このルームはすでに対戦中か終了しています。' };
    }

    const guestProfile = getUserProfile(userEmail);
    const guestEmail = guestProfile.email || userEmail || '';
    const guestName = (guestProfile.avatar ? guestProfile.avatar + ' ' : '') + (guestProfile.displayName || 'ゲスト');
    const cleanGuestDeck = sanitizeDeckForCache_(deck);

    const now = Date.now();
    room.guest = {
      role: 'guest',
      email: guestEmail,
      name: guestName,
      deck: cleanGuestDeck
    };
    room.guestConnectedAt = now;
    room.guestReady = true;
    if (!room.hostConnectedAt) {
      room.hostConnectedAt = now;
      room.hostReady = true;
    }

    // 接続確認フェーズ (双方向接続待ち)
    room.status = 'connecting';
    room.updatedAt = new Date().toISOString();

    safeCachePut_(cache, 'ORBITAL_ROOM_' + cleanRoomId, room, 21600);
    updateRoomListIndex_(cleanRoomId, room.name, room.host ? room.host.name : 'ホスト', 'connecting');

    return {
      ok: true,
      roomId: cleanRoomId,
      role: 'guest',
      status: room.status,
      room: {
        roomId: cleanRoomId,
        name: room.name,
        status: room.status,
        host: { name: room.host ? room.host.name : 'ホスト', email: room.host ? room.host.email : '' },
        guest: { name: guestName, email: guestEmail },
        rules: room.rules
      }
    };
  } catch (e) {
    console.error('joinOnlineRoom error:', e);
    return { ok: false, message: 'ルーム参加中にエラーが発生しました: ' + (e.message || e) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function pollOnlineRoom(roomId, playerRole, lastSeq) {
  if (!roomId) return { ok: false, message: 'ルームIDが必要です。' };
  const cleanRoomId = String(roomId).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(3000);
    const raw = cache.get('ORBITAL_ROOM_' + cleanRoomId);
    if (!raw) {
      return { ok: false, status: 'closed', message: 'ルームが存在しないか終了しました。' };
    }

    const room = JSON.parse(raw);
    const now = Date.now();

    // 接続タイムスタンプの更新
    if (playerRole === 'host') {
      room.hostConnectedAt = now;
      room.hostReady = true;
    } else if (playerRole === 'guest') {
      room.guestConnectedAt = now;
      room.guestReady = true;
    }

    const isHostLive = !!(room.hostReady && room.hostConnectedAt && (now - room.hostConnectedAt < 30000));
    const isGuestLive = !!(room.guestReady && room.guestConnectedAt && (now - room.guestConnectedAt < 30000));

    // 双方向の接続が確認できたら試合開始！ (game_start アクションを発行)
    if ((room.status === 'connecting' || room.status === 'waiting') && isHostLive && isGuestLive && room.guest) {
      room.status = 'active';
      const firstPlayer = Math.random() < 0.5 ? 'host' : 'guest';
      const seed = Math.floor(Math.random() * 1000000000);
      room.turnPlayer = firstPlayer;
      room.turnNumber = 1;
      room.lastSeq = (room.lastSeq || 0) + 1;
      if (!room.actions) room.actions = [];
      room.actions.push({
        seq: room.lastSeq,
        by: 'system',
        type: 'game_start',
        payload: {
          firstPlayer: firstPlayer,
          seed: seed,
          hostDeck: room.host ? room.host.deck : [],
          guestDeck: room.guest ? room.guest.deck : [],
          rules: room.rules,
          hostName: room.host ? room.host.name : 'ホスト',
          guestName: room.guest ? room.guest.name : 'ゲスト'
        },
        time: now
      });
      console.log('🎮 [GAS Match Start] Room:', cleanRoomId, 'FirstPlayer:', firstPlayer, 'Seq:', room.lastSeq);
      updateRoomListIndex_(cleanRoomId, room.name, room.host ? room.host.name : 'ホスト', 'active');
    }

    room.updatedAt = new Date().toISOString();
    safeCachePut_(cache, 'ORBITAL_ROOM_' + cleanRoomId, room, 21600);

    const fromSeq = Number(lastSeq) || 0;
    const actions = (room.actions || []).filter(a => a.seq > fromSeq);

    console.log('📥 [GAS Poll] Room:', cleanRoomId, '| Role:', playerRole, '| ClientReqSeq:', fromSeq, '| ReturnActions:', actions.length, '| ServerLastSeq:', room.lastSeq || 0);

    return {
      ok: true,
      status: room.status,
      roomId: room.roomId,
      name: room.name,
      hostConnected: isHostLive,
      guestConnected: isGuestLive,
      host: room.host ? { name: room.host.name, email: room.host.email } : null,
      guest: room.guest ? { name: room.guest.name, email: room.guest.email } : null,
      actions: actions,
      lastSeq: room.lastSeq || 0,
      updatedAt: room.updatedAt
    };
  } catch (e) {
    console.error('❌ [GAS Poll Error] Room:', cleanRoomId, '| Error:', e);
    return { ok: false, message: 'ルーム状態の読み取りに失敗しました: ' + (e.message || e) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function submitOnlineAction(roomId, playerRole, action) {
  if (!roomId || !action) return { ok: false, message: '引数が不足しています。' };
  const cleanRoomId = String(roomId).trim().toUpperCase();
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);
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
    if (room.actions.length > 25) {
      room.actions = room.actions.slice(-25);
    }

    if (action.type === 'surrender' || action.type === 'game_over') {
      room.status = 'finished';
      updateRoomListIndex_(cleanRoomId, room.name, room.host ? room.host.name : '', 'finished');
    }

    room.updatedAt = new Date().toISOString();
    safeCachePut_(cache, 'ORBITAL_ROOM_' + cleanRoomId, room, 21600);

    console.log('📤 [GAS SubmitAction] Room:', cleanRoomId, '| By:', playerRole, '| Type:', action.type, '| AssignedSeq:', room.lastSeq);
    return { ok: true, lastSeq: room.lastSeq };
  } catch (e) {
    console.error('❌ [GAS SubmitAction Error] Room:', cleanRoomId, '| Type:', action ? action.type : 'unknown', '| Error:', e);
    return { ok: false, message: 'アクション送信エラー: ' + (e.message || e) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
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
      safeCachePut_(cache, 'ORBITAL_ROOM_' + cleanRoomId, room, 3600);
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
    if (!c) return;
    const cId = String(c.id || c.cardId || c.name || '').trim();
    if (!cId) return;
    const count = Math.max(1, Math.min(60, Number(c.count) || 1));
    totalCount += count;
    cleanCards.push({ id: cId, name: String(c.name || '').trim(), count: count });
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
    let val = row[i] == null ? '' : row[i];
    if (val instanceof Date) {
      val = Utilities.formatDate(val, 'JST', 'yyyy-MM-dd HH:mm:ss');
    }
    deck[key] = val;
  });
  try {
    let rawJson = String(deck.cardsJson || '').trim();
    if (rawJson.startsWith("'")) rawJson = rawJson.substring(1);
    deck.cards = rawJson ? JSON.parse(rawJson) : [];
  } catch (e) {
    deck.cards = [];
  }
  return deck;
}

function deckToRow_(deck, headers) {
  const hList = Array.isArray(headers) && headers.length > 0 ? headers : DECK_HEADERS;
  return hList.map(key => deck[key] == null ? '' : deck[key]);
}

