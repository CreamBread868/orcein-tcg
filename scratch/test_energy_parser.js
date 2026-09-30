// Test script for energy parsing logic
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
      // Fallback for unrecognized single token
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

const testCases = [
  { input: null, expectedCount: 0 },
  { input: undefined, expectedCount: 0 },
  { input: '', expectedCount: 0 },
  { input: 'なし', expectedCount: 0 },
  { input: '0', expectedCount: 0 },
  { input: '0個', expectedCount: 0 },
  { input: '-', expectedCount: 0 },
  { input: '不要', expectedCount: 0 },
  { input: 0, expectedCount: 0 },
  { input: 1, expectedCount: 1 },
  { input: 2, expectedCount: 2 },
  { input: '1', expectedCount: 1 },
  { input: '2', expectedCount: 2 },
  { input: '無色', expectedCount: 1, expectedTokens: ['無色'] },
  { input: '無', expectedCount: 1, expectedTokens: ['無'] },
  { input: 'ドラゴン', expectedCount: 1, expectedTokens: ['ドラゴン'] },
  { input: '雷', expectedCount: 1, expectedTokens: ['雷'] },
  { input: '炎,炎,無', expectedCount: 3, expectedTokens: ['炎', '炎', '無'] },
  { input: '炎,炎,無色', expectedCount: 3, expectedTokens: ['炎', '炎', '無色'] },
  { input: '炎、炎、無色', expectedCount: 3, expectedTokens: ['炎', '炎', '無色'] },
  { input: '炎，炎，無', expectedCount: 3, expectedTokens: ['炎', '炎', '無'] },
  { input: '炎 炎 無色', expectedCount: 3, expectedTokens: ['炎', '炎', '無色'] },
  { input: '炎/炎/無', expectedCount: 3, expectedTokens: ['炎', '炎', '無'] },
  { input: '炎炎無色', expectedCount: 3, expectedTokens: ['炎', '炎', '無色'] },
  { input: '雷雷無', expectedCount: 3, expectedTokens: ['雷', '雷', '無'] },
  { input: '無色無色', expectedCount: 2, expectedTokens: ['無色', '無色'] },
  { input: '草草草', expectedCount: 3, expectedTokens: ['草', '草', '草'] },
  { input: '炎2', expectedCount: 2, expectedTokens: ['炎', '炎'] },
  { input: '雷×3', expectedCount: 3, expectedTokens: ['雷', '雷', '雷'] },
  { input: '炎2無1', expectedCount: 3, expectedTokens: ['炎', '炎', '無'] },
  { input: '無色2', expectedCount: 2, expectedTokens: ['無色', '無色'] },
  { input: '炎 2個', expectedCount: 2, expectedTokens: ['炎', '炎'] },
];

let failed = 0;
for (const tc of testCases) {
  const tokens = parseEnergyList(tc.input);
  const count = parseEnergyCount(tc.input);
  const countOk = count === tc.expectedCount;
  let tokensOk = true;
  if (tc.expectedTokens) {
    tokensOk = JSON.stringify(tokens) === JSON.stringify(tc.expectedTokens);
  }
  if (!countOk || !tokensOk) {
    console.error(`FAIL: input="${tc.input}", got count=${count}, tokens=${JSON.stringify(tokens)}, expected count=${tc.expectedCount}, tokens=${JSON.stringify(tc.expectedTokens)}`);
    failed++;
  } else {
    console.log(`PASS: input="${tc.input}" => count=${count}, tokens=${JSON.stringify(tokens)}`);
  }
}

if (failed === 0) {
  console.log('\nALL TEST CASES PASSED!');
} else {
  console.error(`\n${failed} TEST CASES FAILED!`);
  process.exit(1);
}
