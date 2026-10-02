/* Excel export in the KSNK (Khang_sinh_do_BVDKLBT) layout. No dependencies: tiny ZIP (store) + OOXML writer. */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- template */
  const ID_HEADERS = ['STT', 'NGAY LAY MAU', 'HO VA TEN', '', 'KHOA', 'TUOI', 'GIOI', 'LOAI BENH PHAM', 'TEN VI KHUAN'];
  // columns J..BQ of the template, in the original order (note: "Cefe" appears twice, Q and BF)
  const DRUG_HEADERS = ['Am/cl', 'Amik', 'Amo', 'Ampi/sul', 'Ampi', 'Bac', 'Cefa', 'Cefe', 'Cefop', 'Cefota', 'Cefoxi', 'Cefta', 'Ceftri', 'Cefu', 'Cepha', 'Cipro', 'Clin', 'Colis', 'Chloram', 'Doxy', 'Genta', 'Imi', 'Erta', 'Ery', 'Levo', 'Line', 'Mero', 'Nali', 'Neo', 'Netil', 'Nitro', 'Nor', 'Oflo', 'Oxa', 'Peni', 'Piper/tazo', 'Fos', 'Poly', 'Rifa', 'Tetra', 'Tica', 'Tobra', 'Trime/Sulfa', 'Van', 'Tige', 'Teicoplanin', 'Ticarcillin/clavulanic acid', 'Clari', 'Cefe', 'Ceftaroline', 'Ceftazidime-avibactam', 'Cefaclor', 'Moxifloxacin', 'Quinupristin/Dalfopristin', 'Piperacillin', 'Cefuroxime Axetil', 'Ceftolozane/Tazobactam', 'Imipenem/Relebactam', 'Benzylpenicillin', 'Meropenem/Vaborbactam'];
  const HEADERS = ID_HEADERS.concat(DRUG_HEADERS); // 69 columns, A..BQ
  const CEFE_NEW = HEADERS.indexOf('Cefe'); // column Q: cefepime (the template's second "Cefe" column, BF, is left empty)

  const ID_TO_HEADER = {
    AMP: 'Ampi', PEN: 'Peni', AMC: 'Am/cl', SAM: 'Ampi/sul', PIP: 'Piperacillin', TZP: 'Piper/tazo', OXA: 'Oxa', CZO: 'Cefa',
    CXM: 'Cefu', CXMA: 'Cefuroxime Axetil', FOX: 'Cefoxi', CTX: 'Cefota', CRO: 'Ceftri', CAZ: 'Cefta', CSL: 'Cefop',
    CZA: 'Ceftazidime-avibactam', CZT: 'Ceftolozane/Tazobactam', ETP: 'Erta', IPM: 'Imi', MEM: 'Mero', GEN: 'Genta', AMK: 'Amik',
    TOB: 'Tobra', CIP: 'Cipro', LVX: 'Levo', MXF: 'Moxifloxacin', SXT: 'Trime/Sulfa', TCY: 'Tetra', DOX: 'Doxy', TGC: 'Tige',
    CHL: 'Chloram', NIT: 'Nitro', FOS: 'Fos', CST: 'Colis', ERY: 'Ery', CLI: 'Clin', LNZ: 'Line', VAN: 'Van', TEC: 'Teicoplanin',
    RIF: 'Rifa', QDA: 'Quinupristin/Dalfopristin',
    TIC: 'Tica', TCC: 'Ticarcillin/clavulanic acid', PMB: 'Poly', IMR: 'Imipenem/Relebactam', CLR: 'Clari', AMX: 'Amo', CPT: 'Ceftaroline',
  };
  // Vitek names the engine does not know, matched by (normalised) raw name
  const RAW_TO_HEADER = {
    amoxicillin: 'Amo', netilmicin: 'Netil', ceftaroline: 'Ceftaroline', 'polymyxin b': 'Poly', polymyxin: 'Poly',
    'ticarcillin/clavulanic acid': 'Ticarcillin/clavulanic acid', ticarcillin: 'Tica', norfloxacin: 'Nor', ofloxacin: 'Oflo',
    'nalidixic acid': 'Nali', neomycin: 'Neo', cephalothin: 'Cepha', cefalotin: 'Cepha', cefaclor: 'Cefaclor', clarithromycin: 'Clari',
    bacitracin: 'Bac', 'imipenem/relebactam': 'Imipenem/Relebactam', 'meropenem/vaborbactam': 'Meropenem/Vaborbactam',
    cefoperazone: 'Cefop',
  };
  const normRaw = (s) => String(s || '').toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();

  /** column index (0-based) for an engine drug id, or -1 */
  function colForId(id, groupKey) {
    if (id === 'FEP') return CEFE_NEW;
    if (id === 'PEN' && ['strep_vgs', 'strep_pn', 'strep_bh', 'enterococcus'].includes(groupKey)) return HEADERS.indexOf('Benzylpenicillin');
    if (id === 'PEN_M') return HEADERS.indexOf('Benzylpenicillin');
    if (id === 'CTX_M') return HEADERS.indexOf('Cefota');
    if (id === 'CRO_M') return HEADERS.indexOf('Ceftri');
    const h = ID_TO_HEADER[id];
    return h ? HEADERS.indexOf(h) : -1;
  }
  function colForRaw(name) {
    const h = RAW_TO_HEADER[normRaw(name)];
    return h ? HEADERS.indexOf(h) : -1;
  }

  /* ---------------------------------------------------------------- rows */
  const SPEC_VI = ['Đàm', 'Dịch', 'Mủ', 'Nước tiểu', 'Máu', 'Dịch tiết', 'Phân', 'Đầu ống NKQ', 'Đầu CVC'];

  /**
   * entry: { date, name, dept, age, sex, specVi, iso, rep, reviewer, approvedAt }
   * opts:  { sttStart, sdd: 'SDD'|'I', notesSheet }
   * returns { rows: [{cells: Array(69), notes: {...}}] }
   */
  function buildRows(entries, opts) {
    const o = Object.assign({ sttStart: 1, sdd: 'SDD' }, opts || {});
    const mapCat = (c) => (c === 'SDD' ? o.sdd : c);
    return entries.map((e, i) => {
      const cells = new Array(HEADERS.length).fill(null);
      cells[0] = o.sttStart + i;
      cells[1] = e.date || '';
      cells[2] = e.name || '';
      cells[3] = null;
      cells[4] = e.dept || '';
      cells[5] = e.age === '' || e.age == null || isNaN(Number(e.age)) ? null : Number(e.age);
      cells[6] = e.sex || '';
      cells[7] = e.specVi || '';
      cells[8] = e.iso.organism || '';
      const rep = e.rep;
      const gk = rep.org && rep.org.group;
      const unmapped = [];
      const derived = [];
      let mode;
      if (rep.unsupported) {
        mode = 'Vitek nguyên trạng (KTV chọn không áp bảng CLSI)';
        e.iso.results.forEach((r) => {
          const c = colForId(r.id, gk);
          if (c < 0) { unmapped.push(r.rawName || r.id); return; }
          if (['S', 'I', 'R', 'SDD', 'NS'].includes(r.vitek)) cells[c] = mapCat(r.vitek);
        });
        (e.iso.unknown || []).forEach((u) => {
          if (!u.rec) return;
          const c = colForRaw(u.name);
          if (c < 0) { unmapped.push(u.name); return; }
          if (['S', 'I', 'R', 'SDD', 'NS'].includes(u.rec.vitek)) cells[c] = mapCat(u.rec.vitek);
        });
      } else {
        mode = rep.mapped ? `Ngoại suy theo bảng ${rep.standardLabel || 'CLSI M100-Ed36'} của nhóm khác (KTV chọn)` : `Đã lọc và diễn giải theo ${rep.standardLabel || 'CLSI M100-Ed36'}`;
        rep.reported.forEach((r) => {
          if (r.noExport) return;
          const c = colForId(r.id, gk);
          if (c < 0) { unmapped.push(r.name); return; }
          if (r.cat) cells[c] = mapCat(r.cat);
        });
        if (rep.mapped) derived.push(`Ngoại suy theo bảng "${rep.mapped.label}" (vi khuẩn không có bảng riêng trong CLSI)`);
        // Staphylococcus: the lab's sheet records the cefoxitin screen in the "Cefoxi" column
        if (/^staph/.test(gk || '')) {
          const cx = HEADERS.indexOf('Cefoxi');
          if (cells[cx] == null && rep.flags) {
            if (rep.flags.mrs) { cells[cx] = 'R'; derived.push('Cefoxi = R (suy ra từ cefoxitin screen dương tính / oxacillin kháng)'); }
            else if (rep.flags.mssa) { cells[cx] = 'S'; derived.push('Cefoxi = S (suy ra từ cefoxitin screen âm tính)'); }
          }
        }
      }
      // review notes
      const flags = [];
      if (rep.flags) {
        if (rep.flags.mrs) flags.push(gk === 'staph_aureus' ? 'MRSA' : 'MRS');
        if (rep.flags.mssa) flags.push('MSSA');
        if (rep.flags.cre) flags.push('Kháng carbapenem');
      }
      const alerts = (rep.notes || []).filter((n) => n.level === 'alert' || n.level === 'warn').map((n) => n.text);
      const hidden = (rep.hidden || []).map((h) => `${h.name}${h.reason ? ' – ' + String(h.reason).replace(/\s+/g, ' ').slice(0, 70) : ''}`);
      const missing = [];
      if (!e.date) missing.push('ngày lấy mẫu');
      if (!e.dept) missing.push('khoa');
      if (e.age === '' || e.age == null) missing.push('tuổi');
      if (!e.sex) missing.push('giới');
      return {
        cells,
        notes: {
          stt: cells[0], name: cells[2], organism: cells[8], spec: cells[7], mode,
          flags: flags.join(', '), alerts: alerts.join(' | '), derived: derived.join('; '),
          hidden: hidden.join('; '), unmapped: unmapped.join(', '), missing: missing.join(', '),
          reviewer: e.reviewer || '', approvedAt: e.approvedAt || '', resolutions: e.resolutions || '', restored: e.restored || '',
        },
      };
    });
  }

  /* ---------------------------------------------------------------- OOXML */
  const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = (n) => { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  // style ids (see STYLES below): 1 header, 2 text, 3 centered, 4 wrapped text, 5 number
  function cellXml(r, c, v, s) {
    const ref = colName(c) + r;
    if (v == null || v === '') return `<c r="${ref}" s="${s}"/>`;
    if (typeof v === 'number') return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }
  function sheetXml(header, rows, widths, styleFor, opts) {
    const o = opts || {};
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    x += `<sheetViews><sheetView workbookViewId="0"${o.first ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>`;
    x += '<sheetFormatPr defaultRowHeight="18"/>';
    x += '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    x += '<sheetData>';
    x += `<row r="1" ht="${o.headerHeight || 20}" customHeight="1">` + header.map((h, c) => cellXml(1, c, h, 1)).join('') + '</row>';
    rows.forEach((row, i) => {
      const r = i + 2;
      x += `<row r="${r}">` + row.map((v, c) => cellXml(r, c, v, styleFor(c, v))).join('') + '</row>';
    });
    x += '</sheetData>';
    x += `<autoFilter ref="A1:${colName(header.length - 1)}${Math.max(rows.length + 1, 2)}"/>`;
    x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>';
    return x;
  }
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="12"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="11"/><name val="Times New Roman"/><family val="1"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="6">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
    + '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>'
    + '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
    + '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
    + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  /* ---------------------------------------------------------------- ZIP (store) */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const enc = (s) => new TextEncoder().encode(s);
  const u16 = (v) => [v & 255, (v >>> 8) & 255];
  const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  function zip(files) {
    const parts = []; const central = []; let off = 0;
    files.forEach((f) => {
      const name = enc(f.name); const data = f.data ? f.data : enc(f.text); const crc = crc32(data);
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
      parts.push(lh, name, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += lh.length + name.length + data.length;
    });
    const cLen = central.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cLen), ...u32(off), ...u16(0)]);
    const all = [...parts, ...central, end];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0; all.forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  }

  /* ---------------------------------------------------------------- workbook */
  const NOTE_HEADERS = ['STT', 'HO VA TEN', 'TEN VI KHUAN', 'LOAI BENH PHAM', 'CACH BAO CAO', 'CANH BAO / NHAN XET', 'KET QUA SUY RA', 'THUOC KHONG XUAT (bi an) VA LY DO', 'THUOC KHONG CO COT TRONG MAU', 'THONG TIN CON THIEU', 'KIEM TRA BAT THUONG DA XU LY (KTV xac nhan)', 'THUOC LAY LAI THU CONG', 'KTV DUYET', 'THOI GIAN DUYET'];

  function buildWorkbook(entries, opts) {
    const o = Object.assign({ notesSheet: true }, opts || {});
    const built = buildRows(entries, o);
    const widths = HEADERS.map((h, i) => (i === 0 ? 7 : i === 1 ? 14 : i === 2 ? 28 : i === 3 ? 5 : i === 4 ? 22 : i === 5 ? 7 : i === 6 ? 8 : i === 7 ? 15 : i === 8 ? 36 : Math.max(9, Math.min(h.length + 3, 20))));
    const s1 = sheetXml(HEADERS, built.map((b) => b.cells), widths, (c, v) => (c === 0 || c === 5 ? 5 : c >= 9 ? 3 : 2), { first: true, freezeCols: 0 });
    const noteRows = built.map((b) => { const n = b.notes; return [n.stt, n.name, n.organism, n.spec, n.mode, n.flags && n.alerts ? n.flags + ' | ' + n.alerts : n.flags || n.alerts, n.derived, n.hidden, n.unmapped, n.missing, n.resolutions, n.restored, n.reviewer, n.approvedAt]; });
    const s2 = sheetXml(NOTE_HEADERS, noteRows, [7, 26, 30, 15, 34, 60, 40, 70, 28, 26, 70, 50, 20, 20], (c) => (c === 0 ? 5 : 4), { headerHeight: 34 });
    const sheets = [['Sheet1', s1]];
    if (o.notesSheet) sheets.push(['Ghi chu KTV', s2]);
    const files = [
      { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' + sheets.map(([n], i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', text: STYLES },
    ].concat(sheets.map(([, x], i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: x })));
    return { bytes: zip(files), built };
  }

  const api = { zip, HEADERS, DRUG_HEADERS, SPEC_VI, colForId, colForRaw, buildRows, buildWorkbook, CEFE_NEW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KSNK = api;
})(typeof window !== 'undefined' ? window : globalThis);
