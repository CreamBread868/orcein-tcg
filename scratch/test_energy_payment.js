// Test script for checkEnergyRequirement logic

function normalizeType(t) {
  if (!t) return '無';
  const s = String(t).trim().toLowerCase();
  if (s === '無色' || s === '無' || s === 'colorless' || s === 'any' || s === 'normal') return '無';
  if (s === '炎' || s === '火' || s === 'fire') return '炎';
  if (s === '水' || s === 'water') return '水';
  if (s === '雷' || s === '電気' || s === 'lightning' || s === 'electric') return '雷';
  if (s === '草' || s === 'grass') return '草';
  if (s === '超' || s === 'エスパー' || s === 'psychic') return '超';
  if (s === '闘' || s === '格闘' || s === 'fighting') return '闘';
  if (s === '悪' || s === '闇' || s === 'dark' || s === 'darkness') return '悪';
  if (s === '鋼' || s === 'メタル' || s === 'metal' || s === 'steel') return '鋼';
  if (s === 'ドラゴン' || s === '竜' || s === 'dragon') return 'ドラゴン';
  if (s === '光' || s === 'light') return '光';
  if (s === '風' || s === 'wind') return '風';
  if (s === '土' || s === 'earth') return '土';
  return s;
}

function parseEnergyList(energyStr) {
  if (energyStr == null) return [];
  if (typeof energyStr === 'number') {
    return Array(Math.max(0, Math.floor(energyStr))).fill('無');
  }
  const raw = String(energyStr).trim();
  if (!raw || /^(0|なし|0個|不要|none|free|-|ー|—)$/i.test(raw)) {
    return [];
  }
  if (/^\d+$/.test(raw)) {
    return Array(Number(raw)).fill('無');
  }

  // Handle patterns like "炎 2", "炎 2個", "炎×2", "炎2" by normalizing them
  let normalized = raw.replace(/(ドラゴン|無色|colorless|lightning|fighting|darkness|psychic|dragon|grass|metal|water|fire|[草炎火水雷超闘悪鋼無光闇風土])\s*(?:[×*x]|個|\s)\s*(\d+)個?/gi, '$1$2');

  // Split by common delimiters: commas, slashes, whitespace, bullets, pluses
  const chunks = normalized.split(/[\s,、，/／・+＋|｜]+/).filter(Boolean);
  const result = [];

  const tokenRegex = /(ドラゴン|無色|colorless|lightning|fighting|darkness|psychic|dragon|grass|metal|water|fire|[草炎火水雷超闘悪鋼無光闇風土])(?:\s*[×*x]?\s*(\d+))?/gi;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Check if chunk is just a number (e.g. "2" or "2個")
    if (/^\d+個?$/.test(chunk)) {
      const num = parseInt(chunk, 10) || 0;
      for (let k = 0; k < num; k++) result.push('無');
      continue;
    }

    let matchFound = false;
    tokenRegex.lastIndex = 0;
    let m;
    while ((m = tokenRegex.exec(chunk)) !== null) {
      matchFound = true;
      const type = m[1];
      const count = m[2] ? parseInt(m[2], 10) : 1;
      for (let k = 0; k < count; k++) {
        result.push(type);
      }
    }

    if (!matchFound) {
      if (chunk.length === 1 && !/\s/.test(chunk)) {
        result.push(chunk);
      }
    }
  }

  return result;
}

function parseEnergyCount(energyStr) {
  return parseEnergyList(energyStr).length;
}

