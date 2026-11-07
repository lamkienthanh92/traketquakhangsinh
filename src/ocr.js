/* OCR trong trình duyệt cho phiếu scan/ảnh chụp (Tesseract.js). Ảnh và văn bản không gửi đi đâu:
 * chỉ tải thư viện và mô hình ngôn ngữ (tiếng Anh + tiếng Việt) từ CDN ở lần dùng đầu tiên.
 * Độ chính xác của OCR đổi theo độ phân giải (đã thấy sót dòng hoặc nhầm ký tự ở một số mức),
 * nên mỗi trang được đọc ba lần ở ba độ phân giải gần nhau; việc gộp và cảnh báo nằm ở engine (mergeReads). */
(function (root) {
  'use strict';
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  // Cạnh dài của ảnh đưa vào OCR (px). Đã đo trên phiếu thật khổ A4 với Tesseract.js: 2400 đọc đủ 11/11 dòng, 2000 và 2200 sót 1 dòng,
  // 1800 sót 3 dòng, 1400 nhầm ≤ thành <, còn 2800 trở lên đọc hỏng bảng. Vì vậy đọc ba lần quanh mức 2400 rồi gộp (biểu quyết).
  const PASS_SIZES = [2400, 2200, 2000];
  let workerP = null;
  let status = () => {};

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (root.Tesseract) return resolve();
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Không tải được bộ OCR (cần internet ở lần dùng đầu). Có thể dùng ô "Dán văn bản".'));
      document.head.appendChild(s);
    });
  }

  // một bước OCR treo (mạng chậm, CDN bị chặn, worker không khởi động) phải báo lỗi chứ không được để app quay mãi
  function withTimeout(promise, ms, msg) {
    let t;
    return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); })]).finally(() => clearTimeout(t));
  }

  function getWorker() {
    if (workerP) return workerP;
    workerP = withTimeout((async () => {
      await loadScript(TESS_URL);
      status('đang tải mô hình OCR tiếng Việt + Anh (lần đầu có thể mất vài chục giây)…');
      const w = await root.Tesseract.createWorker(['eng', 'vie'], 1, {
        logger: (m) => { if (m && m.status === 'recognizing text' && typeof m.progress === 'number') status(`đang đọc ${Math.round(m.progress * 100)}%`); },
      });
      await w.setParameters({ preserve_interword_spaces: '1' });
      return w;
    })(), 180000, 'Bộ OCR không khởi động được sau 3 phút (mạng chậm hoặc CDN jsdelivr/tessdata bị chặn). Có thể dùng ô "Dán văn bản".');
    workerP.catch(() => { workerP = null; });
    return workerP;
  }

  async function recognize(canvas, psm) {
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: String(psm) });
    const r = await withTimeout(w.recognize(canvas), 180000, 'OCR một trang quá 3 phút, đã dừng.');
    return (r && r.data && r.data.text) || '';
  }

  function newCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }
  const release = (c) => { try { c.width = 1; c.height = 1; } catch (e) { /* ignore */ } };

  function rotate(canvas, deg) {
    const c = document.createElement('canvas');
    c.width = canvas.height; c.height = canvas.width;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return c;
  }

  /* Trả về danh sách trang; mỗi trang có render(longSide) -> canvas. */
  async function openPages(file) {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    if (isPdf) {
      const lib = root.pdfjsLib;
      if (!lib) throw new Error('Thư viện đọc PDF chưa tải được (kiểm tra mạng).');
      const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const pages = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        pages.push({
          async render(longSide) {
            const v1 = page.getViewport({ scale: 1 });
            const scale = longSide / Math.max(v1.width, v1.height);
            const vp = page.getViewport({ scale });
            const c = newCanvas(vp.width, vp.height);
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            return c;
          },
        });
      }
      return pages;
    }
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Không mở được ảnh.')); i.src = url; });
    return [{
      async render(longSide) {
        const k = longSide / Math.max(img.naturalWidth, img.naturalHeight);
        const c = newCanvas(img.naturalWidth * k, img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c;
      },
      done() { URL.revokeObjectURL(url); },
    }];
  }

  /* opts: { onStatus(text), score(text) -> số dòng kháng sinh đọc được }.
     Trả về { texts: [văn bản mỗi lần đọc], preview: dataURL ảnh trang 1 } */
  async function read(file, opts) {
    opts = opts || {};
    status = opts.onStatus || (() => {});
    const score = opts.score || (() => 1);
    const pages = await openPages(file);
    const texts = [];
    let preview = '';
    try {
      for (let k = 0; k < PASS_SIZES.length; k++) {
        let joined = '';
        for (let p = 0; p < pages.length; p++) {
          status(`lần đọc ${k + 1}/${PASS_SIZES.length}, trang ${p + 1}/${pages.length}…`);
          const canvas = await pages[p].render(PASS_SIZES[k]);
          if (k === 0 && p === 0) {
            const pv = newCanvas(canvas.width * (1400 / Math.max(canvas.width, canvas.height)), canvas.height * (1400 / Math.max(canvas.width, canvas.height)));
            pv.getContext('2d').drawImage(canvas, 0, 0, pv.width, pv.height);
            preview = pv.toDataURL('image/jpeg', 0.85); release(pv);
          }
          // PSM 4 (một cột, kích thước đổi) đọc bảng sạch nhất khi thử; nếu ít dòng thì thử PSM 6 rồi 3
          let best = await recognize(canvas, 4), bestScore = score(best);
          for (const psm of [6, 3]) {
            if (bestScore >= 2) break;
            const t = await recognize(canvas, psm); const sc = score(t);
            if (sc > bestScore) { best = t; bestScore = sc; }
          }
          // ảnh chụp bị xoay: chỉ thử khi chưa đọc được dòng nào
          if (bestScore === 0 && k === 0) {
            for (const deg of [90, 270]) {
              const rc = rotate(canvas, deg);
              const t = await recognize(rc, 4); release(rc);
              const sc = score(t);
              if (sc > bestScore) { best = t; bestScore = sc; }
            }
          }
          joined += best + '\n';
          release(canvas);
        }
        texts.push(joined);
      }
    } finally {
      pages.forEach((pg) => { if (pg.done) pg.done(); });
    }
    return { texts, preview };
  }

  async function close() {
    if (!workerP) return;
    try { const w = await workerP; await w.terminate(); } catch (e) { /* ignore */ }
    workerP = null;
  }

  root.AstOCR = { read, close, PASS_SIZES };
})(typeof window !== 'undefined' ? window : globalThis);
