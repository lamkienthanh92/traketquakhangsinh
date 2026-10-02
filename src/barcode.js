/* Code 128 (subset B) barcode as SVG markup or PNG bytes. No dependencies. */
(function (root) {
  'use strict';
  // bar/space widths (b s b s b s) for symbol values 0..105, then stop (2331112)
  const PAT = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232'];
  const STOP = '2331112';

  function clean(text) { return String(text == null ? '' : text).replace(/[^\x20-\x7e]/g, '-').slice(0, 40) || '0'; }
  /** -> string of '1'/'0' modules (quiet zone not included) */
  function bits(text) {
    const t = clean(text);
    const vals = [104];
    for (let i = 0; i < t.length; i++) vals.push(t.charCodeAt(i) - 32);
    let sum = 104;
    for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
    vals.push(sum % 103);
    let out = '';
    const emit = (p) => { for (let k = 0; k < p.length; k++) out += (k % 2 === 0 ? '1' : '0').repeat(+p[k]); };
    vals.forEach((v) => emit(PAT[v]));
    emit(STOP);
    return out;
  }
  function svg(text, o) {
    o = o || {};
    const b = bits(text), q = 10, mw = o.moduleWidth || 1.6, h = o.height || 44;
    let x = q * mw, d = '';
    for (let i = 0; i < b.length;) { let j = i; while (j < b.length && b[j] === b[i]) j++; if (b[i] === '1') d += `M${(+x.toFixed(2))} 0h${(+((j - i) * mw).toFixed(2))}v${h}h-${(+((j - i) * mw).toFixed(2))}z`; x += (j - i) * mw; i = j; }
    const w = (b.length + 2 * q) * mw;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${+w.toFixed(2)} ${h}" width="${+w.toFixed(1)}" height="${h}" role="img" aria-label="Mã vạch ${clean(text)}"><path d="${d}" fill="#000"/></svg>`;
  }

  /* ---- tiny PNG encoder (1-bit grayscale, stored deflate) ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const be32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  function chunk(type, data) {
    const t = new Uint8Array([...type].map((c) => c.charCodeAt(0)));
    const body = new Uint8Array(t.length + data.length); body.set(t, 0); body.set(data, 4);
    return [...be32(data.length), ...body, ...be32(crc32(body))];
  }
  function adler(u8) { let a = 1, b = 0; for (let i = 0; i < u8.length; i++) { a = (a + u8[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
  function png(text, o) {
    o = o || {};
    const b = bits(text), q = 10, sc = o.scale || 2, hpx = o.height || 70;
    const wpx = (b.length + 2 * q) * sc;
    const rowBytes = Math.ceil(wpx / 8);
    const row = new Uint8Array(1 + rowBytes); // filter byte 0
    row.fill(0xff, 1);
    for (let i = 0; i < b.length; i++) if (b[i] === '1') for (let s = 0; s < sc; s++) { const x = (q + i) * sc + s; row[1 + (x >> 3)] &= ~(0x80 >> (x & 7)); }
    const raw = new Uint8Array(row.length * hpx);
    for (let y = 0; y < hpx; y++) raw.set(row, y * row.length);
    // zlib stored blocks
    const blocks = []; const MAX = 65535;
    for (let p = 0; p < raw.length; p += MAX) { const part = raw.subarray(p, Math.min(p + MAX, raw.length)); const last = p + MAX >= raw.length ? 1 : 0; blocks.push(new Uint8Array([last, part.length & 255, part.length >> 8, (~part.length) & 255, ((~part.length) >> 8) & 255]), part); }
    const ad = adler(raw);
    const z = [0x78, 0x01]; blocks.forEach((bl) => bl.forEach((v) => z.push(v))); z.push(...be32(ad));
    const ihdr = new Uint8Array([...be32(wpx), ...be32(hpx), 1, 0, 0, 0, 0]);
    const out = [137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', ihdr), ...chunk('IDAT', new Uint8Array(z)), ...chunk('IEND', new Uint8Array(0))];
    return { bytes: new Uint8Array(out), width: wpx, height: hpx };
  }
  const api = { bits, svg, png, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ASTBarcode = api;
})(typeof window !== 'undefined' ? window : globalThis);
