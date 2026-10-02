/* Word (.docx) export of the clinician result sheet. Hand-written WordprocessingML + the zip writer from ksnk.js (no dependencies).
   One entry = one page. entry: { meta, rep, reviewer, showMic, showFn, appx, draft } */
(function (root) {
  'use strict';
  const E = root.ASTEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const KS = root.KSNK || (typeof require !== 'undefined' ? require('./ksnk.js') : null);

  const W = 9906; // content width in DXA (A4, ~1.76 cm side margins)
  const TEAL = '0B5D6B';
const GOLD = 'F4CF72';
  const INK2 = '56636B';
  const CAT = {
    S: { fill: 'DDF3E7', color: '17704A' },
    I: { fill: 'FCEFC7', color: '8A5A00' },
    SDD: { fill: 'FFE6B0', color: '8A5A00' },
    R: { fill: 'FADBD8', color: 'B3261E' },
    NS: { fill: 'E8ECEF', color: '3C4A52' },
  };
  const FONT = 'Times New Roman';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ----- run / paragraph / table helpers ----- */
  function run(text, o) {
    o = o || {};
    let pr = '';
    if (o.b) pr += '<w:b/>';
    if (o.i) pr += '<w:i/>';
    if (o.color) pr += `<w:color w:val="${o.color}"/>`;
    if (o.sz) pr += `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`;
    if (o.sup) pr += '<w:vertAlign w:val="superscript"/>';
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }
  function para(content, o) {
    o = o || {};
    let pr = '';
    if (o.style) pr += `<w:pStyle w:val="${o.style}"/>`;
    if (o.keepNext) pr += '<w:keepNext/>';
    if (o.pageBreakBefore) pr += '<w:pageBreakBefore/>';
    if (o.num) pr += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.num}"/></w:numPr>`;
    if (o.border) pr += `<w:pBdr>${o.border}</w:pBdr>`;
    if (o.shade) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>`;
    if (o.tabs) pr += `<w:tabs>${o.tabs}</w:tabs>`;
    if (o.before != null || o.after != null) pr += `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>`;
    if (o.ind) pr += `<w:ind ${o.ind}/>`;
    if (o.align) pr += `<w:jc w:val="${o.align}"/>`;
    return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${content || ''}</w:p>`;
  }
  const cell = (w, inner, o) => {
    o = o || {};
    let pr = `<w:tcW w:w="${w}" w:type="dxa"/>`;
    if (o.span) pr += `<w:gridSpan w:val="${o.span}"/>`;
    if (o.borders) pr += `<w:tcBorders>${o.borders}</w:tcBorders>`;
    if (o.fill) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>`;
    pr += `<w:vAlign w:val="${o.valign || 'center'}"/>`;
    return `<w:tc><w:tcPr>${pr}</w:tcPr>${inner || para('')}</w:tc>`;
  };
  const row = (cells, o) => {
    o = o || {};
    let pr = '<w:cantSplit/>';
    if (o.height) pr += `<w:trHeight w:val="${o.height}" w:hRule="atLeast"/>`;
    if (o.header) pr += '<w:tblHeader/>';
    return `<w:tr><w:trPr>${pr}</w:trPr>${cells.join('')}</w:tr>`;
  };
  const LINE = (c) => `w:val="single" w:sz="4" w:space="0" w:color="${c || 'C9D1D6'}"`;
  const bordersAll = (c) => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} ${LINE(c)}/>`).join('');
  const bordersNone = () => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="nil"/>`).join('');
  function table(widths, rows, o) {
    o = o || {};
    const total = widths.reduce((a, b) => a + b, 0);
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>${o.noBorders ? bordersNone() : bordersAll(o.borderColor)}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="25" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="25" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
  }

  /* ----- logo ----- */
  function b64ToBytes(b64) {
    if (typeof atob === 'function') { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  function logoInfo() {
    const uri = root.HOSPITAL_LOGO;
    if (!uri || uri.indexOf('base64,') < 0) return null;
    const bytes = b64ToBytes(uri.split('base64,')[1]);
    if (bytes.length < 24 || bytes[1] !== 0x50) return null; // not PNG
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const w = dv.getUint32(16), h = dv.getUint32(20);
    const cy = 612000; // 1.7 cm
    return { bytes, cx: Math.round((cy * w) / h), cy };
  }
  let DOCPR = 0;
  function imgRun(rid, cx, cy, name, descr) {
    DOCPR += 1;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${DOCPR}" name="${esc(name)}" descr="${esc(descr || name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  const runBr = () => '<w:r><w:br/></w:r>';
  const runU = (text, o) => run(text, o).replace('<w:rPr>', '<w:rPr><w:u w:val="single"/>').replace(/^<w:r><w:t/, '<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t');

  /* ----- one page ----- */
  const HOSP_DEF = { agency: 'SỞ Y TẾ TP. HỒ CHÍ MINH', name: 'BỆNH VIỆN ĐA KHOA LÃNH BINH THĂNG', accreditation: '', lab: 'KHOA XÉT NGHIỆM', instrument: 'Vitek 2', chief: '', address: '', phone: '', web: '' };
  const BLK = (sz) => `w:val="single" w:sz="${sz || 4}" w:space="0" w:color="000000"`;
  function resultCell(w, cat, std) {
    if (!cat) return cell(w, para(run('—'), { align: 'center' }));
    const c = CAT[cat] || {};
    const label = cat;
    let r;
    if (cat === 'R') r = runU(label, { b: true, i: true, color: c.color, sz: 20 });
    else if (cat === 'I' || cat === 'SDD' || cat === 'NS') r = run(label, { b: true, i: true, color: c.color, sz: 20 });
    else r = run(label, { color: c.color, sz: 20 });
    return cell(w, para(r, { align: 'center' }));
  }
  function entryXml(en, idx, li, imgs) {
    const rep = en.rep, m = en.meta || {};
    const H = Object.assign({}, HOSP_DEF, en.hospital || {});
    const std = rep.standard || 'clsi';
    const stdLabel = rep.standardLabel || (E && E.EDITION) || '';
    const out = [];
    const T = (t, o) => run(t, Object.assign({ sz: 20 }, o || {}));
    if (idx > 0) out.push(para('', { pageBreakBefore: true }));
    if (en.draft) out.push(para(run('BẢN NHÁP – CHƯA ĐƯỢC KỸ THUẬT VIÊN DUYỆT', { b: true, color: 'B3261E', sz: 20 }), { align: 'center', after: 60, border: `<w:top ${LINE('B3261E')}/><w:bottom ${LINE('B3261E')}/>` }));

    // ---- top: logo + hospital | accreditation + barcode + SID
    const sid = m.labId || m.patientId || '';
    let bcPara = para('');
    if (sid && root.ASTBarcode) {
      const bc = root.ASTBarcode.png(sid, { scale: 2, height: 64 });
      const id = `rIdBc${idx}`;
      imgs.push({ rid: id, name: `media/bc${idx}.png`, bytes: bc.bytes });
      const cy = 430000, cx = Math.min(Math.round((cy * bc.width) / bc.height), 1900000);
      bcPara = para(imgRun(id, cx, Math.round(cx * bc.height / bc.width), 'Barcode', 'Mã vạch SID'), { align: 'right' });
    }
    const wL = 1500, wR = 2900, wM = W - wL - wR;
    const leftCell = cell(wL, li ? para(imgRun('rIdLogo', Math.round(li.cx * 0.95), Math.round(li.cy * 0.95), 'Logo', 'Logo bệnh viện')) : para(''));
    const midCell = cell(wM, para(run(H.agency, { sz: 20 }), { align: 'center' }) + para(run(H.name, { b: true, sz: 22 }), { align: 'center' }));
    const rightInner = (H.accreditation ? para(run(H.accreditation, { b: true, sz: 16 }), { align: 'right', after: 20 }) : '') + bcPara + (sid ? para(run(`SID: ${sid}`, { b: true, sz: 21 }), { align: 'right' }) : '');
    const rightCell = cell(wR, rightInner || para(''), { valign: 'top' });
    out.push(table([wL, wM, wR], [row([leftCell, midCell, rightCell])], { noBorders: true }));
    out.push(para(run('PHIẾU KẾT QUẢ KHÁNG SINH ĐỒ', { b: true, sz: 28 }), { align: 'center', before: 60, after: 0 }));
    out.push(para(run('ANTIMICROBIAL SUSCEPTIBILITY TEST REPORT', { b: true, sz: 20 }), { align: 'center', after: 50 }));

    // ---- patient block (4 columns, borderless)
    const cw = [3000, 1953, 3000, 1953];
    const lab = (vi, en_) => cell(cw[0], para(T(vi + '/ ', { sz: 18 }) + T(en_ + ':', { sz: 18 })), { valign: 'top' });
    const val = (t, w, bold) => cell(w, para(T(t || '', { b: bold !== false, sz: 19 })), { valign: 'top' });
    const R2 = (a1, a2, b1, b2, v1, v2) => row([lab(a1, a2), val(v1, cw[1]), lab(b1, b2), val(v2, cw[3])]);
    out.push(table(cw, [
      R2('Họ tên', 'Patient Name', 'Giới tính', 'Sex', m.name, m.sex === 'NAM' ? 'Nam' : (m.sex === 'NỮ' ? 'Nữ' : m.sex)),
      R2('Điện thoại', 'Phone', 'Tuổi', 'Age', m.phone, m.age == null ? '' : String(m.age)),
      R2('Địa chỉ', 'Address', 'Khoa', 'Department', m.address, m.dept),
      R2('Chẩn đoán sơ bộ', 'Preliminary diagnosis', 'BS chỉ định', 'Requesting doctor', m.diagnosis, m.reqDoctor),
      R2('Loại bệnh phẩm', 'Type of sample', 'Ngày lấy mẫu', 'Sampling date', m.spec, m.date),
      R2('Tình trạng mẫu', 'Sample status', 'Giờ nhận mẫu', 'Receiver time', m.sampleStatus, m.recvTime),
      R2('Người lấy mẫu', 'Sampling', 'Mã BN', 'Patient ID', m.sampler, m.patientId),
      R2('Người nhận mẫu', 'Receiver', 'Số phiếu', 'Lab ID', m.receiver, m.labId),
    ], { noBorders: true }));
    out.push(para('', { after: 40 }));

    if (rep.unsupported) out.push(para(run('Chưa áp bảng CLSI/EUCAST cho vi khuẩn này: kết quả dưới đây là diễn giải gốc của Vitek, chưa lọc theo tiêu chuẩn.', { b: true, color: '8A5A00', sz: 18 }), { after: 60, shade: 'FCEFC7' }));

    // ---- result table (gold header, black grid)
    const showMic = en.showMic !== false, showBp = en.showBp !== false;
    const hasUnit = showMic || showBp;
    const wIns = 950, wUnit = hasUnit ? 800 : 0, wRes = 1750, wBp = showBp ? 2300 : 0, wMic = showMic ? 950 : 0;
    const wName = W - wIns - wUnit - wRes - wBp - wMic;
    const widths = [wName].concat(showMic ? [wMic] : []).concat([wRes]).concat(showBp ? [wBp] : []).concat(hasUnit ? [wUnit] : []).concat([wIns]);
    const head = (vi, en_, w, al) => cell(w, para(run(vi, { b: true, sz: 19 }) + runBr() + run(`(${en_})`, { sz: 15 }), { align: al || 'center' }), { fill: GOLD });
    const heads = [head('TÊN KHÁNG SINH', 'ANTIBIOTIC', wName, 'left')];
    if (showMic) heads.push(head('MIC', 'MIC', wMic));
    heads.push(head('KẾT QUẢ', 'RESULT', wRes));
    if (showBp) heads.push(head('NGƯỠNG DIỄN GIẢI', 'BREAKPOINT', wBp));
    if (hasUnit) heads.push(head('ĐƠN VỊ', 'UNIT', wUnit));
    heads.push(head('MÁY XN', 'INS', wIns));
    const span = widths.length;
    const body = [];
    body.push(row([cell(W, para(run('VI SINH ', { b: true, sz: 20 }) + run('(MICROBIOLOGY)', { sz: 16 })), { span })]));
    body.push(row([cell(W, para(run('Kháng sinh đồ – vi khuẩn phân lập: ', { b: true, sz: 20 }) + run(m.organism || '(chưa rõ vi khuẩn)', { b: true, i: true, sz: 20 }) + run(`  [${H.instrument} · ${stdLabel}]`, { sz: 16 })), { span })]));
    const items = rep.unsupported ? (rep.raw || []).map((r) => ({ name: r.name, micText: r.mic, cat: r.vitek, bp: null, fnNums: [] })) : rep.reported;
    items.forEach((r) => {
      const sup = en.showFn !== false && r.fnNums && r.fnNums.length ? run(r.fnNums.join(','), { sup: true, color: TEAL, b: true }) : '';
      const cs = [cell(wName, para(run(r.name, { b: true, sz: 21 }) + sup))];
      if (showMic) cs.push(cell(wMic, para(T(String(r.micText == null ? '' : r.micText)), { align: 'center' })));
      cs.push(resultCell(wRes, r.cat, std));
      if (showBp) cs.push(cell(wBp, para(run(r.bp ? E.bpText(r.bp) : '—', { sz: 17 }), { align: 'center' })));
      if (hasUnit) cs.push(cell(wUnit, para(run('µg/mL', { sz: 17 }), { align: 'center' })));
      cs.push(cell(wIns, para(run(H.instrument, { sz: 17 }), { align: 'center' })));
      body.push(row(cs));
    });
    if (!items.length) body.push(row([cell(W, para(run('Không có kháng sinh nào đủ điều kiện báo cáo.', { color: INK2 })), { span })]));
    out.push(table(widths, [row(heads, { header: true })].concat(body), { borderColor: '000000' }));

    // ---- notes
    if (!rep.unsupported && rep.clinical && rep.clinical.length) {
      out.push(para('', { after: 60 }));
      const inner = para(run('LƯU Ý ', { b: true, sz: 20 }) + run('/ Notes', { sz: 18 }), { after: 20 })
        + rep.clinical.map((n) => para(run(n.text, { color: n.level === 'alert' ? 'B3261E' : '000000', b: n.level === 'alert', sz: 19 }), { num: 1, after: 20 })).join('');
      out.push(table([W], [row([cell(W, inner, { valign: 'top', borders: `<w:left ${BLK(24)}/>` })])], { borderColor: '000000' }));
    }
    const tr = rep.treatment;
    if (en.showFn !== false && !rep.unsupported && ((rep.footnotes && rep.footnotes.length) || tr)) {
      out.push(para(run(`CHÚ THÍCH ${std === 'eucast' ? 'EUCAST' : 'CLSI'} `, { b: true, sz: 20 }) + run('/ References', { sz: 18 }), { keepNext: true, before: 90, after: 20 }));
      (rep.footnotes || []).forEach((f) => out.push(para(run(`${f.n}.\t`, { sz: 15 }) + run(f.text, { sz: 15 }) + run(` (${f.ref})`, { sz: 13, color: INK2 }), { ind: 'w:left="340" w:hanging="340"', after: 0, tabs: '<w:tab w:val="left" w:pos="360"/>' })));
      if (tr && tr.doses && tr.doses.length) {
        out.push(para(run('LIỀU THAM CHIẾU ', { b: true, sz: 17 }) + run('/ Reference dosage', { sz: 15 }), { keepNext: true, before: 40, after: 6 }));
        out.push(para(run(tr.doseNote, { sz: 13, color: INK2 }), { after: 6 }));
        tr.doses.forEach((d) => out.push(para(run(d.name, { b: true, sz: 15 }) + run(` (${d.kind}): ${d.text}`, { sz: 15 }), { num: 1, after: 0 })));
      }
      if (tr) {
        out.push(para(run('NGUY CƠ KHÁNG TRONG LÚC ĐIỀU TRỊ ', { b: true, sz: 17 }) + run('/ Resistance during therapy', { sz: 15 }), { keepNext: true, before: 40, after: 6 }));
        (tr.emergence || []).forEach((e) => out.push(para(run(e.text, { sz: 15 }) + run(` (${e.ref})`, { sz: 13, color: INK2 }), { num: 1, after: 0 })));
        out.push(para(run(tr.general, { sz: 15 }) + run(` (${tr.generalRef})`, { sz: 13, color: INK2 }), { num: 1, after: 0 }));
      }
    }
    const legend = std === 'eucast'
      ? 'S: nhạy, liều chuẩn (Susceptible, standard dosing) · I: nhạy, tăng phơi nhiễm (Susceptible, increased exposure) · R: kháng (Resistant).'
      : 'S: nhạy (Susceptible) · I: trung gian (Intermediate) · SDD: nhạy phụ thuộc liều (Susceptible-dose dependent) · R: kháng (Resistant) · NS: không nhạy (Non-susceptible).';
    out.push(para(run(legend + ' Chữ in nghiêng và gạch chân là kết quả kháng.', { sz: 15, color: '222222' }), { before: 40, after: 20 }));

    // ---- signatures (technician | time | chief)
    const sw = [3300, 3306, 3300];
    const when = (String(m.approvedAt || '').match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/) || []);
    out.push(table(sw, [
      row([
        cell(sw[0], para(run('NGƯỜI THỰC HIỆN', { b: true, sz: 19 }), { align: 'center', keepNext: true }) + para(run('Technician', { i: true, sz: 18 }), { align: 'center', keepNext: true })),
        cell(sw[1], para(run('Giờ: ', { sz: 19 }) + run(when[2] || '', { b: true, sz: 19 }) + run('    Ngày: ', { sz: 19 }) + run(when[1] || '', { b: true, sz: 19 }), { align: 'center' }), { valign: 'top' }),
        cell(sw[2], para(run('TRƯỞNG KHOA XN', { b: true, sz: 19 }), { align: 'center', keepNext: true }) + para(run('Chief Laboratory Officer', { i: true, sz: 18 }), { align: 'center', keepNext: true })),
      ]),
      row([cell(sw[0], para('')), cell(sw[1], para('')), cell(sw[2], para(''))], { height: 300 }),
      row([cell(sw[0], para(run(en.reviewer || '', { b: true, sz: 19 }), { align: 'center' })), cell(sw[1], para(run(stdLabel, { sz: 16, color: INK2 }), { align: 'center' })), cell(sw[2], para(run(H.chief || '', { b: true, sz: 19 }), { align: 'center' }))]),
    ], { noBorders: true }));
    return out.join('');
  }

  /* ----- package ----- */
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="vi-VN" w:eastAsia="vi-VN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="16"/><w:color w:val="56636B"/></w:rPr></w:style></w:styles>`;
  const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="400" w:hanging="260"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  function footerXml(H, label) {
    const fld = (code) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const gold = `<w:pBdr><w:top w:val="single" w:sz="12" w:space="4" w:color="${GOLD}"/></w:pBdr>`;
    const line1 = `<w:p><w:pPr><w:pStyle w:val="Footer"/>${gold}</w:pPr><w:r><w:rPr><w:b/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${esc(H.name)}</w:t></w:r></w:p>`;
    const contact = [H.address, H.phone && 'ĐT: ' + H.phone, H.web].filter(Boolean).join(' · ');
    const line2 = contact ? `<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">${esc(contact)}</w:t></w:r></w:p>` : '';
    const line3 = `<w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="${W}"/></w:tabs></w:pPr><w:r><w:t xml:space="preserve">${esc(label)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">Trang </w:t></w:r>${fld('PAGE')}<w:r><w:t xml:space="preserve"> / </w:t></w:r>${fld('NUMPAGES')}</w:p>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${line1}${line2}${line3}</w:ftr>`;
  }

  /** entries: array of entry objects -> Uint8Array (.docx) */
  function buildDocx(entries, opts) {
    const o = opts || {};
    const li = logoInfo();
    DOCPR = 0;
    const imgs = [];
    const bodyXml = entries.map((en, i) => entryXml(en, i, li, imgs)).join('');
    const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="560" w:right="1000" w:bottom="900" w:left="1000" w:header="360" w:footer="240" w:gutter="0"/></w:sectPr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${bodyXml}${para('')}${sect}</w:body></w:document>`;
    const std = entries[0] && entries[0].rep && entries[0].rep.standardLabel;
    const files = [
      { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(o.title || 'Kết quả kháng sinh đồ')}</dc:title><dc:creator>${esc(o.author || 'Bệnh viện Đa khoa Lãnh Binh Thăng')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` },
      { name: 'word/_rels/document.xml.rels', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${li ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ''}${imgs.map((im) => `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${im.name}"/>`).join('')}</Relationships>` },
      { name: 'word/document.xml', text: doc },
      { name: 'word/styles.xml', text: STYLES },
      { name: 'word/numbering.xml', text: NUMBERING },
      { name: 'word/footer1.xml', text: footerXml(Object.assign({}, HOSP_DEF, (entries[0] && entries[0].hospital) || {}), `Thực hiện bằng ${((entries[0] && entries[0].hospital) || HOSP_DEF).instrument || 'Vitek 2'}`) },
    ];
    if (li) files.push({ name: 'word/media/logo.png', data: li.bytes });
    imgs.forEach((im) => files.push({ name: 'word/' + im.name, data: im.bytes }));
    return KS.zip(files);
  }

  const api = { buildDocx };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ASTDocx = api;
})(typeof window !== 'undefined' ? window : globalThis);
