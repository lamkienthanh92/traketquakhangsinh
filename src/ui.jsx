/* React UI – compiled to plain JS at build time (no runtime transpiler). */
const { useState, useMemo, useRef, useEffect, useCallback } = React;
const E = window.ASTEngine;

/* ------------------------------------------------------------ helpers */
async function extractPdfText(file) {
  const lib = window.pdfjsLib;
  if (!lib) throw new Error('Thư viện đọc PDF chưa tải được (kiểm tra mạng) – hãy dùng ô "Dán văn bản".');
  try { lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'; } catch (e) { /* ignore */ }
  const buf = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({ data: buf }).promise;
  let stream = '', rows = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const its = tc.items.filter((it) => typeof it.str === 'string' && it.str.trim() !== '').map((it) => ({ s: it.str, x: it.transform ? it.transform[4] : 0, y: it.transform ? it.transform[5] : 0, w: it.width || 0 }));
    // 1) content-stream order, glueing fragments of the same word
    let prev = null;
    its.forEach((it) => {
      const glue = prev && Math.abs(it.y - prev.y) < 2 && it.x - (prev.x + prev.w) < 0.6;
      stream += (glue ? '' : ' ') + it.s; prev = it;
    });
    stream += ' ';
    // 2) spatial order (top→bottom, left→right) as fallback
    const sorted = its.slice().sort((a, b) => (Math.abs(b.y - a.y) < 3 ? a.x - b.x : b.y - a.y));
    rows += sorted.map((i) => i.s).join(' ') + ' ';
  }
  return { stream, rows };
}

/* Đầu vào có thể là báo cáo Vitek (PDF chữ), phiếu kết quả của khoa (PDF chữ hoặc ảnh scan), hoặc văn bản dán. */
const IMG_RE = /\.(jpe?g|png|webp|bmp|gif)$/i;
const isImageFile = (f) => IMG_RE.test(f.name || '') || /^image\//.test(f.type || '');
const sumRows = (arr) => arr.reduce((s, i) => s + i.results.length, 0);
function parseTextSmart(t) {
  // Vitek: giữ cách gộp hai kiểu đọc PDF như trước
  if (E.detectFormat(t.stream) === 'vitek' || E.detectFormat(t.rows) === 'vitek') {
    let iso = E.parseVitekText(t.stream);
    const alt = E.parseVitekText(t.rows);
    if (alt.results.length > iso.results.length) { alt.quals = { ...iso.quals, ...alt.quals }; iso = alt; } else iso.quals = { ...alt.quals, ...iso.quals };
    iso.format = 'vitek';
    return iso.results.length || Object.keys(iso.quals).length ? [iso] : [];
  }
  const a = E.parseReport(t.stream), b = E.parseReport(t.rows);
  return sumRows(b) > sumRows(a) ? b : a;
}
// ghép các lần OCR của cùng một phiếu; chủng nào cũng được gắn cờ OCR để KTV phải đối chiếu
function mergeOcrReads(texts) {
  const reads = texts.map((t) => E.parseReport(t, { ocr: true })).filter((r) => r.length);
  if (!reads.length) return [];
  const n = reads[0].length;
  if (reads.every((r) => r.length === n)) return Array.from({ length: n }, (_, i) => E.mergeReads(reads.map((r) => r[i])));
  const best = reads.slice().sort((a, b) => sumRows(b) - sumRows(a))[0];
  return best.map((iso) => { const m = E.mergeReads([iso]); m.readWarnings.push({ k: 'passes', text: 'Các lần đọc cho số chủng khác nhau; chỉ dùng lần đọc có nhiều dòng nhất.' }); return m; });
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e2) { return false; }
  }
}