function checkEnergyRequirement(attacker, energyReq) {
  const currentCount = Number(attacker?.energy || 0);
  const reqList = parseEnergyList(energyReq);
  const reqCount = reqList.length;

  if (reqCount === 0) {
    return { canAttack: true, reqCount: 0, currentCount: currentCount, reqList: [], missingDesc: '' };
  }

  if (currentCount < reqCount) {
    return {
      canAttack: false,
      reason: 'count',
      reqCount: reqCount,
      currentCount: currentCount,
      reqList: reqList,
      missingDesc: `エネ不足 (${currentCount}/${reqCount})`
    };
  }

  // Get available energies list
  let attached = [];
  if (Array.isArray(attacker?.attachedEnergies) && attacker.attachedEnergies.length > 0) {
    attached = [...attacker.attachedEnergies];
  } else if (Array.isArray(attacker?.attachedCards)) {
    attacker.attachedCards.forEach((c) => {
      if (c && (String(c.category || '').includes('エネルギー') || !c.hp)) {
        attached.push(c.type || '無');
      }
    });
  }
  while (attached.length < currentCount) {
    attached.push(attacker?.type || '無');
  }

  const avail = attached.map((e) => normalizeType(e));

  const reqSpecific = [];
  let reqColorlessCount = 0;
  reqList.forEach((t) => {
    const norm = normalizeType(t);
    if (norm === '無') {
      reqColorlessCount++;
    } else {
      reqSpecific.push(norm);
    }
  });

  const remainingAvail = [...avail];
  const missingTypes = [];
  for (const reqType of reqSpecific) {
    const idx = remainingAvail.indexOf(reqType);
    if (idx >= 0) {
      remainingAvail.splice(idx, 1);
    } else {
      missingTypes.push(reqType);
    }
  }

  if (missingTypes.length > 0) {
    return {
      canAttack: false,
      reason: 'type',
      reqCount: reqCount,
      currentCount: currentCount,
      reqList: reqList,
      missingTypes: missingTypes,
      missingDesc: `エネ属性不一致 (必要: ${missingTypes.join(', ')})`
    };
  }

  if (remainingAvail.length < reqColorlessCount) {
    return {
      canAttack: false,
      reason: 'count',
      reqCount: reqCount,
      currentCount: currentCount,
      reqList: reqList,
      missingDesc: `エネ不足 (${currentCount}/${reqCount})`
    };
  }

  return {
    canAttack: true,
    reqCount: reqCount,
    currentCount: currentCount,
    reqList: reqList,
    missingDesc: ''
  };
}

// Test cases
const tests = [
  {
    name: '1 Colorless energy ("無色") with 1 Fire energy attached',
    attacker: { energy: 1, attachedEnergies: ['炎'], type: '炎' },
    req: '無色',
    expectedCanAttack: true
  },
  {
    name: 'Free attack ("なし") with 0 energy attached',
    attacker: { energy: 0, attachedEnergies: [], type: '草' },
    req: 'なし',
    expectedCanAttack: true
  },
  {
    name: 'Charizard "炎炎無色" with 2 Fire + 1 Water energy',
    attacker: { energy: 3, attachedEnergies: ['炎', '炎', '水'], type: '炎' },
    req: '炎炎無色',
    expectedCanAttack: true
  },
  {
    name: 'Charizard "炎,炎,無色" with 1 Fire + 2 Water energy (type mismatch)',
    attacker: { energy: 3, attachedEnergies: ['炎', '水', '水'], type: '炎' },
    req: '炎,炎,無色',
    expectedCanAttack: false,
    expectedReason: 'type'
  },
  {
    name: 'Pikachu "雷,雷,無" with only 2 energy attached (count insufficient)',
    attacker: { energy: 2, attachedEnergies: ['雷', '雷'], type: '雷' },
    req: '雷,雷,無',
    expectedCanAttack: false,
    expectedReason: 'count'
  },
  {
    name: 'Pikachu "雷,雷,無" with 2 Lightning + 1 any energy',
    attacker: { energy: 3, attachedEnergies: ['雷', '雷', '闘'], type: '雷' },
    req: '雷,雷,無',
    expectedCanAttack: true
  },
  {
    name: 'Pure count requirement (2) with 2 energies of any type',
    attacker: { energy: 2, attachedEnergies: ['水', '草'], type: '水' },
    req: '2',
    expectedCanAttack: true
  },
  {
    name: 'Concatenated Japanese punctuation "炎、炎、無色" with 3 Fire',
    attacker: { energy: 3, attachedEnergies: ['炎', '炎', '炎'], type: '炎' },
    req: '炎、炎、無色',
    expectedCanAttack: true
  }
];

let failed = 0;
for (const t of tests) {
  const res = checkEnergyRequirement(t.attacker, t.req);
  if (res.canAttack !== t.expectedCanAttack) {
    console.error(`FAIL: ${t.name}: expected canAttack=${t.expectedCanAttack}, got ${res.canAttack} (desc: ${res.missingDesc})`);
    failed++;
  } else if (t.expectedReason && res.reason !== t.expectedReason) {
    console.error(`FAIL: ${t.name}: expected reason=${t.expectedReason}, got ${res.reason}`);
    failed++;
  } else {
    console.log(`PASS: ${t.name} => canAttack=${res.canAttack} (${res.missingDesc || 'OK'})`);
  }
}

if (failed === 0) {
  console.log('\nALL ENERGY PAYMENT TESTS PASSED!');
} else {
  console.error(`\n${failed} TESTS FAILED!`);
  process.exit(1);
}