async function saveFile(name, data) {
  try {
    const d = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (d) { await d.save({ filename: name, data }); return 'saved'; }
  } catch (e) { if (e && e.code === 'declined') return 'declined'; if (e && ['extension_not_enabled', 'rejected_extension', 'too_large'].includes(e.code)) return 'unavailable'; }
  try {
    const blob = new Blob([data], { type: /\.xlsx$/i.test(name) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : /\.docx$/i.test(name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return 'fallback';
  } catch (e) { return 'failed'; }
}


/* ------------------------------------------------------------ KSNK fields */
const K = window.KSNK;
const HOSP_KEY = 'ast_hospital_v1';
const HOSP_DEFAULT = { agency: 'SỞ Y TẾ TP. HỒ CHÍ MINH', name: 'BỆNH VIỆN ĐA KHOA LÃNH BINH THĂNG', accreditation: '', lab: 'KHOA XÉT NGHIỆM', instrument: 'Vitek 2', chief: '', address: '', phone: '', web: '' };
function loadHosp() { try { return { ...HOSP_DEFAULT, ...(JSON.parse(window.localStorage.getItem(HOSP_KEY) || '{}') || {}) }; } catch (e) { return { ...HOSP_DEFAULT }; } }
function saveHosp(h) { try { window.localStorage.setItem(HOSP_KEY, JSON.stringify(h)); } catch (e) { /* storage may be unavailable */ } }
// tên khoa trên phiếu ("Khoa truyền nhiễm") -> cách ghi trong file KSNK ("Truyền Nhiễm")
function normDept(s) {
  const t = String(s || '').trim().replace(/^khoa\s+/i, '');
  if (!t) return '';
  const k = foldU(t);
  return DEPTS.find((d) => foldU(d) === k) || t;
}
const MAP_KEY = 'ast_org_group_map_v1';
function loadMap() { try { return JSON.parse(window.localStorage.getItem(MAP_KEY) || '{}') || {}; } catch (e) { return {}; } }
function saveMap(m) { try { window.localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) { /* storage may be unavailable */ } }
const SPEC_TO_ENGINE = { 'Nước tiểu': 'urine', 'Máu': 'blood', 'Đàm': 'lrt', 'Đầu ống NKQ': 'lrt', 'Mủ': 'wound', 'Dịch tiết': 'wound', 'Dịch': 'other', 'Phân': 'stool', 'Đầu CVC': 'other' };
function guessViSpecimen(src) {
  const s = (src || '').toLowerCase();
  if (!s) return '';
  if (/nkq|nội khí quản|noi khi quan|endotrach/.test(s)) return 'Đầu ống NKQ';
  if (/cvc|catheter|đầu ống|dau ong/.test(s)) return 'Đầu CVC';
  if (/phân|phan\b|stool|fec/.test(s)) return 'Phân';
  if (/dịch tiết|dich tiet|discharge|secretion/.test(s)) return 'Dịch tiết';
  const g = E.guessSpecimen(src);
  return g === 'urine' ? 'Nước tiểu' : g === 'blood' ? 'Máu' : g === 'lrt' ? 'Đàm' : g === 'wound' ? 'Mủ' : g === 'csf' || g === 'other' ? 'Dịch' : '';
}
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function printedToDmy(p) {
  const m = String(p || '').match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/);
  if (!m || !MONTHS[m[1].toLowerCase()]) return '';
  return String(m[2]).padStart(2, '0') + '/' + String(MONTHS[m[1].toLowerCase()]).padStart(2, '0') + '/' + m[3];
}
function validDmy(v) {
  const m = String(v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1];
}
const nowStamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const todayCompact = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; };
const missingOf = (it) => {
  const m = [];
  if (!it.specVi) m.push('bệnh phẩm');
  if (!validDmy(it.date)) m.push('ngày lấy mẫu');
  if (!it.dept) m.push('khoa');
  if (it.age === '') m.push('tuổi');
  if (!it.sex) m.push('giới');
  return m;
};

const STD = [0.015, 0.03, 0.06, 0.12, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
const SXT = [5, 10, 20, 40, 80, 160, 320, 640];

function ladderOf(r) {
  const bp = r.bp; if (!bp) return null;
  const series = r.def && r.def.ladder === 'sxt' ? SXT : STD;
  const near = (v) => { let b = 0, d = 1e9; series.forEach((x, i) => { const dd = Math.abs(Math.log(x) - Math.log(v)); if (dd < d) { d = dd; b = i; } }); return b; };
  const anchors = [];
  if (bp.sNone) anchors.push(near(bp.iMax)); else if (bp.noS) anchors.push(near(bp.rGt || bp.r / 2)); else anchors.push(near(bp.s));
  if (bp.r != null) anchors.push(near(bp.r));
  let lo = Math.min(...anchors) - 2, hi = Math.max(...anchors) + 2;
  if (hi - lo < 6) { lo -= 1; hi += 1; }
  lo = Math.max(0, lo); hi = Math.min(series.length - 1, hi);
  const cells = [];
  for (let i = lo; i <= hi; i++) cells.push({ v: series[i], cat: E.catOf(series[i], bp) });
  let mi = null;
  if (r.mic != null) {
    mi = near(r.mic);
    if (mi < lo) mi = lo; if (mi > hi) mi = hi;
    mi -= lo;
  }
  return { cells, mi };
}

function Ladder({ r }) {
  const L = ladderOf(r);
  if (!L) return null;
  const W = 19, G = 2, H = 14;
  const w = L.cells.length * (W + G) - G;
  const op = r.op;
  return (
    <svg className="ladder" width={w} height={H + 14} viewBox={`0 0 ${w} ${H + 14}`} role="img" aria-label={`Thang MIC, MIC ${r.micText}`}>
      {L.cells.map((c, i) => (
        <g key={i}>
          <rect className={`z z-${c.cat}`} x={i * (W + G)} y={0} width={W} height={H} rx={2} />
          <text className="lv" x={i * (W + G) + W / 2} y={H + 11} textAnchor="middle">{c.v}</text>
        </g>
      ))}
      {L.mi != null && (() => {
        const cx = L.mi * (W + G) + W / 2, cy = H / 2;
        if (op === '<=' || op === '<') return <path className="mk" d={`M${cx + 4},${cy - 4} L${cx - 4},${cy} L${cx + 4},${cy + 4} Z`} />;
        if (op === '>=' || op === '>') return <path className="mk" d={`M${cx - 4},${cy - 4} L${cx + 4},${cy} L${cx - 4},${cy + 4} Z`} />;
        return <circle className="mk" cx={cx} cy={cy} r={3.6} />;
      })()}
    </svg>
  );
}

const STDCUR = { current: 'clsi' };
function Chip({ cat }) {
  return <span className={`chip c-${cat}`}><b>{cat}</b><span>{E.catLabel(cat, STDCUR.current)}</span></span>;
}

function Pill({ kind, children }) { return <span className={`pill p-${kind}`}>{children}</span>; }

/* ------------------------------------------------------------ report sheet */
const foldU = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const DEPTS = ['Nội tổng hợp', 'Ngoại chấn thương', 'Truyền Nhiễm', 'ICU', 'Tim mạch chuyển hóa', 'Nội thần kinh', 'Ngoại tổng hợp', 'Ngoại thần kinh', 'Phụ sản', 'Nhi', 'Tai Mũi Họng'];

function Field({ label, en, children, print, wide }) {
  return (
    <div className={`fld${wide ? ' wide' : ''}`}>
      <dt>{label}{en && <span className="en">/ {en}</span>}:</dt>
      <dd><span className="no-print">{children}</span><span className="print-only">{print || ''}</span></dd>
    </div>
  );
}

const VI_CAT_EN = { S: 'Susceptible', I: 'Intermediate', SDD: 'Susceptible-dose dependent', R: 'Resistant', NS: 'Non-susceptible' };
const EU_CAT_EN = { S: 'Susceptible, standard dosing', I: 'Susceptible, increased exposure', R: 'Resistant' };
function dmyTime(stamp) { const m = String(stamp || '').match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/); return m ? { d: m[1], t: m[2] } : { d: '', t: '' }; }

function ReportSheet({ item, rep, onField, sheetRef, reviewer, showMic, showFn, showBp, hosp }) {
  const iso = item.iso;
  const printedDmy = printedToDmy(iso.printed);
  const dateBad = item.date && !validDmy(item.date);
  const sid = iso.labId || iso.patientId || '';
  const std = rep.standard || 'clsi';
  const inp = (k, label, extra) => <input value={item[k] || ''} onChange={(e) => onField({ [k]: e.target.value })} aria-label={label} {...(extra || {})} />;
  const when = dmyTime(item.approvedAt);
  const cols = 3 + (showMic ? 1 : 0) + (showBp ? 1 : 0) + 1; // name, [mic], result, [bp], unit, ins
  const rows = rep.unsupported ? (rep.raw || []).map((r) => ({ id: r.id, name: r.name, micText: r.mic, cat: r.vitek, bp: null, fnNums: [] })) : rep.reported;
  const hasUnit = showMic || showBp;
  return (
    <article className="sheet form" ref={sheetRef}>
      <header className="fm-top">
        <div className="fm-left">
          {window.HOSPITAL_LOGO && <img className="fm-logo" src={window.HOSPITAL_LOGO} alt="Logo bệnh viện" />}
          <div className="fm-hosp">
            <p className="fm-agency">{hosp.agency}</p>
            <p className="fm-name">{hosp.name}</p>
          </div>
        </div>
        <div className="fm-right">
          {hosp.accreditation && <p className="fm-accr">{hosp.accreditation}</p>}
          {sid && <div className="fm-bc"><span className="bc" dangerouslySetInnerHTML={{ __html: window.ASTBarcode.svg(sid, { height: 38, moduleWidth: 1.5 }) }} /><p className="fm-sid">SID: {sid}</p></div>}
        </div>
        {item.approved && <span className="stamp no-print">✓ Đã duyệt</span>}
      </header>
      <h2 className="fm-title">PHIẾU KẾT QUẢ KHÁNG SINH ĐỒ</h2>
      <p className="fm-sub">ANTIMICROBIAL SUSCEPTIBILITY TEST REPORT</p>

      <dl className="meta fm-meta">
        <Field label="Họ tên" en="Patient Name" print={item.name}><input value={item.name} onChange={(e) => onField({ name: e.target.value })} aria-label="Họ và tên" /></Field>
        <Field label="Giới tính" en="Sex" print={item.sex}>
          <select value={item.sex} onChange={(e) => onField({ sex: e.target.value })} aria-label="Giới"><option value="">—</option><option value="NAM">Nam</option><option value="NỮ">Nữ</option></select>
        </Field>
        <Field label="Điện thoại" en="Phone" print={item.phone}>{inp('phone', 'Điện thoại')}</Field>
        <Field label="Tuổi" en="Age" print={item.age}><input type="number" min="0" max="120" value={item.age} onChange={(e) => onField({ age: e.target.value })} aria-label="Tuổi" className="w-s" /></Field>
        <Field label="Địa chỉ" en="Address" print={item.address}>{inp('address', 'Địa chỉ')}</Field>
        <Field label="Khoa" en="Department" print={item.dept}>
          <input list="depts" value={item.dept} onChange={(e) => onField({ dept: e.target.value })} aria-label="Khoa" />
          <datalist id="depts">{DEPTS.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Chẩn đoán sơ bộ" en="Preliminary diagnosis" print={item.diagnosis}>{inp('diagnosis', 'Chẩn đoán sơ bộ')}</Field>
        <Field label="BS chỉ định" en="Requesting doctor" print={item.reqDoctor}>{inp('reqDoctor', 'BS chỉ định')}</Field>
        <Field label="Loại bệnh phẩm" en="Type of sample" print={item.specVi ? (item.csf ? item.specVi + ' (dịch não tủy)' : item.specVi) : ''}>
          <select value={item.specVi} onChange={(e) => onField({ specVi: e.target.value, csf: false, specimen: SPEC_TO_ENGINE[e.target.value] || 'unknown' })} aria-label="Bệnh phẩm">
            <option value="">Chưa chọn</option>
            {K.SPEC_VI.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {item.specVi === 'Dịch' && <label className="chk inl-chk"><input type="checkbox" checked={!!item.csf} onChange={(e) => onField({ csf: e.target.checked, specimen: e.target.checked ? 'csf' : 'other' })} /> Là dịch não tủy</label>}
        </Field>
        <Field label="Ngày lấy mẫu" en="Sampling date" print={[item.sampTime, item.date].filter(Boolean).join(' ')}>
          <input value={item.date} placeholder="dd/mm/yyyy" maxLength={10} onChange={(e) => onField({ date: e.target.value })} aria-label="Ngày lấy mẫu" className={`w-m${dateBad ? ' bad' : ''}`} />
          <input value={item.sampTime || ''} placeholder="hh:mm" maxLength={5} onChange={(e) => onField({ sampTime: e.target.value })} aria-label="Giờ lấy mẫu" className="w-s" />
          {printedDmy && !item.date && <button type="button" className="lnk inl" onClick={() => onField({ date: printedDmy })} title="Ngày in báo cáo trên Vitek – chỉ dùng nếu đúng là ngày lấy mẫu">dùng ngày in Vitek ({printedDmy})</button>}
          {iso.performedDmy && !item.date && <button type="button" className="lnk inl" onClick={() => onField({ date: iso.performedDmy })} title="Ngày thực hiện ghi trên phiếu của khoa – chỉ dùng nếu đúng là ngày lấy mẫu">dùng ngày thực hiện trên phiếu ({iso.performedDmy})</button>}
          {item.dateFromPhieu && item.date === iso.performedDmy && !dateBad && <span className="small"> lấy từ “Thời gian thực hiện” trên phiếu, sửa nếu khác ngày lấy mẫu</span>}
          {dateBad && <span className="warn-t"> định dạng dd/mm/yyyy</span>}
        </Field>
        <Field label="Tình trạng mẫu" en="Sample status" print={item.sampleStatus}>
          <select value={item.sampleStatus || ''} onChange={(e) => onField({ sampleStatus: e.target.value })} aria-label="Tình trạng mẫu"><option value="">—</option><option value="Đạt">Đạt</option><option value="Không đạt">Không đạt</option></select>
        </Field>
        <Field label="Giờ nhận mẫu" en="Receiver time" print={item.recvTime}>{inp('recvTime', 'Giờ nhận mẫu', { placeholder: 'hh:mm dd/mm/yyyy' })}</Field>
        <Field label="Người lấy mẫu" en="Sampling" print={item.sampler}>{inp('sampler', 'Người lấy mẫu')}</Field>
        <div className="fld"><dt>Mã BN<span className="en">/ Patient ID</span>:</dt><dd>{iso.patientId || ''}</dd></div>
        <Field label="Người nhận mẫu" en="Receiver" print={item.receiver}>{inp('receiver', 'Người nhận mẫu')}</Field>
        <div className="fld"><dt>Số phiếu<span className="en">/ Lab ID</span>:</dt><dd>{iso.labId || ''}</dd></div>
      </dl>

      {rep.unsupported && (
        <div className="note n-warn"><p>Kết quả bên dưới là diễn giải gốc của Vitek, chưa lọc theo CLSI/EUCAST.</p></div>
      )}
      {!rep.unsupported && item.specVi === '' && (
        <div className="note n-info no-print"><p>Chưa chọn bệnh phẩm: các kháng sinh chỉ dành cho nước tiểu (vd. nitrofurantoin) đang được ẩn.</p></div>
      )}

      <table className="res fm-res">
        <thead>
          <tr>
            <th className="l">TÊN KHÁNG SINH<br /><small>(ANTIBIOTIC)</small></th>
            {showMic && <th>MIC<br /><small>(MIC)</small></th>}
            <th>KẾT QUẢ<br /><small>(RESULT)</small></th>
            {showBp && <th>NGƯỠNG DIỄN GIẢI<br /><small>(BREAKPOINT)</small></th>}
            {hasUnit && <th>ĐƠN VỊ<br /><small>(UNIT)</small></th>}
            <th>MÁY XN<br /><small>(INS)</small></th>
          </tr>
        </thead>
        <tbody>
          <tr className="sec"><td colSpan={cols + (hasUnit ? 0 : -0)}>VI SINH <small>(MICROBIOLOGY)</small></td></tr>
          <tr className="sub"><td colSpan={cols}>Kháng sinh đồ – vi khuẩn phân lập: <i>{iso.organism || '(chưa rõ vi khuẩn)'}</i> <small>[{hosp.instrument} · {rep.standardLabel || E.EDITION}]</small></td></tr>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="ag l"><span className="agname">{r.name}</span>{showFn && r.fnNums && r.fnNums.length > 0 && <sup className="fnm">{r.fnNums.join(',')}</sup>}</td>
              {showMic && <td className="mic">{r.micText}</td>}
              <td className="rs">{r.cat ? <span className={`rv rv-${r.cat}`}>{r.cat}</span> : '—'}</td>
              {showBp && <td className="bpc">{r.bp ? E.bpText(r.bp) : '—'}</td>}
              {hasUnit && <td className="un">µg/mL</td>}
              <td className="ins">{hosp.instrument}</td>
            </tr>
          ))}
          {rows.length === 0 && (<tr><td colSpan={cols} className="empty-row">Không có kháng sinh nào đủ điều kiện báo cáo.</td></tr>)}
        </tbody>
      </table>

      {!rep.unsupported && rep.clinical && rep.clinical.length > 0 && (
        <section aria-label="Lưu ý cho lâm sàng" className="cl-notes">
          <h3>Lưu ý <span className="en">/ Notes</span></h3>
          <ul>{rep.clinical.map((n, i) => <li key={i} className={`cn-${n.level}`}>{n.text}</li>)}</ul>
        </section>
      )}

      {showFn && !rep.unsupported && ((rep.footnotes && rep.footnotes.length > 0) || rep.treatment) && (
        <section aria-label="Chú thích" className="fn-notes">
          <h3>Chú thích {std === 'eucast' ? 'EUCAST' : 'CLSI'} <span className="en">/ References</span></h3>
          <ol>{(rep.footnotes || []).map((f) => <li key={f.key} value={f.n}>{f.text} <span className="ref">({f.ref})</span></li>)}</ol>
          {rep.treatment && rep.treatment.doses.length > 0 && (
            <div className="fn-sub">
              <h4>Liều tham chiếu <span className="en">/ Reference dosage</span></h4>
              <p className="small">{rep.treatment.doseNote}</p>
              <ul>{rep.treatment.doses.map((d, i) => <li key={i}><b>{d.name}</b> ({d.kind === 'I' && std !== 'eucast' ? 'I' : d.kind}): {d.text}</li>)}</ul>
            </div>
          )}
          {rep.treatment && (
            <div className="fn-sub">
              <h4>Nguy cơ kháng trong lúc điều trị <span className="en">/ Resistance during therapy</span></h4>
              <ul>
                {rep.treatment.emergence.map((e, i) => <li key={i}>{e.text} <span className="ref">({e.ref})</span></li>)}
                <li>{rep.treatment.general} <span className="ref">({rep.treatment.generalRef})</span></li>
              </ul>
            </div>
          )}
        </section>
      )}

      <p className="legend">{std === 'eucast'
        ? 'S: nhạy, liều chuẩn (Susceptible, standard dosing) · I: nhạy, tăng phơi nhiễm (Susceptible, increased exposure) · R: kháng (Resistant).'
        : 'S: nhạy (Susceptible) · I: trung gian (Intermediate) · SDD: nhạy phụ thuộc liều (Susceptible-dose dependent) · R: kháng (Resistant) · NS: không nhạy (Non-susceptible).'} Chữ in nghiêng và gạch chân là kết quả kháng.</p>

      <section className="sign fm-sign" aria-label="Chữ ký">
        <div><p className="sg-t">NGƯỜI THỰC HIỆN<br /><span className="en">Technician</span></p><p className="sg-n">{reviewer || ''}</p></div>
        <div className="sg-mid"><p className="sg-time">Giờ: <b>{when.t}</b> &nbsp; Ngày: <b>{when.d}</b></p><p className="small">{rep.standardLabel || E.EDITION}</p></div>
        <div><p className="sg-t">TRƯỞNG KHOA XN<br /><span className="en">Chief Laboratory Officer</span></p><p className="sg-n">{hosp.chief || ''}</p></div>
      </section>
      <footer className="fm-foot">
        {window.HOSPITAL_LOGO && <img className="fm-flogo" src={window.HOSPITAL_LOGO} alt="" />}
        <div>
          <p className="fm-fname">{hosp.name}</p>
          {(hosp.address || hosp.phone || hosp.web) && <p>{[hosp.address, hosp.phone && 'ĐT: ' + hosp.phone, hosp.web].filter(Boolean).join(' · ')}</p>}
          <p>Thực hiện bằng {hosp.instrument}, diễn giải theo {rep.standardLabel || E.EDITION}.</p>
        </div>
      </footer>

    </article>
  );
}

/* ------------------------------------------------------------ KTV panel: checks, chosen drugs, hidden drugs */
const SEV = { retest: ['Làm lại', 'r'], confirm: ['Cần xác nhận', 'i'], test: ['Cần xét nghiệm', 'b'], review: ['Xem lại', 'n'] };
const SEV_ORDER = { retest: 0, confirm: 1, test: 2, review: 3 };
const REASONS = ['Đã lặp lại và cho cùng kết quả', 'Đã xác nhận bằng phương pháp thứ hai hoặc labo tham chiếu'];
const REASON_COMMON = 'Kiểu hình thường gặp tại BV, đã báo kiểm soát nhiễm khuẩn';
const isResolved = (item, c) => !!(item.resolved && item.resolved[c.id] && item.resolved[c.id].mode === 'confirmed');
const isPending = (item, c) => !!(item.resolved && item.resolved[c.id] && item.resolved[c.id].mode === 'pending');

function CheckCard({ c, res, quals, onResolve, onQual }) {
  const [form, setForm] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const reasons = c.reasons ? c.reasons : (c.sev === 'retest' ? REASONS : REASONS.concat([REASON_COMMON]));
  const [lab, kind] = SEV[c.sev];
  return (
    <li className={`chkc sv-${c.sev}`}>
      <div className="chk-h"><Pill kind={kind}>{lab}</Pill>{c.block && !(res && res.mode === 'confirmed') && <span className="blk">chặn duyệt</span>}<b>{c.title}</b></div>
      <p className="chk-w">{c.why}</p>
      {c.details && c.details.length > 0 && <ul className="chk-d">{c.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
      <p className="chk-a"><b>Việc cần làm:</b> {c.action}</p>
      <p className="chk-r">{c.ref}</p>
      {c.input === 'icr' && (
        <label className="fl inl">Kết quả D-test
          <select value={quals.ICR || ''} onChange={(e) => onQual('ICR', e.target.value)}>
            <option value="">Chưa có kết quả</option><option value="NEG">Âm tính: báo clindamycin theo MIC</option><option value="POS">Dương tính: báo clindamycin KHÁNG</option>
          </select>
        </label>
      )}
      {c.input === 'carba' && (
        <label className="fl inl">Kết quả carbapenemase
          <select value={quals.CARBA || ''} onChange={(e) => onQual('CARBA', e.target.value)}>
            <option value="">Chưa có kết quả</option><option value="POS">Dương tính (mCIM / Carba NP / PCR): cefepime báo KHÁNG</option><option value="NEG">Âm tính</option>
          </select>
        </label>
      )}
      {c.input === 'blac' && (
        <label className="fl inl">Kết quả test β-lactamase
          <select value={quals.BLAC || ''} onChange={(e) => onQual('BLAC', e.target.value)}>
            <option value="">Chưa có kết quả</option><option value="NEG">Âm tính: báo penicillin nhạy</option><option value="POS">Dương tính: báo penicillin KHÁNG</option>
          </select>
        </label>
      )}
      {c.block && res && res.mode === 'confirmed' && (
        <div className="chk-res ok">✓ Đã xác nhận: {res.reason}{res.note ? ` – ${res.note}` : ''} <span className="vk">({res.at})</span> <button className="lnk" onClick={() => onResolve(c.id, null)}>Bỏ xác nhận</button></div>
      )}
      {c.block && res && res.mode === 'pending' && (
        <div className="chk-res wait">⏳ Đã đánh dấu chờ làm lại, chủng này chưa thể duyệt hoặc xuất Excel. <span className="vk">({res.at})</span> <button className="lnk" onClick={() => onResolve(c.id, null)}>Bỏ đánh dấu</button></div>
      )}
      {c.block && !res && !form && (
        <div className="chk-btns">
          <button className="btn ghost" onClick={() => setForm(true)}>Đã kiểm tra, giữ kết quả…</button>
          <button className="btn ghost" onClick={() => onResolve(c.id, { mode: 'pending' })}>Chờ làm lại</button>
        </div>
      )}
      {c.block && !res && form && (
        <div className="chk-form">
          <label className="fl">Lý do giữ kết quả (bắt buộc)
            <select value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Chọn…</option>{reasons.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          </label>
          <label className="fl">Ghi chú (không bắt buộc)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd. mã lần chạy lại, tên labo tham chiếu" /></label>
          <div className="chk-btns">
            <button className="btn" disabled={!reason} onClick={() => { onResolve(c.id, { mode: 'confirmed', reason, note: note.trim() }); setForm(false); }}>Lưu xác nhận</button>
            <button className="btn ghost" onClick={() => setForm(false)}>Hủy</button>
          </div>
        </div>
      )}
    </li>
  );
}

const HIDE_TITLES = [
  ['cascade', 'Ẩn theo cascade (Tier 2)'], ['tier3', 'Ẩn Tier 3 (BV nguy cơ MDRO cao)'], ['tier4', 'Ẩn Tier 4 (chỉ khi bác sĩ yêu cầu)'],
  ['policy', 'Không báo thường quy theo CLSI'], ['specimen', 'Ẩn do loại bệnh phẩm'], ['nobp', 'Không có breakpoint CLSI'], ['qc', 'Chờ xét nghiệm bổ sung'], ['manual', 'Ẩn thủ công'],
];

function HiddenItem({ h, onRestore }) {
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(false);
  const [note, setNote] = useState('');
  return (
    <li className="hid-i">
      <div className="hl"><b>{h.name}</b> <span className="mono">{h.micText}</span> {h.cat ? <Chip cat={h.cat} /> : h.vitek ? <span className="vk">Vitek: {h.vitek}</span> : null}{h.tier != null && <span className="tier">{h.tier === 0 ? 'Other' : 'Tier ' + h.tier}</span>}</div>
      <p className="why"><b>Vì sao ẩn:</b> {h.reason}</p>
      {h.tierText && h.tier > 0 && <p className="why tt">{h.tierText}</p>}
      {h.risk && <p className="risk"><b>Nguy cơ nếu báo:</b> {h.risk}</p>}
      {h.restore === 'ok' && <button className="lnk" onClick={() => onRestore(h, 'ok')}>Hiện lại</button>}
      {h.restore === 'blocked' && <p className="why"><b>Không thể lấy lại:</b> thiếu cơ sở CLSI để diễn giải thuốc này cho chủng này.</p>}
      {h.restore === 'test' && <p className="why"><b>Cần làm trước:</b> {h.need}</p>}
      {h.restore === 'confirm' && !open && <button className="lnk" onClick={() => setOpen(true)}>Lấy lại thuốc này…</button>}
      {h.restore === 'confirm' && open && (
        <div className="chk-form">
          <label className="chk"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Tôi đã đọc nguy cơ ở trên và chịu trách nhiệm khi báo thuốc này.</label>
          <label className="fl">Lý do báo (không bắt buộc)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd. bác sĩ yêu cầu qua điện thoại" /></label>
          <div className="chk-btns">
            <button className="btn" disabled={!ok} onClick={() => { onRestore(h, note.trim()); setOpen(false); }}>Báo thuốc này</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>Hủy</button>
          </div>
        </div>
      )}
    </li>
  );
}

function GroupChooser({ item, rep, onPick, onUseEucast }) {
  const sg = rep.suggestions || { list: [], note: '' };
  const [pick, setPick] = useState(sg.list.length ? sg.list[0].group : '');
  const [ok, setOk] = useState(false);
  const [remember, setRemember] = useState(true);
  const all = E.GROUP_LIST.filter((x) => x[2] !== 'eucast' || STDCUR.current === 'eucast');
  const label = (g) => (all.find((x) => x[0] === g) || [g, g])[1];
  return (
    <div className="ktv-sec grp-pick">
      <h3>Vi khuẩn chưa có bảng CLSI riêng: <i>{item.iso.organism || '(không rõ tên)'}</i></h3>
      {sg.note && <p className="small">{sg.note}</p>}
      {rep.euAvailable && <div className="note n-info"><p><b>EUCAST có bảng cho vi khuẩn này.</b> CLSI M100 thì không. <button className="lnk" onClick={onUseEucast}>Chuyển sang EUCAST v16.0</button> (áp dụng cho cả app, các chủng đã duyệt sẽ phải duyệt lại).</p></div>}
      <div className="note n-warn"><p><b>Lưu ý:</b> CLSI M100 (mục III.A) nêu không nên áp breakpoint mượn từ bảng không liệt kê vi khuẩn đó. Chỉ chọn một nhóm bên dưới khi bác sĩ vi sinh hoặc nhóm kiểm soát nhiễm khuẩn đồng ý. Kết quả sẽ được gắn nhãn "ngoại suy" trên bản trả lâm sàng và trong file Excel.</p></div>
      {sg.list.length > 0 && <p className="small"><b>Gợi ý theo tên:</b></p>}
      <ul className="gp-list">
        {sg.list.map((x) => (
          <li key={x.group}><label className="chk"><input type="radio" name={'gp' + item.uid} checked={pick === x.group} onChange={() => setPick(x.group)} /> <span><b>{label(x.group)}</b><br /><span className="small">{x.reason}</span></span></label></li>
        ))}
        <li><label className="chk"><input type="radio" name={'gp' + item.uid} checked={pick !== '' && !sg.list.some((x) => x.group === pick) && pick !== 'none'} onChange={() => setPick(all[0][0])} /> <span><b>Chọn nhóm khác</b></span></label>
          <select value={sg.list.some((x) => x.group === pick) || pick === 'none' ? '' : pick} onChange={(e) => setPick(e.target.value)} aria-label="Chọn nhóm khác"><option value="">Chọn…</option>{all.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></li>
        <li><label className="chk"><input type="radio" name={'gp' + item.uid} checked={pick === 'none'} onChange={() => setPick('none')} /> <span><b>Không áp bảng nào</b><br /><span className="small">Ghi nguyên kết quả Vitek, không lọc và không kiểm tra bất thường.</span></span></label></li>
      </ul>
      {pick && pick !== 'none' && <label className="chk"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Tôi hiểu đây là ngoại suy và đã được bác sĩ vi sinh hoặc nhóm KSNK đồng ý.</label>}
      <label className="chk"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Nhớ lựa chọn này cho tên vi khuẩn này (trên trình duyệt này)</label>
      <div className="chk-btns"><button className="btn" disabled={!pick || (pick !== 'none' && !ok)} onClick={() => onPick(pick, remember)}>Áp dụng</button></div>
    </div>
  );
}

function ComparePanel({ cmp, std }) {
  if (!cmp || !cmp.length) return null;
  const nDiff = cmp.filter((x) => x.diff === 'major').length;
  const lab = (c, s2) => (c ? <Chip cat={c} /> : <span className="vk">—</span>);
  return (
    <details className="ktv-sec fold">
      <summary>Đối chiếu CLSI và EUCAST {nDiff > 0 ? <span className="bdg">{nDiff} khác nhóm nhạy/kháng</span> : <span className="cnt">không có khác biệt nhạy/kháng</span>}</summary>
      <p className="small">So sánh kết quả của cùng một MIC theo hai tiêu chuẩn (chỉ để KTV tham khảo, không đưa vào bản trả). EUCAST: I = nhạy, tăng phơi nhiễm; CLSI: I = trung gian. "—" nghĩa là tiêu chuẩn đó không có breakpoint (hoặc thuốc kháng tự nhiên).</p>
      <div className="tbl-wrap">
        <table className="res tech">
          <thead><tr><th>Kháng sinh</th><th>MIC</th><th>CLSI M100-Ed36</th><th>EUCAST v16.0</th><th>Nhận xét</th></tr></thead>
          <tbody>
            {cmp.map((x) => (
              <tr key={x.id} className={x.diff === 'major' ? 'diff' : ''}>
                <td className="ag"><span className="agname">{x.name}</span></td>
                <td className="mic">{x.micText}</td>
                <td>{lab(x.clsi)}</td><td>{lab(x.eucast)}</td>
                <td className="small">{x.diff === 'major' ? 'Khác nhóm nhạy/kháng: cần xem lại' : x.diff === 'minor' ? 'Khác mức nhạy (S so với I/SDD)' : x.diff === 'one' ? 'Chỉ một tiêu chuẩn có breakpoint' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* Khung đối chiếu cho chủng đọc từ ảnh scan: ảnh gốc cạnh bảng đã đọc, sửa trực tiếp được. */
function OcrPanel({ item, onIso }) {
  const iso = item.iso;
  const [big, setBig] = useState(false);
  const [add, setAdd] = useState({ id: '', op: '=', mic: '', v: '' });
  const OPS = ['=', '<=', '>=', '<', '>'];
  const setRes = (i, patch) => onIso((x) => ({ ...x, results: x.results.map((r, k) => (k === i ? { ...r, ...patch, suspect: false } : r)) }));
  const delRes = (i) => onIso((x) => ({ ...x, results: x.results.filter((_, k) => k !== i) }));
  const addRes = () => {
    const mic = parseFloat(String(add.mic).replace(',', '.'));
    if (!add.id || !(mic >= 0)) return;
    onIso((x) => (x.results.some((r) => r.id === add.id) ? x : { ...x, results: [...x.results, { id: add.id, rawName: E.drugName(add.id), op: add.op, mic, vitek: add.v, flags: '', suspect: false }] }));
    setAdd({ id: '', op: '=', mic: '', v: '' });
  };
  const free = Object.keys(E.DRUGS).filter((id) => !iso.results.some((r) => r.id === id)).sort((a, b) => E.drugName(a).localeCompare(E.drugName(b)));
  const nSus = iso.results.filter((r) => r.suspect).length;
  return (
    <div className="ocrp no-print">
      <h3>Đối chiếu với ảnh scan <span className="cnt">{iso.results.length} dòng đã đọc{nSus ? `, ${nSus} dòng cần xem kỹ` : ''}</span></h3>
      <div className={`ocrp-g${big ? ' big' : ''}`}>
        <div className="ocrp-img">
          {item.preview ? <img src={item.preview} alt="Ảnh phiếu gốc (trang 1)" onClick={() => setBig(!big)} title="Bấm để phóng to hoặc thu nhỏ" /> : <p className="small">Không có ảnh xem trước.</p>}
        </div>
        <div className="ocrp-t">
          <label className="fl inl">Vi khuẩn
            <input value={iso.organism || ''} onChange={(e) => onIso((x) => ({ ...x, organism: e.target.value, orgFixed: false }))} aria-label="Tên vi khuẩn đã đọc" />
          </label>
          <table className="mini ocrp-tb">
            <thead><tr><th>Thuốc</th><th>MIC</th><th>S/I/R</th><th /></tr></thead>
            <tbody>
              {iso.results.map((r, i) => (
                <tr key={r.id} className={r.suspect ? 'sus' : ''}>
                  <td>{E.drugName(r.id)}{r.suspect && <span className="sus-m" title="Dòng này OCR đọc không chắc chắn"> ⚠</span>}</td>
                  {r.mic == null
                    ? <td className="mono" colSpan={1}>{r.micRaw || ''}</td>
                    : <td className="mono">
                      <select value={r.op} onChange={(e) => setRes(i, { op: e.target.value })} aria-label={`Dấu MIC ${E.drugName(r.id)}`}>{OPS.map((o) => <option key={o} value={o}>{o === '=' ? '' : o === '<=' ? '≤' : o === '>=' ? '≥' : o}</option>)}</select>
                      <input className="w-s" defaultValue={String(r.mic)} key={r.id + ':' + r.mic} onBlur={(e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v >= 0 && v !== r.mic) setRes(i, { mic: v }); else e.target.value = String(r.mic); }} aria-label={`MIC ${E.drugName(r.id)}`} inputMode="decimal" />
                    </td>}
                  <td><select value={r.vitek || ''} onChange={(e) => setRes(i, { vitek: e.target.value })} aria-label={`Kết quả ${E.drugName(r.id)}`}><option value="">?</option>{['S', 'SDD', 'I', 'R', 'NS'].map((v) => <option key={v} value={v}>{v}</option>)}</select></td>
                  <td><button className="lnk" onClick={() => delRes(i)} title="Xóa dòng này (OCR đọc nhầm)">xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ocrp-add">
            <span className="small">Thêm dòng bị sót:</span>
            <select value={add.id} onChange={(e) => setAdd({ ...add, id: e.target.value })} aria-label="Thuốc bị sót"><option value="">chọn thuốc…</option>{free.map((id) => <option key={id} value={id}>{E.drugName(id)}</option>)}</select>
            <select value={add.op} onChange={(e) => setAdd({ ...add, op: e.target.value })} aria-label="Dấu MIC">{OPS.map((o) => <option key={o} value={o}>{o === '=' ? '' : o === '<=' ? '≤' : o === '>=' ? '≥' : o}</option>)}</select>
            <input className="w-s" value={add.mic} onChange={(e) => setAdd({ ...add, mic: e.target.value })} placeholder="MIC" inputMode="decimal" aria-label="MIC" />
            <select value={add.v} onChange={(e) => setAdd({ ...add, v: e.target.value })} aria-label="S/I/R"><option value="">?</option>{['S', 'SDD', 'I', 'R', 'NS'].map((v) => <option key={v} value={v}>{v}</option>)}</select>
            <button className="btn ghost" onClick={addRes} disabled={!add.id || !(parseFloat(String(add.mic).replace(',', '.')) >= 0)}>Thêm</button>
          </div>
          <p className="small">Sửa bất kỳ ô nào sẽ tự bỏ xác nhận OCR và bỏ duyệt; app tính lại ngay theo giá trị bạn nhập.</p>
        </div>
      </div>
    </div>
  );
}

function KtvPanel({ item, rep, cmp, onResolve, onQual, onRestore, onHideRow, onPickGroup, onUseEucast, onIso }) {
  const quals = item.iso.quals || {};
  if (rep.unsupported) {
    return (
      <section className="ktv">
        {item.iso.ocr && item.iso.ocr.used && <OcrPanel item={item} onIso={onIso} />}
        {rep.checks.filter((c) => c.id === 'ocr').length > 0 && <ul className="chks">{rep.checks.filter((c) => c.id === 'ocr').map((c) => <CheckCard key={c.id} c={c} res={item.resolved && item.resolved[c.id]} quals={quals} onResolve={onResolve} onQual={onQual} />)}</ul>}
        {rep.needGroup && <GroupChooser item={item} rep={rep} onPick={onPickGroup} onUseEucast={onUseEucast} />}
        {!rep.needGroup && rep.asIs === 'fungus' && <div className="note n-info"><p><b>Nấm:</b> ghi nguyên kết quả Vitek đã diễn giải (theo yêu cầu của bệnh viện). App không lọc, không diễn giải lại và không kiểm tra bất thường; không chặn duyệt.</p></div>}
        {!rep.needGroup && rep.asIs !== 'fungus' && <div className="note n-warn"><p><b>Không áp bảng CLSI nào cho vi khuẩn này.</b> App không lọc, không diễn giải lại và không kiểm tra bất thường. Kết quả bên dưới là diễn giải gốc của Vitek; cần bác sĩ vi sinh hoặc labo tham chiếu xem trước khi trả. <button className="lnk" onClick={() => onPickGroup('', false)}>Chọn lại nhóm</button></p></div>}
        <table className="mini"><tbody>{(rep.raw || []).map((r) => <tr key={r.id}><td>{r.name}</td><td className="mono">{r.mic}</td><td>{r.vitek}</td></tr>)}</tbody></table>
      </section>
    );
  }
  const checks = rep.checks.slice().sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  const open = checks.filter((c) => c.block && !isResolved(item, c)).length;
  return (
    <section className="ktv" aria-label="Kiểm tra dành cho kỹ thuật viên">
      {item.iso.ocr && item.iso.ocr.used && <OcrPanel item={item} onIso={onIso} />}
      <div className="ktv-sec">
        <h3>Việc cần làm trước khi duyệt {open > 0 ? <span className="bdg">{open} chặn duyệt</span> : <span className="cnt">không còn mục chặn duyệt</span>}</h3>
        {checks.length === 0 && <p className="small">Không phát hiện kết quả bất thường theo các quy tắc đã nạp. Vẫn cần đọc lại bảng bên dưới.</p>}
        <ul className="chks">
          {checks.map((c) => <CheckCard key={c.id} c={c} res={item.resolved && item.resolved[c.id]} quals={quals} onResolve={onResolve} onQual={onQual} />)}
        </ul>
      </div>

      <div className="ktv-sec">
        <h3>Thuốc sẽ báo cho lâm sàng ({rep.reported.length})</h3>
        <details className="tierdef"><summary>Tier là gì?</summary>
          {rep.standard === 'eucast'
            ? <ul><li>EUCAST không chia tier hay cascade. App dùng danh sách ưu tiên Tier 1–4 của CLSI như quy tắc báo cáo mặc định của bệnh viện (có thể chỉnh trong cài đặt).</li><li>EUCAST có 3 mức: S (nhạy, liều chuẩn), I (nhạy, tăng phơi nhiễm), R (kháng); không có SDD.</li></ul>
            : <ul>{[1, 2, 3, 4].map((t) => <li key={t}>{E.TIER_TEXT[t]}</li>)}</ul>}
          <p className="small">CLSI để mỗi bệnh viện tự đặt quy tắc cascade cùng nhóm kiểm soát nhiễm khuẩn và dược lâm sàng; các điều kiện mở Tier 2–3 trong app là mặc định có thể chỉnh. Riêng kết quả KHÁNG của thuốc Tier 2–3 thì luôn được báo.</p>
        </details>
        <div className="tbl-wrap">
          <table className="res tech">
            <thead><tr><th>Kháng sinh</th><th>MIC</th><th>Thang MIC và breakpoint</th><th>Kết quả CLSI</th><th><span className="sr">Thao tác</span></th></tr></thead>
            <tbody>
              {rep.reported.map((r) => (
                <tr key={r.id} className={r.vitekDiffers ? 'diff' : ''}>
                  <td className="ag">
                    <div className="agname">{r.name}{r.fnNums && r.fnNums.length ? <sup>{r.fnNums.join(',')}</sup> : null}</div>
                    <div className="tags"><span className="tier" title={r.tierText}>{r.tier === 0 ? 'Other' : 'Tier ' + r.tier}</span></div>
                    {r.tierWhy && <div className="tagl">{r.tierWhy}</div>}
                    {r.intrinsic && <div className="tagl">Kháng tự nhiên (Appendix B): app đổi kết quả thành KHÁNG</div>}
                    {r.deduced && <div className="tagl">{r.deduced}</div>}
                    {r.vitekDiffers && <div className="tagl">Vitek ghi {r.vitek}, CLSI M100-Ed36 cho {r.cat}: báo theo CLSI.</div>}
                  </td>
                  <td className="mic">{r.micText}</td>
                  <td className="lad"><Ladder r={r} /></td>
                  <td className="rs"><Chip cat={r.cat} /><div className="bpt">{E.bpText(r.bp)}</div></td>
                  <td className="act"><button className="lnk" onClick={() => onHideRow(r.id)} title="Ẩn khỏi báo cáo">Ẩn</button></td>
                </tr>
              ))}
              {rep.reported.length === 0 && <tr><td colSpan={5} className="empty-row">Không có kháng sinh nào đủ điều kiện báo cáo.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="legend">Thuốc đã chọn tự động theo CLSI M100-Ed36. Bấm "Ẩn" nếu không cần; thuốc ẩn nằm ở mục bên dưới kèm lý do.</p>
      </div>

      <div className="ktv-sec">
        <h3>Thuốc đã ẩn ({rep.hidden.length})</h3>
        <p className="small">Mỗi thuốc ẩn đều có lý do theo CLSI và nguy cơ nếu báo ra. Chỉ lấy lại khi thật sự cần (vd. bác sĩ yêu cầu); việc lấy lại được ghi vào file Excel.</p>
        {HIDE_TITLES.map(([k, title]) => {
          const list = rep.hidden.filter((h) => h.kind === k);
          if (!list.length) return null;
          return (
            <div className="ag-sec" key={k}>
              <h4>{title} ({list.length})</h4>
              <ul className="hid">{list.map((h) => <HiddenItem key={h.id} h={h} onRestore={onRestore} />)}</ul>
            </div>
          );
        })}
        {rep.hidden.length === 0 && <p className="small">Không có kháng sinh nào bị ẩn.</p>}
      </div>

      {(rep.notes.length > 0 || rep.qc.length > 0) && (
        <div className="ktv-sec">
          <h3>Lưu ý khác</h3>
          {rep.notes.map((n, i) => <div key={i} className={`note n-${n.level}`}><p>{n.text}{n.fnNum ? <sup>{n.fnNum}</sup> : null}</p></div>)}
          {rep.qc.length > 0 && <ul className="qc">{rep.qc.map((q, i) => <li key={i} className={`q-${q.level}`}>{q.text}</li>)}</ul>}
        </div>
      )}

      {rep.supp && rep.supp.length > 0 && (
        <details className="ktv-sec fold"><summary>Xét nghiệm bổ sung theo CLSI Table 3 <span className="cnt">{rep.supp.map((x) => x.id).join(', ')}</span></summary>
          <p className="small">Tóm tắt mục đích, cách đọc và cách báo; từng bước thực hiện và QC xem trong CLSI M100 (số trang PDF ghi bên dưới). Chỉ những mục ghi "ô nhập" mới làm đổi kết quả trong app.</p>
          <ul className="supp-l">{rep.supp.map((x) => (
            <li key={x.id}><b>{x.title}</b> <span className="ref">(tr. {x.page})</span><br />{x.use}<br /><span className="small">Trong app: {x.link}</span></li>
          ))}</ul>
        </details>
      )}

      {rep.euApplied && rep.euApplied.length > 0 && (
        <details className="ktv-sec fold" open><summary>Quy tắc EUCAST đã áp dụng cho chủng này <span className="cnt">{rep.euApplied.length}</span></summary>
          <p className="small">Các suy luận từ EUCAST Expert Rules (chỉ dựa vào MIC và kết quả Vitek). Dòng có "→" là kết quả đã bị đổi so với Vitek.</p>
          <ul className="supp-l">{rep.euApplied.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </details>
      )}

      <ComparePanel cmp={cmp} std={rep.standard} />

      {(rep.footnotes.length > 0 || (rep.intrinsicText && rep.intrinsicText.length > 0)) && (
        <details className="ktv-sec fold"><summary>Chú thích CLSI đầy đủ và kháng tự nhiên</summary>
          {rep.footnotes.length > 0 && <ol className="fnl">{rep.footnotes.map((f) => <li key={f.key} value={f.n}>{f.text} <span className="ref">({f.ref})</span></li>)}</ol>}
          {rep.intrinsicText && rep.intrinsicText.length > 0 && <p className="small"><b>Kháng tự nhiên (Appendix B):</b> {rep.intrinsicText.join(' ')}{rep.intrinsicAll ? ` Còn kháng tự nhiên với: ${rep.intrinsicAll}.` : ''}</p>}
        </details>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ treatment appendix for clinicians */

/* ------------------------------------------------------------ approve bar */
function ApproveBar({ item, rep, reviewer, onApprove, onUnapprove }) {
  const missing = missingOf(item);
  const blockers = [];
  if (!item.specVi) blockers.push('chọn bệnh phẩm');
  if (!reviewer.trim()) blockers.push('nhập tên KTV ở cột bên trái');
  if (rep.needGroup) blockers.push('chọn nhóm bảng CLSI (hoặc "không áp bảng nào") ở tab "KTV kiểm tra"');
  const blocking = rep.unsupported ? rep.checks.filter((c) => c.id === 'ocr' && c.block) : rep.checks.filter((c) => c.block);
  const pending = blocking.filter((c) => isPending(item, c));
  const unresolved = blocking.filter((c) => !isResolved(item, c) && !isPending(item, c));
  if (pending.length) blockers.push(`làm lại ${pending.length} mục đã đánh dấu chờ làm lại`);
  if (unresolved.length) blockers.push(`xử lý ${unresolved.length} mục chặn duyệt ở tab "KTV kiểm tra"`);
  const soft = missing.filter((m) => m !== 'bệnh phẩm');
  return (
    <section className={`apv no-print ${item.approved ? 'ok' : ''}`} aria-label="Duyệt kết quả">
      <div className="apv-t">
        {item.approved
          ? <p><b>✓ Đã duyệt</b> bởi {reviewer || '—'} lúc {item.approvedAt}. Sửa bất kỳ ô nào sẽ tự bỏ duyệt.</p>
          : <p><b>Chờ kỹ thuật viên kiểm tra.</b> Đọc tab "KTV kiểm tra", xử lý các mục chặn duyệt, xem tab "Bản trả lâm sàng" rồi bấm Duyệt.</p>}
        {rep.unsupported && !rep.needGroup && <p className="warn-t">Không áp bảng CLSI: file Excel sẽ ghi kết quả Vitek nguyên trạng, app không kiểm tra bất thường.</p>}
        {!item.approved && blockers.length > 0 && <p className="warn-t">Chưa thể duyệt: cần {blockers.join('; ')}.</p>}
        {!item.approved && soft.length > 0 && <p className="small">Chưa có: {soft.join(', ')} (vẫn duyệt được; các ô này để trống trong Excel).</p>}
      </div>
      <div className="apv-a">
        {item.approved
          ? <button className="btn ghost" onClick={onUnapprove}>Bỏ duyệt</button>
          : <><button className="btn" disabled={blockers.length > 0} onClick={() => onApprove(true)}>Duyệt và sang chủng tiếp</button>
            <button className="btn ghost" disabled={blockers.length > 0} onClick={() => onApprove(false)}>Chỉ duyệt</button></>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ left rail */
const COV_LABEL = { ok: ['Đã nạp', 's'], part: ['Một phần', 'i'], no: ['Chưa nạp', 'r'] };
function CoveragePanel() {
  const rows = E.COVERAGE;
  const cnt = (k) => rows.filter((r) => r[2] === k).length;
  return (
    <details className="panel cov-p">
      <summary><b>Phạm vi và giới hạn của app</b> <span className="cnt">{cnt('ok')} đã nạp · {cnt('part')} một phần · {cnt('no')} chưa nạp</span></summary>
      <p className="small">Danh sách đầy đủ những gì CLSI M100-Ed36 và EUCAST v16.0 có, và app đã làm hay chưa. Không có mục nào bị giấu.</p>
      {['CLSI', 'EUCAST', 'Chung'].map((g) => (
        <div key={g} className="cov-g">
          <h4>{g === 'Chung' ? 'Chung' : g === 'CLSI' ? 'CLSI M100-Ed36 (2026)' : 'EUCAST v16.0 (2026)'}</h4>
          <ul>
            {rows.filter((r) => r[0] === g).map((r, i) => (
              <li key={i}><Pill kind={COV_LABEL[r[2]][1]}>{COV_LABEL[r[2]][0]}</Pill> <b>{r[1]}</b>{r[3] ? <span className="small"> – {r[3]}</span> : null}</li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

function HospitalPanel({ hosp, setHosp }) {
  const set = (k, v) => setHosp({ ...hosp, [k]: v });
  const F = (k, label, ph) => (<label className="fl">{label}<input value={hosp[k] || ''} placeholder={ph || ''} onChange={(e) => set(k, e.target.value)} /></label>);
  return (
    <details className="panel hosp-p">
      <summary><b>Thông tin bệnh viện in trên phiếu</b></summary>
      <p className="small">Các ô này in ở đầu và cuối phiếu (Word, in, HTML) và được nhớ trên trình duyệt này. Hãy kiểm tra lại cho đúng.</p>
      {F('agency', 'Cơ quan chủ quản')}
      {F('name', 'Tên bệnh viện')}
      {F('accreditation', 'Dòng chứng nhận (nếu có)', 'vd. Đạt chứng chỉ ISO 15189 …')}
      {F('lab', 'Tên khoa xét nghiệm')}
      {F('instrument', 'Máy xét nghiệm')}
      {F('chief', 'Họ tên Trưởng khoa XN (in dưới chữ ký)')}
      {F('address', 'Địa chỉ')}
      {F('phone', 'Điện thoại')}
      {F('web', 'Website')}
      <button className="lnk" onClick={() => setHosp({ ...HOSP_DEFAULT })}>Khôi phục mặc định</button>
    </details>
  );
}

function Settings({ settings, setSettings }) {
  const set = (k, v) => setSettings({ ...settings, [k]: v });
  return (
    <section className="panel">
      <h3>Tiêu chuẩn diễn giải</h3>
      <fieldset className="radios">
        {[['clsi', 'CLSI M100-Ed36 (2026): mặc định'], ['eucast', 'EUCAST v16.0 (2026)']].map(([v, t]) => (
          <label key={v}><input type="radio" name="std" checked={(settings.standard || 'clsi') === v} onChange={() => set('standard', v)} /> {t}</label>
        ))}
      </fieldset>
      <p className="small">Đổi tiêu chuẩn sẽ bỏ duyệt các chủng đã duyệt. EUCAST không có SDD, tier hay cascade: I nghĩa là "nhạy, tăng phơi nhiễm" (liều cao). Nên dùng một tiêu chuẩn thống nhất cho cả file Excel.</p>
      <h3>Quy tắc báo cáo của đơn vị</h3>
      <p className="small">CLSI chia kháng sinh thành 4 tier và để mỗi cơ sở tự đặt quy tắc cascade cho Tier 2–3. Tier 1 luôn được báo. Khi dùng EUCAST, app vẫn áp danh sách này như quy tắc của bệnh viện.</p>
      <fieldset className="radios">
        <legend>Tier 2</legend>
        {[['cascade', 'Báo theo cascade (mặc định)'], ['always', 'Luôn báo'], ['hide', 'Không báo (trừ kết quả kháng, CLSI luôn báo)']].map(([v, t]) => (
          <label key={v}><input type="radio" name="t2" checked={settings.tier2 === v} onChange={() => set('tier2', v)} /> {t}</label>
        ))}
      </fieldset>
      <label className="chk"><input type="checkbox" checked={settings.mdro} onChange={(e) => set('mdro', e.target.checked)} /> BV phục vụ bệnh nhân nguy cơ MDRO cao (mở Tier 3 theo cascade)</label>
      <label className="chk"><input type="checkbox" checked={settings.tier4} onChange={(e) => set('tier4', e.target.checked)} /> Bác sĩ yêu cầu báo Tier 4</label>
    </section>
  );
}

/* ------------------------------------------------------------ app */
function App() {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [settings, setSettings] = useState(E.DEFAULT_SETTINGS);
  STDCUR.current = settings.standard || 'clsi';
  const [busy, setBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [view, setView] = useState('ktv');
  const [showMic, setShowMic] = useState(true);
  const [showFn, setShowFn] = useState(true);
  const [showBp, setShowBp] = useState(true);
  const [hosp, setHospState] = useState(loadHosp);
  const setHosp = (h) => { setHospState(h); saveHosp(h); };
  const [sttStart, setSttStart] = useState('1');
  const [sddAs, setSddAs] = useState('I');
  const [notesSheet, setNotesSheet] = useState(false);
  const [allDrugs, setAllDrugs] = useState(true);
  const [markMulti, setMarkMulti] = useState(true);
  const sheetRef = useRef(null);
  const fileRef = useRef(null);
  const uid = useRef(1);

  useEffect(() => { document.documentElement.setAttribute('data-theme', 'light'); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);

  const addIsolate = useCallback((iso, fileName, extra) => {
    const id = uid.current++;
    const specVi = guessViSpecimen(iso.source);
    const key = E.classifyOrganism(iso.organism).key;
    const stored = loadMap()[key];
    const it = { uid: id, fileName, iso, groupOverride: stored || '', mappedRemembered: !!stored, specVi, specimen: SPEC_TO_ENGINE[specVi] || 'unknown', name: iso.patientName || '', age: iso.age === undefined || iso.age === null ? '' : String(iso.age), sex: iso.sex || '', dept: normDept(iso.location), date: iso.performedDmy || '', dateFromPhieu: !!iso.performedDmy, phone: '', address: iso.address || '', diagnosis: iso.diagnosis || '', reqDoctor: iso.physician || '', preview: (extra && extra.preview) || '', sampleStatus: 'Đạt', sampler: '', receiver: '', recvTime: '', sampTime: '', approved: false, approvedAt: '', forceShow: [], forceHide: [], resolved: {}, restored: {} };
    setItems((p) => [...p, it]);
    setSel((s) => s == null ? id : s);
    return it;
  }, []);

  const ingest = useCallback(async (files) => {
    setBusy(true);
    const problems = [];
    let usedOcr = false;
    for (const f of files) {
      try {
        const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
        const isImg = isImageFile(f);
        let isos = [], preview = '';
        if (isPdf) isos = parseTextSmart(await extractPdfText(f));
        else if (!isImg) isos = E.parseReport(await f.text());
        // PDF scan (không có lớp chữ) hoặc ảnh chụp: đọc bằng OCR
        if (!isos.length && (isPdf || isImg)) {
          if (!window.AstOCR) throw new Error('Thiếu bộ OCR trong bản build này.');
          usedOcr = true;
          setOcrStatus(`${f.name}: đang chuẩn bị OCR…`);
          const rd = await window.AstOCR.read(f, { onStatus: (m) => setOcrStatus(`${f.name}: ${m}`), score: (txt) => sumRows(E.parseReport(txt, { ocr: true })) });
          preview = rd.preview;
          isos = mergeOcrReads(rd.texts);
        }
        if (!isos.length) { problems.push(`${f.name}: không đọc được dòng kết quả kháng sinh nào (không phải báo cáo Vitek 2 hay phiếu kết quả vi sinh của khoa, hoặc ảnh quá mờ/nghiêng).`); continue; }
        isos.forEach((iso) => {
          if (!iso.results.length && !Object.keys(iso.quals || {}).length) problems.push(`${f.name}: phiếu ghi kết quả cấy ÂM TÍNH, không có kháng sinh đồ.`);
          else addIsolate(iso, f.name, { preview });
        });
      } catch (e) { problems.push(`${f.name}: ${e.message || e}`); }
    }
    if (usedOcr && window.AstOCR) window.AstOCR.close();
    setOcrStatus('');
    setMsgs(problems);
    setBusy(false);
  }, [addIsolate]);

  const onDrop = (e) => { e.preventDefault(); setDrag(false); const fl = Array.from(e.dataTransfer.files || []); if (fl.length) ingest(fl); };

  const loadSamples = () => {
    (window.SAMPLE_ISOLATES || []).forEach((iso, i) => addIsolate(JSON.parse(JSON.stringify(iso)), `mau-${i + 1}.pdf`));
  };

  const analysePaste = () => {
    const isos = E.parseReport(paste);
    if (!isos.length) { setMsgs(['Không nhận diện được dòng kết quả nào trong văn bản đã dán (báo cáo Vitek 2 hoặc phiếu kết quả vi sinh của khoa).']); return; }
    isos.forEach((iso) => { if (iso.results.length || Object.keys(iso.quals || {}).length) addIsolate(iso, 'văn bản dán'); });
    setPaste(''); setPasteOpen(false); setMsgs(isos.some((i) => !i.results.length && i.culture === 'negative') ? ['Phiếu ghi kết quả cấy ÂM TÍNH, không có kháng sinh đồ.'] : []);
  };

  const cur = items.find((x) => x.uid === sel) || null;
  // any edit to a isolate withdraws its approval, so only what the technician has seen can be exported
  const update = (id, fn) => setItems((p) => p.map((x) => (x.uid === id ? { ...fn(x), approved: false, approvedAt: '' } : x)));
  const setField = (id, patch) => update(id, (x) => ({ ...x, ...patch }));
  const setPres = (id, patch) => setItems((p) => p.map((x) => (x.uid === id ? { ...x, ...patch } : x)));
  const pickGroup = (g, remember) => {
    const key = E.classifyOrganism(cur.iso.organism).key;
    if (remember && key) { const m = loadMap(); if (g) m[key] = g; else delete m[key]; saveMap(m); }
    update(cur.uid, (x) => ({ ...x, groupOverride: g, mappedRemembered: false, resolved: {} }));
  };
  const resolveCheck = (cid, payload) => update(cur.uid, (x) => { const r = { ...x.resolved }; if (payload) r[cid] = { ...payload, at: nowStamp() }; else delete r[cid]; return { ...x, resolved: r }; });
  const editIso = (id, fn) => setItems((p) => p.map((x) => { if (x.uid !== id) return x; const r = { ...x.resolved }; delete r.ocr; return { ...x, iso: fn(x.iso), resolved: r, approved: false, approvedAt: '' }; }));
  const setQual = (key, val) => update(cur.uid, (x) => { const q = { ...(x.iso.quals || {}) }; if (val) q[key] = val; else delete q[key]; return { ...x, iso: { ...x.iso, quals: q } }; });
  const restoreDrug = (h, note) => update(cur.uid, (x) => ({ ...x, forceHide: x.forceHide.filter((k) => k !== h.id), forceShow: h.kind === 'manual' ? x.forceShow : [...new Set([...x.forceShow, h.id])], restored: h.kind === 'manual' ? x.restored : { ...x.restored, [h.id]: { at: nowStamp(), note: note === 'ok' ? '' : note, name: h.name } } }));
  const hideDrug = (id) => update(cur.uid, (x) => { const r = { ...x.restored }; delete r[id]; return { ...x, forceHide: [...new Set([...x.forceHide, id])], forceShow: x.forceShow.filter((k) => k !== id), restored: r }; });
  const changeSettings = (v) => {
    if (items.some((x) => x.approved)) setToast('Đã đổi quy tắc báo cáo – các chủng cần được duyệt lại');
    setSettings(v);
    setItems((p) => p.map((x) => (x.approved ? { ...x, approved: false, approvedAt: '' } : x)));
  };
  const reps = useMemo(() => items.map((it) => E.buildReport(it.iso, settings, { specimen: it.specimen, forceShow: it.forceShow, forceHide: it.forceHide, groupOverride: it.groupOverride || undefined, mappedRemembered: it.mappedRemembered })), [items, settings]);
  const curRep = cur ? reps[items.indexOf(cur)] : null;
  const cmp = useMemo(() => (cur ? E.compareStandards(cur.iso, settings, { specimen: cur.specimen, forceShow: cur.forceShow, forceHide: cur.forceHide, groupOverride: cur.groupOverride || undefined, mappedRemembered: cur.mappedRemembered }) : []), [cur, settings]);

  const removeItem = (id) => { setItems((p) => p.filter((x) => x.uid !== id)); setSel((s) => (s === id ? null : s)); };
  useEffect(() => { if (sel == null && items.length) setSel(items[0].uid); }, [items, sel]);

  const approveCur = (goNext) => {
    const at = nowStamp();
    setItems((p) => p.map((x) => (x.uid === cur.uid ? { ...x, approved: true, approvedAt: at } : x)));
    if (goNext) {
      const next = items.find((x) => x.uid !== cur.uid && !x.approved);
      if (next) setSel(next.uid); else setToast('Đã duyệt hết các chủng đang nạp');
    }
  };
  const unapproveCur = () => setItems((p) => p.map((x) => (x.uid === cur.uid ? { ...x, approved: false, approvedAt: '' } : x)));
  const nApproved = items.filter((x) => x.approved).length;
  const blocksOf = (it, r) => (r.unsupported ? r.checks.filter((c) => c.id === 'ocr' && c.block) : r.checks.filter((c) => c.block));
  const openBlocks = cur && curRep ? blocksOf(cur, curRep).filter((c) => !isResolved(cur, c)).length : 0;
  const doExcel = async () => {
    const entries = items.map((it, i) => ({ it, rep: reps[i] })).filter((x) => x.it.approved)
      .map(({ it, rep }) => ({
        date: it.date, name: it.name, dept: it.dept, age: it.age, sex: it.sex, specVi: it.specVi, iso: it.iso, rep, reviewer, approvedAt: it.approvedAt,
        resolutions: (rep.unsupported ? rep.checks.filter((c) => c.id === 'ocr') : rep.checks).filter((c) => it.resolved[c.id] && it.resolved[c.id].mode === 'confirmed').map((c) => `${c.title} → ${it.resolved[c.id].reason}${it.resolved[c.id].note ? ' (' + it.resolved[c.id].note + ')' : ''}`).join(' | '),
        restored: Object.keys(it.restored || {}).filter((id) => !rep.unsupported && rep.reported.some((r) => r.id === id)).map((id) => `${it.restored[id].name} (lấy lại ${it.restored[id].at}${it.restored[id].note ? ': ' + it.restored[id].note : ''})`).join('; '),
      }));
    if (!entries.length) return;
    try {
      const { bytes } = K.buildWorkbook(entries, { sttStart: parseInt(sttStart, 10) || 1, sdd: sddAs, notesSheet, allDrugs, markMulti });
      const r = await saveFile(`Khang_sinh_do_BVDKLBT_${todayCompact()}.xlsx`, bytes);
      if (r === 'saved' || r === 'fallback') setToast(`Đã xuất Excel (${entries.length} chủng)`); else if (r === 'unavailable') setToast('Môi trường này không cho lưu tệp .xlsx'); else if (r === 'failed') setToast('Không lưu được tệp');
    } catch (e) { setToast('Lỗi tạo Excel: ' + (e.message || e)); }
  };
  const wordEntry = (it, rp, draft) => ({
    meta: { organism: it.iso.organism, name: it.name, age: it.age, sex: it.sex, dept: it.dept, spec: it.specVi ? (it.csf ? it.specVi + ' (dịch não tủy)' : it.specVi) : '', date: [it.sampTime, it.date].filter(Boolean).join(' '), patientId: it.iso.patientId, labId: it.iso.labId,
      phone: it.phone, address: it.address, diagnosis: it.diagnosis, reqDoctor: it.reqDoctor, sampleStatus: it.sampleStatus, sampler: it.sampler, receiver: it.receiver, recvTime: it.recvTime, approvedAt: it.approvedAt },
    rep: rp, reviewer, showMic, showFn, showBp, hospital: hosp, draft,
  });
  const safeName = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const doWord = async (all) => {
    try {
      const list = all ? items.map((it, i) => ({ it, rp: reps[i] })).filter((x) => x.it.approved) : [{ it: cur, rp: curRep }];
      if (!list.length) return;
      const entries = list.map(({ it, rp }) => wordEntry(it, rp, !it.approved));
      const bytes = window.ASTDocx.buildDocx(entries, { title: 'Kết quả kháng sinh đồ' });
      const nm = all ? `KQ_KhangSinhDo_${list.length}_chung_${todayCompact()}.docx` : `KQ_KhangSinhDo_${safeName(cur.name) || safeName(cur.iso.labId) || 'chung'}_${todayCompact()}.docx`;
      const r = await saveFile(nm, bytes);
      if (r === 'saved' || r === 'fallback') setToast(`Đã xuất Word (${list.length} chủng)`);
      else if (r === 'unavailable') setToast('Môi trường này không cho lưu tệp .docx'); else if (r === 'failed') setToast('Không lưu được tệp');
    } catch (e) { setToast('Lỗi tạo Word: ' + (e.message || e)); }
  };
  const doCopy = async () => { const ok = await copyText(E.reportToText(cur.iso, curRep, { showMic, showFn })); setToast(ok ? 'Đã sao chép báo cáo' : 'Không sao chép được – hãy chọn và copy thủ công'); };
  const baseName = () => `ksd_${(cur.iso.patientId || 'bn').replace(/[^\w-]+/g, '')}_${(cur.iso.labId || '').replace(/[^\w-]+/g, '')}`;
  const doCsv = async (all) => {
    let csv;
    if (all) {
      const parts = items.map((it, i) => E.reportToCsv(it.iso, reps[i]).replace(/^\ufeff/, ''));
      csv = '\ufeff' + parts.map((p, i) => (i === 0 ? p : p.split('\r\n').slice(1).join('\r\n'))).join('\r\n');
    } else csv = E.reportToCsv(cur.iso, curRep);
    const r = await saveFile(all ? 'ksd_tat_ca.csv' : baseName() + '.csv', csv);
    if (r === 'saved' || r === 'fallback') setToast('Đã lưu CSV'); else if (r === 'failed') setToast('Không lưu được tệp');
  };
  const doHtml = async () => {
    const node = sheetRef.current; if (!node) return;
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.no-print').forEach((n) => n.remove());
    clone.querySelectorAll('.print-only').forEach((n) => n.classList.remove('print-only'));
    const css = document.getElementById('app-css').textContent;
    const html = `<!doctype html><html lang="vi" data-theme="light"><head><meta charset="utf-8"><title>Kháng sinh đồ ${cur.iso.labId || ''}</title><style>${css}</style></head><body class="export"><main class="export-main">${clone.outerHTML}</main></body></html>`;
    const r = await saveFile(baseName() + '.html', html);
    if (r === 'saved' || r === 'fallback') setToast('Đã lưu báo cáo HTML (mở rồi in ra PDF)');
  };
  const doPrint = () => { try { window.print(); } catch (e) { setToast('Trình duyệt chặn in – hãy dùng "Lưu HTML" rồi in từ tệp'); } };

  return (
    <div className="app">
      <header className="top no-print">
        <div className="brand">
          <h1>Báo cáo kháng sinh đồ</h1>
          <p>Vitek 2 → {(settings.standard === 'eucast') ? E.EUCAST_EDITION : E.EDITION}</p>
        </div>
        <div className="top-r">
          <span className="priv">Xử lý ngay trên trình duyệt, không gửi dữ liệu đi đâu</span>
        </div>
      </header>

      <div className="layout">
        <aside className="rail no-print">
          <section className={`drop ${drag ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf,.txt,image/*" multiple hidden onChange={(e) => { const fl = Array.from(e.target.files || []); e.target.value = ''; if (fl.length) ingest(fl); }} />
            <p className="drop-t">Thả PDF Vitek (“Microbiology Chart Report”), phiếu kết quả vi sinh của khoa (PDF hoặc ảnh scan) vào đây</p>
            <div className="drop-a">
              <button className="btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>{busy ? 'Đang đọc…' : 'Chọn PDF hoặc ảnh'}</button>
              <button className="btn ghost" onClick={() => setPasteOpen(!pasteOpen)}>Dán văn bản</button>
            </div>
            {busy && ocrStatus && <p className="small ocr-st" role="status">{ocrStatus}</p>}
            <button className="lnk" onClick={loadSamples}>Thử với 5 báo cáo mẫu (đã ẩn danh)</button>
          </section>
          {pasteOpen && (
            <section className="panel">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={7} placeholder="Dán nội dung báo cáo Vitek hoặc phiếu kết quả vi sinh của khoa vào đây…" />
              <button className="btn" onClick={analysePaste} disabled={!paste.trim()}>Phân tích</button>
            </section>
          )}
          {msgs.length > 0 && <section className="panel err">{msgs.map((m, i) => <p key={i}>{m}</p>)}</section>}

          {items.length > 0 && (
            <section className="panel">
              <h3>Chủng đã nạp ({items.length}) <span className="cnt">· đã duyệt {nApproved}/{items.length}</span></h3>
              <label className="fl">KTV kiểm tra<input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Họ tên kỹ thuật viên" /></label>
              <ul className="iso-list">
                {items.map((it, i) => {
                  const r = reps[i];
                  return (
                    <li key={it.uid} className={it.uid === sel ? 'on' : ''}>
                      <button className="iso" onClick={() => setSel(it.uid)}>
                        <span className="iso-o"><i>{it.iso.organism || 'Chưa rõ'}</i></span>
                        <span className="iso-m">{it.iso.patientId || it.fileName}{it.iso.labId ? ' · ' + it.iso.labId : ''}</span>
                        <span className="iso-f">
                          {r.flags.mrs && <Pill kind="r">{r.org.group === 'staph_aureus' ? 'MRSA' : 'MRS'}</Pill>}
                          {r.flags.cre && <Pill kind="r">kháng carbapenem</Pill>}
                          {r.flags.mssa && <Pill kind="s">MSSA</Pill>}
                          {r.unsupported && <Pill kind="i">{r.needGroup ? 'chọn nhóm CLSI' : 'ghi nguyên Vitek'}</Pill>}
                          {it.approved ? <Pill kind="s">✓ đã duyệt</Pill> : (() => { const bl = blocksOf(it, r); const pend = bl.filter((c) => isPending(it, c)).length; const open = bl.filter((c) => !isResolved(it, c) && !isPending(it, c)).length; return pend ? <Pill kind="r">chờ làm lại</Pill> : open ? <Pill kind="i">cần xử lý {open}</Pill> : <Pill kind="n">chờ duyệt</Pill>; })()}
                        </span>
                      </button>
                      <button className="x" onClick={() => removeItem(it.uid)} aria-label="Xóa chủng">×</button>
                    </li>
                  );
                })}
              </ul>
              <div className="xl">
                <h4>Xuất Excel cho KSNK</h4>
                <div className="xl-row">
                  <label className="fl">STT bắt đầu từ<input type="number" min="1" value={sttStart} onChange={(e) => setSttStart(e.target.value)} className="w-s" /></label>
                  <label className="fl">Kết quả SDD ghi là
                    <select value={sddAs} onChange={(e) => setSddAs(e.target.value)}><option value="I">I (như file KSNK cũ)</option><option value="SDD">SDD</option></select>
                  </label>
                </div>
                <label className="chk"><input type="checkbox" checked={allDrugs} onChange={(e) => setAllDrugs(e.target.checked)} /> Ghi cả thuốc không báo lâm sàng (cascade, tier 4…) như file KSNK cũ</label>
                <label className="chk"><input type="checkbox" checked={markMulti} onChange={(e) => setMarkMulti(e.target.checked)} /> Cột D = 1 khi một bệnh nhân có từ 2 vi khuẩn (xếp các dòng liền nhau)</label>
                <label className="chk"><input type="checkbox" checked={notesSheet} onChange={(e) => setNotesSheet(e.target.checked)} /> Kèm sheet “Ghi chu KTV” (cảnh báo, thuốc bị ẩn, thông tin thiếu). Bỏ tick khi tải lên web chỉ đọc Sheet1</label>
                <button className="btn" onClick={doExcel} disabled={!nApproved}>Xuất Excel ({nApproved} chủng đã duyệt)</button>
                <button className="btn ghost" onClick={() => doWord(true)} disabled={!nApproved}>Xuất Word trả lâm sàng ({nApproved} chủng đã duyệt)</button>
                {!nApproved && <p className="small">Chỉ các chủng đã bấm “Duyệt” mới được đưa vào tệp. Word gộp mỗi chủng một trang để in; bản Word của chủng chưa duyệt (nút ở tab “Bản trả lâm sàng”) có dòng “BẢN NHÁP”.</p>}
              </div>
              <button className="lnk" onClick={() => doCsv(true)}>Xuất CSV tất cả chủng (kiểm tra)</button>
            </section>
          )}
          <Settings settings={settings} setSettings={changeSettings} />
              <HospitalPanel hosp={hosp} setHosp={setHosp} />
              <CoveragePanel />
        </aside>

        <main className="main">
          {!cur && (
            <section className="empty">
              <h2>Từ báo cáo Vitek đến kết quả đúng chuẩn CLSI</h2>
              <p>Tải PDF lên, phần mềm đọc MIC, diễn giải lại theo breakpoint M100-Ed36 và chỉ giữ những kháng sinh CLSI cho phép báo cáo.</p>
              <ul>
                <li>Lọc theo tier và cascade, theo bệnh phẩm (nước tiểu, đường hô hấp dưới) và theo loài.</li>
                <li>Tự áp kháng tự nhiên (Appendix B), quy tắc MRSA, kháng clindamycin cảm ứng, cảnh báo kháng carbapenem.</li>
                <li>Gắn chú thích và liều tham chiếu từ Table 2 Dosages vào đúng kháng sinh.</li>
                <li>So sánh diễn giải của Vitek với CLSI và báo chỗ khác nhau.</li>
                <li>Nạp cả loạt PDF, kỹ thuật viên kiểm tra và bấm Duyệt từng chủng, rồi xuất một file Excel đúng mẫu KSNK.</li>
              </ul>
              <p className="small">Hỗ trợ {E.GROUP_LIST.filter((x) => x[2] !== 'eucast').length} nhóm vi khuẩn theo CLSI M100 và {E.GROUP_LIST.length} nhóm theo EUCAST v16.0: Enterobacterales, <i>Salmonella/Shigella</i>, <i>Pseudomonas</i>, <i>Acinetobacter</i>, <i>Stenotrophomonas</i>, tụ cầu, <i>Enterococcus</i>, phế cầu, liên cầu (β-tan huyết, viridans), <i>Haemophilus</i>, <i>Neisseria</i>, kỵ khí và nhiều nhóm khác. Nấm ghi nguyên kết quả Vitek. Xem mục "Phạm vi và giới hạn của app" ở cột trái.</p>
            </section>
          )}
          {cur && curRep && (
            <>
              <ApproveBar item={cur} rep={curRep} reviewer={reviewer} onApprove={approveCur} onUnapprove={unapproveCur} />
              <div className="tabs no-print" role="tablist">
                <button role="tab" aria-selected={view === 'ktv'} className={view === 'ktv' ? 'on' : ''} onClick={() => setView('ktv')}>KTV kiểm tra{openBlocks > 0 && <span className="bdg">{openBlocks}</span>}</button>
                <button role="tab" aria-selected={view === 'lam'} className={view === 'lam' ? 'on' : ''} onClick={() => setView('lam')}>Bản trả lâm sàng</button>
              </div>
              {view === 'ktv' && (
                <KtvPanel item={cur} rep={curRep} cmp={cmp} onPickGroup={pickGroup} onUseEucast={() => changeSettings({ ...settings, standard: 'eucast' })} onResolve={resolveCheck} onQual={setQual} onRestore={restoreDrug} onHideRow={hideDrug} onIso={(fn) => editIso(cur.uid, fn)} />
              )}
              {view === 'lam' && (
                <>
                  <div className="actions no-print">
                    <button className="btn" onClick={doCopy}>Sao chép văn bản</button>
                    <button className="btn ghost" onClick={() => doCsv(false)}>Lưu CSV</button>
                    <button className="btn ghost" onClick={() => doWord(false)}>Lưu Word (.docx)</button>
                    <button className="btn ghost" onClick={doHtml}>Lưu báo cáo HTML</button>
                    <button className="btn ghost" onClick={doPrint}>In</button>
                    <label className="chk inl-chk" title="CLSI cho phép báo MIC trực tiếp cho lâm sàng, miễn là luôn kèm kết quả S/I/R. Việc hiện hay ẩn MIC do bệnh viện quyết định."><input type="checkbox" checked={showMic} onChange={(e) => setShowMic(e.target.checked)} /> Hiện cột MIC</label>
                    <label className="chk inl-chk"><input type="checkbox" checked={showBp} onChange={(e) => setShowBp(e.target.checked)} /> Hiện ngưỡng diễn giải</label>
                    <label className="chk inl-chk"><input type="checkbox" checked={showFn} onChange={(e) => setShowFn(e.target.checked)} /> Hiện chú thích CLSI</label>
                  </div>
                  <ReportSheet item={cur} rep={curRep} sheetRef={sheetRef} reviewer={reviewer} showMic={showMic} showFn={showFn} showBp={showBp} hosp={hosp} onField={(patch) => setField(cur.uid, patch)} />
                </>
              )}
            </>
          )}
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
