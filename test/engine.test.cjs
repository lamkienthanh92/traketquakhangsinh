'use strict';
// Chạy: npm test  (node --test). Chỉ dùng dữ liệu giả, không có dữ liệu bệnh nhân thật.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const K = require('../src/ksnk.js');
const B = require('../src/barcode.js');
globalThis.ASTEngine = E; globalThis.KSNK = K; globalThis.ASTBarcode = B;
const D = require('../src/docx.js');

const R = (id, op, mic, v, raw) => ({ id, rawName: id, op, mic, vitek: v, micRaw: raw });
const iso = (organism, results, quals) => ({ organism, results, quals: quals || {}, unknown: [] });
const rep = (i, spec, std, over) => E.buildReport(i, Object.assign({}, E.DEFAULT_SETTINGS, { standard: std || 'clsi' }), { specimen: spec, groupOverride: over });
const ids = (r) => r.reported.map((x) => x.id);
const hidden = (r, id) => r.hidden.find((h) => h.id === id);

test('parser: đọc tên vi khuẩn, MIC và kết quả HLAR (SYN-S/SYN-R)', () => {
  const t = 'Patient Name: ., X Patient ID: 9 Lab ID: Z-1 Isolate Number: 1 Selected Organism : Enterococcus faecalis BP Infection Site: Source: Urine Collected: Susceptibility Information Analysis Time: 1 hours Status: Final Antimicrobial MIC Interpretation Ampicillin <= 2 S Gentamicin High Level (SYN) SYN-S Streptomycin High Level SYN-R Vancomycin 1 S';
  const p = E.parseVitekText(t);
  assert.equal(p.organism, 'Enterococcus faecalis');
  const by = Object.fromEntries(p.results.map((r) => [r.id, r]));
  assert.equal(by.AMP.mic, 2); assert.equal(by.AMP.op, '<=');
  assert.equal(by.GENHL.vitek, 'S'); assert.equal(by.STRHL.vitek, 'R');
});

test('phân nhóm vi khuẩn và gợi ý cho "con lạ"', () => {
  const g = (n) => E.classifyOrganism(n).group;
  assert.equal(g('Escherichia coli'), 'enterobacterales');
  assert.equal(g('Pseudomonas aeruginosa'), 'pseudomonas');
  assert.equal(g('Pseudomonas putida'), 'other_nonent');
  assert.equal(g('Streptococcus pneumoniae'), 'strep_pn');
  assert.equal(g('Streptococcus agalactiae'), 'strep_bh');
  assert.equal(g('Streptococcus mitis'), 'strep_vgs');
  assert.equal(g('Aeromonas hydrophila'), 'aeromonas');
  assert.equal(g('Neisseria gonorrhoeae'), 'ngon');
  assert.equal(g('Bacteroides fragilis'), 'anaerobe');
  assert.equal(g('Candida albicans'), null);
  const sg = E.suggestGroups(E.classifyOrganism('Neisseria lactamica'));
  assert.ok(sg.list.length >= 1 && /Neisseria/.test(sg.note));
});

test('Enterobacterales: kháng tự nhiên ép thành R và yêu cầu làm lại', () => {
  const r = rep(iso('Klebsiella pneumoniae', [R('AMP', '<=', 2, 'S')]), 'blood');
  const amp = r.reported.find((x) => x.id === 'AMP');
  assert.equal(amp.cat, 'R');
  assert.ok(r.checks.some((c) => c.sev === 'retest' && c.block));
});

test('kháng carbapenem: cảnh báo, và carbapenemase dương làm cefepime S thành R', () => {
  const base = [R('CTX', '>=', 64, 'R'), R('IPM', '>=', 16, 'R'), R('MEM', '>=', 16, 'R'), R('ETP', '>=', 8, 'R'), R('FEP', '=', 2, 'S')];
  let r = rep(iso('Escherichia coli', base), 'blood');
  assert.ok(r.flags.cre);
  assert.ok(r.checks.some((c) => c.id === 'carba'));
  r = rep(iso('Escherichia coli', base, { CARBA: 'POS' }), 'blood');
  assert.equal(r.reported.find((x) => x.id === 'FEP').cat, 'R');
});

test('tụ cầu: MRSA từ cefoxitin screen; ICR chưa làm thì ẩn clindamycin', () => {
  const r = rep(iso('Staphylococcus aureus', [R('OXA', '>=', 4, 'R'), R('ERY', '>=', 8, 'R'), R('CLI', '<=', 0.25, 'S')], { FOXS: 'POS' }), 'wound');
  assert.ok(r.flags.mrs);
  assert.equal(hidden(r, 'CLI').kind, 'qc');
  const r2 = rep(iso('Staphylococcus aureus', [R('OXA', '>=', 4, 'R'), R('ERY', '>=', 8, 'R'), R('CLI', '<=', 0.25, 'S')], { FOXS: 'POS', ICR: 'NEG' }), 'wound');
  assert.ok(ids(r2).includes('CLI'));
});

test('tier 2/3: kết quả kháng luôn được báo (CLSI), kết quả nhạy thì ẩn theo cascade', () => {
  const r = rep(iso('Staphylococcus aureus', [R('OXA', '<=', 0.25, 'S'), R('RIF', '>=', 32, 'R')], { FOXS: 'NEG' }), 'wound');
  const rif = r.reported.find((x) => x.id === 'RIF');
  assert.ok(rif && rif.why === 'rAlways');
});

test('phế cầu: dịch não tủy chỉ báo ngưỡng viêm màng não; máu báo cả hai', () => {
  const i = iso('Streptococcus pneumoniae', [R('PEN', '=', 0.5, 'I'), R('CTX', '=', 0.5, 'S')]);
  assert.deepEqual(ids(rep(i, 'csf')).filter((x) => x.startsWith('PEN') || x.startsWith('CTX')).sort(), ['CTX_M', 'PEN_M']);
  assert.deepEqual(ids(rep(i, 'blood')).filter((x) => x.startsWith('PEN') || x.startsWith('CTX')).sort(), ['CTX', 'CTX_M', 'PEN', 'PEN_M']);
});

test('Salmonella: mẫu phân không báo cephalosporin thế hệ 3; aminoglycoside bị ẩn', () => {
  const r = rep(iso('Salmonella enterica ser. Typhi', [R('AMP', '<=', 2, 'S'), R('CTX', '<=', 1, 'S'), R('GEN', '<=', 1, 'S')]), 'stool');
  assert.ok(ids(r).includes('AMP'));
  assert.equal(hidden(r, 'CTX').kind, 'specimen');
  assert.equal(hidden(r, 'GEN').restore, 'blocked');
});

test('Enterococcus: HLAR báo S/R, aminoglycoside thường bị ẩn (kháng tự nhiên)', () => {
  // HLAR là Tier 2: chỉ mở khi ampicillin/penicillin không nhạy (cascade)
  const r = rep(iso('Enterococcus faecium', [R('AMP', '>=', 32, 'R'), R('GENHL', '=', null, 'S', 'SYN-S'), R('GEN', '=', 4, 'S')]), 'blood');
  assert.ok(ids(r).includes('GENHL'));
  assert.ok(hidden(r, 'GEN'));
});

test('Burkholderia cepacia: không báo S/I/R', () => {
  const r = rep(iso('Burkholderia cepacia', [R('CAZ', '=', 4, 'S')]), 'lrt');
  assert.equal(r.reported.length, 0);
  assert.ok(r.notes.some((n) => /breakpoint/.test(n.text)));
});

test('vi khuẩn lạ: chưa chọn nhóm thì unsupported; chọn nhóm thì có nhãn ngoại suy', () => {
  const i = iso('Gardnerella vaginalis', [R('CAZ', '<=', 1, 'S')]);
  const a = rep(i, 'blood');
  assert.ok(a.unsupported && a.needGroup);
  const b = rep(i, 'blood', 'clsi', 'other_nonent');
  assert.ok(!b.unsupported && b.mapped && b.checks.some((c) => c.id === 'mapped' && c.block));
});

test('EUCAST: I là "nhạy, tăng phơi nhiễm"; so với CLSI khác nhóm nhạy/kháng thì đánh dấu', () => {
  const i = iso('Escherichia coli', [R('CTX', '=', 2, 'I'), R('TZP', '=', 16, 'I'), R('GEN', '<=', 1, 'S')]);
  const eu = rep(i, 'blood', 'eucast');
  assert.equal(eu.reported.find((x) => x.id === 'CTX').cat, 'I');
  assert.equal(eu.reported.find((x) => x.id === 'TZP').cat, 'R');
  const cmp = E.compareStandards(i, E.DEFAULT_SETTINGS, { specimen: 'blood' });
  assert.equal(cmp.find((x) => x.id === 'TZP').diff, 'major');
  assert.equal(E.catLabel('I', 'eucast'), 'Nhạy, tăng phơi nhiễm');
});

test('EUCAST: MIC cắt ngang breakpoint thì ẩn, không báo S/I/R bừa', () => {
  const r = rep(iso('Salmonella enterica ser. Typhi', [R('AMP', '<=', 2, 'S'), R('SXT', '<=', 20, 'S')]), 'blood', 'eucast');
  assert.ok(!ids(r).includes('SXT'));
  assert.equal(hidden(r, 'SXT').kind, 'qc');
});

test('Excel KSNK: 69 cột, cefepime vào cột Q, cột BF để trống, file là zip', () => {
  assert.equal(K.HEADERS.length, 69);
  assert.equal(K.CEFE_NEW, 16);
  // cefepime là Tier 2: cần thuốc Tier 1 kháng để mở theo cascade
  const i = iso('Escherichia coli', [R('CTX', '>=', 64, 'R'), R('FEP', '=', 4, 'I'), R('GEN', '<=', 1, 'S')]);
  const entry = { date: '01/10/2026', name: 'T', dept: 'ICU', age: 40, sex: 'NAM', specVi: 'Máu', iso: i, rep: rep(i, 'blood'), reviewer: 'KTV', approvedAt: '' };
  const { bytes, built } = K.buildWorkbook([entry], { sttStart: 1, sdd: 'SDD' });
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  assert.ok(built[0].cells[16]); assert.equal(built[0].cells[57], null);
});

test('mã vạch Code 128 khớp bảng chuẩn (đối chiếu với reportlab)', () => {
  const ref = {
    'LAB-01': '11010010000100011011101010001100010001011000100110111001001110110010011100110100010001101100011101011',
    'Ab-12': '110100100001010001100010010000110100110111001001110011011001110010111010110001100011101011',
    'PJJ123C': '1101001000011101110110101101110001011011100010011100110110011100101100101110010001000110111010001101100011101011',
  };
  Object.keys(ref).forEach((t) => assert.equal(B.bits(t), ref[t], t));
  const png = B.png('LAB-01', { scale: 2, height: 40 }).bytes;
  assert.deepEqual(Array.from(png.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('Word: tạo được file .docx hợp lệ về cấu trúc, mỗi chủng một trang', () => {
  const i = iso('Escherichia coli', [R('AMP', '>=', 32, 'R'), R('GEN', '<=', 1, 'S')]);
  const r = rep(i, 'urine');
  const en = { meta: { organism: 'Escherichia coli', name: 'NGUYỄN VĂN A', labId: 'LAB-01', age: 40, sex: 'NAM' }, rep: r, reviewer: 'KTV', showMic: true, showFn: true, showBp: true, hospital: {} };
  const bytes = D.buildDocx([en, en]);
  assert.equal(bytes[0], 0x50);
  const text = Buffer.from(bytes).toString('utf8');
  assert.ok(text.includes('word/document.xml'));
  assert.ok(text.includes('PHIẾU KẾT QUẢ KHÁNG SINH ĐỒ'));
  assert.equal((text.match(/w:pageBreakBefore/g) || []).length, 1);
  assert.ok(!/NGUYỄN VĂN A\s*–\s*Kháng/.test(text)); // kết quả chỉ in chữ S/I/R
});

test('vi khuẩn chưa hỗ trợ (nấm): thuốc lạ vẫn hiện ở bảng Vitek nguyên trạng, không bị mất', () => {
  const t = 'Patient Name: ., X Patient ID: 9 Lab ID: Z-1 Isolate Number: 1 Selected Organism : Candida albicans BP Infection Site: Source: Mau Collected: Susceptibility Information Analysis Time: 1 hours Status: Final Antimicrobial MIC Interpretation Fluconazole 1 S Voriconazole <= 0.12 S Amphotericin B 0.5 S *= AES';
  const r = rep(E.parseVitekText(t), 'blood');
  assert.ok(r.unsupported && r.asIs === 'fungus');
  assert.deepEqual(r.raw.map((x) => x.name), ['Fluconazole', 'Voriconazole', 'Amphotericin B']);
  const n = rep(E.parseVitekText(t.replace('Candida albicans', 'Neisseria gonorrhoeae')), 'blood');
  assert.ok(!n.unsupported, 'Neisseria gonorrhoeae đã có bảng CLSI 2F');
});

test('CLSI Neisseria gonorrhoeae: tier 1, ceftriaxone trung gian 0,25, penicillin là tier "Other"', () => {
  const r = rep(iso('Neisseria gonorrhoeae', [R('AZM', '<=', 0.5, 'S'), R('CRO', '=', 0.25, 'I'), R('CIP', '>=', 1, 'R'), R('PEN', '=', 2, 'R')]), 'wound');
  assert.equal(r.reported.find((x) => x.id === 'CRO').cat, 'I');
  assert.equal(r.reported.find((x) => x.id === 'CIP').cat, 'R');
  assert.equal(hidden(r, 'PEN').kind, 'policy');
  assert.ok(r.checks.some((c) => c.block), 'ceftriaxone I / cipro R là kết quả hiếm cần xác nhận');
});

test('CLSI Neisseria meningitidis: tier 4 chỉ để phòng ngừa, có cảnh báo BSC', () => {
  const r = rep(iso('Neisseria meningitidis', [R('PEN', '=', 0.12, 'I'), R('CRO', '<=', 0.06, 'S'), R('CIP', '<=', 0.015, 'S')]), 'csf');
  assert.deepEqual(ids(r).sort(), ['CRO', 'PEN']);
  assert.equal(hidden(r, 'CIP').kind, 'tier4');
  assert.ok(r.footnotes.some((f) => f.key === 'nmen_bsc'));
});

test('CLSI kỵ khí: penicillin tier 1 cho Gram dương, tier 4 cho Gram âm; kháng tự nhiên aminoglycoside ở Clostridium', () => {
  const gp = rep(iso('Clostridium perfringens', [R('PEN', '<=', 0.25, 'S'), R('GEN', '=', 4, 'S')]), 'wound');
  assert.ok(ids(gp).includes('PEN')); assert.ok(hidden(gp, 'GEN'));
  const gn = rep(iso('Bacteroides fragilis', [R('PEN', '>=', 4, 'R'), R('MTZ', '<=', 2, 'S')]), 'wound');
  assert.equal(hidden(gn, 'PEN').kind, 'tier4');
  assert.ok(ids(gn).includes('MTZ'));
});

test('nhóm chỉ có ở EUCAST: CLSI báo không có bảng và gợi ý EUCAST; EUCAST báo mọi thuốc có breakpoint', () => {
  const i = iso('Listeria monocytogenes', [R('AMP', '<=', 0.5, 'S'), R('MEM', '<=', 0.12, 'S')]);
  const c = rep(i, 'blood');
  assert.ok(c.unsupported && c.euAvailable);
  const e = rep(i, 'blood', 'eucast');
  assert.ok(!e.unsupported); assert.deepEqual(ids(e).sort(), ['AMP', 'MEM']);
  assert.ok(e.notes.some((n) => /trích tự động/.test(n.text)));
});

test('Achromobacter xylosoxidans: dùng bảng "Gram âm không lên men khác" khi chọn CLSI, bảng riêng khi chọn EUCAST', () => {
  const i = iso('Achromobacter xylosoxidans', [R('TZP', '<=', 4, 'S'), R('MEM', '=', 1, 'S')]);
  assert.ok(!rep(i, 'blood').unsupported);
  assert.ok(ids(rep(i, 'blood', 'eucast')).includes('MEM'));
});

test('EUCAST kỵ khí: chọn bảng theo loài; loài không có bảng thì có cảnh báo, không báo bừa', () => {
  const ok = rep(iso('Bacteroides fragilis', [R('MTZ', '<=', 2, 'S'), R('MEM', '<=', 0.5, 'S')]), 'wound', 'eucast');
  assert.ok(ids(ok).includes('MTZ'));
  const no = rep(iso('Veillonella parvula', [R('MTZ', '<=', 2, 'S')]), 'wound', 'eucast');
  assert.equal(no.reported.length, 0);
  assert.ok(no.notes.some((n) => /không có breakpoint/.test(n.text)));
});

test('sổ phạm vi (COVERAGE) công khai đủ mục đã nạp, một phần và chưa nạp', () => {
  const st = new Set(E.COVERAGE.map((r) => r[2]));
  assert.deepEqual([...st].sort(), ['no', 'ok', 'part']);
  assert.ok(E.COVERAGE.some((r) => r[1].startsWith('Expert Rules (đủ') && r[2] === 'ok'));
  assert.ok(E.COVERAGE.some((r) => r[1].includes('cần xét nghiệm đĩa') && r[2] === 'no'));
  assert.ok(E.COVERAGE.some((r) => r[1].includes('Appendix C') && r[2] === 'no'));
});

test('tụ cầu: Appendix B3 (S. saprophyticus kháng tự nhiên fosfomycin) và loài chỉ dùng oxacillin', () => {
  const sap = rep(iso('Staphylococcus saprophyticus', [R('FOS', '<=', 16, 'S'), R('OXA', '=', 0.25, 'S')], { FOXS: 'NEG' }), 'urine');
  assert.equal(hidden(sap, 'FOS').restore, 'blocked');
  assert.ok(sap.intrinsicText.some((t) => /saprophyticus/.test(t)));
  const ps = rep(iso('Staphylococcus pseudintermedius', [R('OXA', '=', 0.25, 'S')], { FOXS: 'POS' }), 'wound');
  assert.ok(!ps.flags.mrs, 'cefoxitin screen bị bỏ qua cho S. pseudintermedius');
});

test('CLSI Table 3: gợi ý xét nghiệm bổ sung theo nhóm vi khuẩn', () => {
  const g = (org) => rep(iso(org, []), 'blood').supp.map((x) => x.id).join(',');
  assert.equal(g('Staphylococcus aureus'), '3G,3H,3I,3J,3K');
  assert.equal(g('Escherichia coli'), '3A,3B,3C,3D,3E');
  assert.equal(g('Enterococcus faecium'), '3I,3L');
  assert.equal(g('Streptococcus pneumoniae'), '3J');
});

test('EUCAST ATU: MIC trùng ATU thì có cảnh báo (không chặn duyệt)', () => {
  const r = rep(iso('Escherichia coli', [R('TZP', '=', 16, 'I'), R('CTX', '=', 1, 'S')]), 'blood', 'eucast');
  const c = r.checks.filter((x) => x.id.startsWith('atu:'));
  assert.equal(c.length, 1); assert.ok(!c[0].block);
  assert.ok(r.clinical.some((n) => /ATU/.test(n.text)));
  assert.equal(rep(iso('Escherichia coli', [R('TZP', '=', 16, 'I')]), 'blood', 'clsi').checks.filter((x) => x.id.startsWith('atu:')).length, 0);
});

test('nấm: ghi nguyên kết quả Vitek, không chọn nhóm, không chặn duyệt', () => {
  const t = 'Patient Name: ., X Patient ID: 9 Lab ID: Z-1 Isolate Number: 1 Selected Organism : Candida albicans BP Infection Site: Source: Mau Collected: Susceptibility Information Analysis Time: 1 hours Status: Final Antimicrobial MIC Interpretation Fluconazole 1 S Micafungin <= 0.06 S *= AES';
  const r = rep(E.parseVitekText(t), 'blood');
  assert.ok(r.unsupported); assert.equal(r.asIs, 'fungus'); assert.equal(r.needGroup, false);
  assert.deepEqual(r.raw.map((x) => x.name), ['Fluconazole', 'Micafungin']);
});

test('EUCAST kháng kỳ vọng: Klebsiella nhạy ampicillin bị đổi thành kháng và chặn duyệt; E. faecium clindamycin luôn kháng', () => {
  const k = rep(iso('Klebsiella pneumoniae', [R('AMP', '<=', 2, 'S'), R('CTX', '<=', 1, 'S')]), 'blood', 'eucast');
  assert.equal(k.reported.find((x) => x.id === 'AMP').cat, 'R');
  assert.ok(k.checks.some((c) => c.id === 'intr:AMP' && c.block));
  const e = rep(iso('Enterococcus faecium', [R('AMP', '>=', 32, 'R'), R('CLI', '<=', 0.25, 'S')]), 'blood', 'eucast');
  assert.ok(e.hidden.some((h) => h.id === 'CLI' && h.restore === 'blocked'));
});

test('EUCAST nhạy kỳ vọng: S. aureus kháng linezolid bị chặn duyệt để kiểm tra lại', () => {
  const r = rep(iso('Staphylococcus aureus', [R('LNZ', '>=', 16, 'R'), R('OXA', '<=', 0.25, 'S')], { FOXS: 'NEG' }), 'blood', 'eucast');
  assert.ok(r.checks.some((c) => c.id.startsWith('exps:2.1') && c.block));
  assert.equal(rep(iso('Staphylococcus aureus', [R('LNZ', '>=', 16, 'R')], { FOXS: 'NEG' }), 'blood', 'clsi').checks.filter((c) => c.id.startsWith('exps:')).length, 0);
});

test('EUCAST Expert Rules: ciprofloxacin kháng → levofloxacin kháng; ampicillin kháng ở Enterococcus → imipenem kháng; Salmonella aminoglycoside', () => {
  const e = rep(iso('Escherichia coli', [R('CIP', '>=', 4, 'R'), R('LVX', '=', 0.5, 'S')]), 'blood', 'eucast');
  assert.equal(e.reported.find((x) => x.id === 'LVX').cat, 'R');
  const en = rep(iso('Enterococcus faecalis', [R('AMP', '>=', 32, 'R'), R('IPM', '<=', 1, 'S'), R('VAN', '<=', 1, 'S')]), 'blood', 'eucast');
  assert.ok(en.rows.some((x) => x.id === 'IPM' && x.cat === 'R'));
  const sal = rep(iso('Salmonella enterica ser. Typhi', [R('GEN', '<=', 1, 'S'), R('CIP', '=', 0.5, 'I')]), 'blood', 'eucast');
  assert.ok(sal.notes.length >= 0 && sal.clinical.some((n) => /ciprofloxacin MIC >0,06/.test(n.text)));
});

test('EUCAST sàng lọc cơ chế: meropenem >0,125 và ESBL >1 mg/L; VISA chặn duyệt', () => {
  const r = rep(iso('Klebsiella pneumoniae', [R('MEM', '=', 0.5, 'S'), R('CTX', '>=', 64, 'R')]), 'blood', 'eucast');
  assert.ok(r.checks.some((c) => c.id === 'scr_carba') && r.checks.some((c) => c.id === 'scr_esbl'));
  const sa = rep(iso('Staphylococcus aureus', [R('VAN', '=', 4, 'I')], { FOXS: 'NEG' }), 'blood', 'eucast');
  assert.ok(sa.checks.some((c) => c.id === 'scr_visa' && c.block));
  assert.deepEqual(rep(iso('Escherichia coli', []), 'blood', 'eucast').supp.map((x) => x.id), ['E1', 'E2', 'E3', 'E4']);
});

test('EUCAST Expert Rules chỉ cần máy: MRSA kháng mọi β-lactam; tetracycline nhạy → doxycycline nhạy; linezolid nhạy → tedizolid nhạy', () => {
  const r = rep(iso('Staphylococcus aureus', [R('OXA', '>=', 4, 'R'), R('TCY', '<=', 1, 'S'), R('DOX', '=', 4, 'R'), R('LNZ', '=', 2, 'S'), R('TED', '=', 2, 'R'), R('AMC', '=', 2, 'S')], { FOXS: 'POS' }), 'blood', 'eucast');
  const cat = (id) => r.rows.find((x) => x.id === id).cat;
  assert.equal(cat('DOX'), 'S'); assert.equal(cat('TED'), 'S'); assert.equal(cat('AMC'), 'R');
  assert.ok(r.euApplied.some((x) => /Doxycycline: R → S/.test(x)));
});

test('EUCAST Expert Rules: piperacillin theo ampicillin ở E. coli; liên cầu viridans sàng lọc penicillin âm → β-lactam nhạy', () => {
  const e = rep(iso('Escherichia coli', [R('AMP', '<=', 2, 'S'), R('PIP', '>=', 64, 'R')]), 'blood', 'eucast');
  assert.equal(e.rows.find((x) => x.id === 'PIP').cat, 'S');
  const v = rep(iso('Streptococcus mitis', [R('PEN', '<=', 0.12, 'S'), R('AMP', '=', 1, 'I')]), 'blood', 'eucast');
  assert.equal(v.rows.find((x) => x.id === 'AMP').cat, 'S');
});

test('EUCAST Expert Rules không đổi CLSI: cùng dữ liệu, chế độ CLSI không bị suy luận EUCAST', () => {
  const r = rep(iso('Staphylococcus aureus', [R('TCY', '<=', 1, 'S'), R('DOX', '=', 4, 'R')], { FOXS: 'NEG' }), 'blood', 'clsi');
  assert.ok(!r.euApplied || r.euApplied.length === 0);
});

/* ---------- phiếu kết quả vi sinh của khoa (LIS tiếng Việt) và ảnh scan qua OCR ---------- */
// Dữ liệu giả: tên, mã BN và STT đã thay; bảng thuốc theo đúng bố cục phiếu thật.
const LIS_HEAD = (extra) => `Thời gian thực hiện: 02/11/2026 15:44
Bệnh viện ĐK Lãnh Binh Thăng
KHOA XÉT NGHIỆM STT:010101-00001
Mã BN: 12345678
PHIẾU KẾT QUẢ XÉT NGHIỆM VI SINH
Họ tên: NGUYEN VAN A
Khoa phòng: Khoa truyền nhiễm
Năm sinh: 1967 Giới tính: Nam
Bác sĩ điều trị: Bs Đoàn Hồng Phương/ Bs Đối tượng: Dịch vụ
Phạm Anh Tuấn
Chẩn đoán: Viêm phổi do vi khuẩn, không xác định; Ho Loại mẫu:
Địa chỉ: 1162/36, Đường 3/2, Phường Phú Thọ, TP. Hồ Chí Minh
Yêu cầu vi sinh: Vi khuẩn nuôi cấy và định danh hệ thống tự động (Cấy đàm)
Kết quả cấy: DƯƠNG TÍNH
${extra}`;
const LIS_TAIL = `
Bác sĩ đọc kết quả lúc: 11 giờ 38 phút, Ngày 07 tháng 11 năm 2026
TL. TRƯỞNG KHOA XÉT NGHIỆM
Diễn giải/Ghi chú:
R: Resistance (Kháng)
I: Intermediate (Trung gian)
S: Sensitive (Nhạy)`;
const LIS_TABLE = `Chủng vi sinh: Acinetobacter baumannii complex
Kháng sinh đồ:
Kháng sinh MIC (µg/mL) Interpretation
Amikacin 8 S
Ceftazidime >=64 R
Ciprofloxacin >=4 R
Colistin 1 I
Cefepime >=32 R
Imipenem/relebactam >=16 R
Imipenem >=16 R
Levofloxacin >=8 R
Meropenem 8 R
Tobramycin <=1 S
Piperacillin/Tazobactam >=128 R`;
const lis = (table, opts) => E.parseReport(LIS_HEAD(table) + LIS_TAIL, opts);

test('phiếu khoa: đọc đủ thông tin hành chính, bệnh phẩm, tuổi và 11 dòng kháng sinh', () => {
  const r = lis(LIS_TABLE);
  assert.equal(r.length, 1);
  const p = r[0];
  assert.equal(p.format, 'lis');
  assert.equal(p.organism, 'Acinetobacter baumannii complex');
  assert.equal(p.patientName, 'NGUYEN VAN A');
  assert.equal(p.patientId, '12345678');
  assert.equal(p.labId, '010101-00001');
  assert.equal(p.sex, 'NAM');
  assert.equal(p.age, 59);
  assert.equal(p.location, 'Khoa truyền nhiễm');
  assert.equal(p.physician, 'Bs Đoàn Hồng Phương/ Bs Phạm Anh Tuấn');
  assert.equal(p.source, 'đàm');
  assert.equal(p.performedDmy, '02/11/2026');
  assert.equal(p.results.length, 11);
  const by = Object.fromEntries(p.results.map((x) => [x.id, x]));
  assert.deepEqual([by.AMK.op, by.AMK.mic, by.AMK.vitek], ['=', 8, 'S']);
  assert.deepEqual([by.TOB.op, by.TOB.mic, by.TOB.vitek], ['<=', 1, 'S']);
  assert.deepEqual([by.TZP.op, by.TZP.mic, by.TZP.vitek], ['>=', 128, 'R']);
  assert.equal(by.CST.vitek, 'I');
  assert.equal(by.IMR.mic, 16);
  assert.equal(p.readWarnings.length, 0);
  assert.equal(p.unknown.length, 0);
});

test('phiếu khoa: kết quả đi qua engine, Acinetobacter được áp bảng CLSI', () => {
  const p = lis(LIS_TABLE)[0];
  const r = rep(p, 'lrt');
  assert.ok(!r.unsupported);
  assert.ok(r.reported.length > 0);
  assert.ok(!r.checks.some((c) => c.id === 'ocr'), 'phiếu chữ không phải OCR nên không có mục OCR');
});

test('OCR: sửa lỗi ký tự thường gặp và báo cho KTV', () => {
  const noisy = `Ching vi sinh: 4cinetobacter baumannii complex
Khang sinh do:
| Khang sinh MIC (pg/mL) |Interpretation
| Amikacin 8 S
Ceftazidime >=64 R
Colistin l I
Levofloxacin >=§ R
Tobramycin <=] S
Piperacillin/Tazobactam | >=128 | R |`;
  const p = lis(noisy, { ocr: true })[0];
  assert.equal(p.organism, 'Acinetobacter baumannii complex');
  assert.ok(p.orgFixed);
  const by = Object.fromEntries(p.results.map((x) => [x.id, x]));
  assert.equal(by.CST.mic, 1); assert.equal(by.CST.vitek, 'I');
  assert.equal(by.LVX.mic, 8); assert.equal(by.LVX.op, '>=');
  assert.equal(by.TOB.mic, 1); assert.equal(by.TOB.op, '<=');
  assert.equal(by.TZP.mic, 128); assert.equal(by.TZP.vitek, 'R');
  assert.ok(by.CST.suspect && by.LVX.suspect && by.TOB.suspect);
  assert.ok(!by.AMK.suspect && !by.CAZ.suspect);
  assert.ok(p.readWarnings.some((w) => w.k === 'org'));
  assert.ok(p.readWarnings.filter((w) => w.k === 'mic').length >= 3);
  assert.ok(p.ocr && p.ocr.used);
});

test('OCR: dòng mất giá trị, MIC ngoài dãy chuẩn và thiếu cột Interpretation đều được báo', () => {
  const t = `Chủng vi sinh: Acinetobacter baumannii complex
Amikacin 8 S
Ceftazidime >=64 R
Meropenem 6 R
Cefepime >=32
Piperacillin/Tazobactam`;
  const p = lis(t, { ocr: true })[0];
  const by = Object.fromEntries(p.results.map((x) => [x.id, x]));
  assert.equal(by.MEM.mic, 6); assert.ok(by.MEM.suspect);
  assert.equal(by.FEP.vitek, ''); assert.ok(by.FEP.suspect);
  assert.ok(!by.TZP, 'dòng không có MIC không được bịa ra kết quả');
  const w = p.readWarnings.map((x) => x.k);
  assert.ok(w.includes('ladder') && w.includes('interp') && w.includes('skip'));
});

test('OCR: gộp các lần đọc: lấy hợp các dòng, biểu quyết khi khác nhau, ghi lại chỗ khác nhau', () => {
  const rd = (t) => lis('Chủng vi sinh: Acinetobacter baumannii complex\n' + t, { ocr: true })[0];
  const a = rd('Amikacin 8 S\nLevofloxacin >=§ R\nMeropenem 8 R\nTobramycin <1 S');
  const b = rd('Amikacin 8 S\nCeftazidime >=64 R\nLevofloxacin >=8 R\nMeropenem 6 R\nTobramycin <=1 S');
  const c = rd('Amikacin 8 S\nCeftazidime >=64 R\nLevofloxacin >=8 R\nMeropenem 8 R\nTobramycin <=1 S');
  const m = E.mergeReads([a, b, c]);
  const by = Object.fromEntries(m.results.map((x) => [x.id, x]));
  assert.equal(m.results.length, 5, 'dòng Ceftazidime chỉ hai trong ba lần thấy vẫn được giữ');
  assert.equal(by.LVX.mic, 8); assert.equal(by.LVX.suspect, false, 'hai lần đọc sạch xác nhận giá trị');
  assert.equal(by.MEM.mic, 8, 'biểu quyết 2/3 cho MIC 8, không giữ 6');
  assert.deepEqual([by.TOB.op, by.TOB.mic], ['<=', 1], 'biểu quyết 2/3 cho ≤1, không giữ <1');
  assert.ok(m.ocr.conflicts.some((c) => c.id === 'MEM') && m.ocr.conflicts.some((c) => c.id === 'TOB'));
  assert.ok(m.readWarnings.some((x) => x.k === 'single' && /Ceftazidime/.test(x.text)));
  assert.ok(by.CAZ.suspect, 'dòng chỉ thấy ở 2/3 lần đọc bị đánh dấu cần xem kỹ');
  assert.equal(m.ocr.passes, 3);
  // hai lần đọc hòa nhau: ưu tiên lần đọc không bị sửa ký tự / MIC nằm trong dãy chuẩn
  const t2 = E.mergeReads([rd('Meropenem 6 R'), rd('Meropenem 8 R')]);
  assert.equal(t2.results[0].mic, 8);
});

test('OCR: ký tự rác của đường kẻ bảng không được biến thành MIC', () => {
  const t = `Chủng vi sinh: Acinetobacter baumannii complex
Meropenem 8 ] R
Tobramycin <=1 T S :
Colistin 1 | 1
Imipenem | >=16 | R |`;
  const by = Object.fromEntries(lis(t, { ocr: true })[0].results.map((x) => [x.id, x]));
  assert.deepEqual([by.MEM.op, by.MEM.mic, by.MEM.vitek], ['=', 8, 'R'], '] giữa MIC và S/I/R không được đọc thành MIC 1');
  assert.deepEqual([by.TOB.op, by.TOB.mic, by.TOB.vitek], ['<=', 1, 'S']);
  assert.deepEqual([by.CST.mic, by.CST.vitek], [1, 'I'], '1 cuối dòng sau MIC là chữ I bị đọc nhầm');
  assert.deepEqual([by.IPM.op, by.IPM.mic, by.IPM.vitek], ['>=', 16, 'R']);
});

test('OCR: chủng đọc bằng OCR luôn có mục chặn duyệt cho tới khi KTV xác nhận', () => {
  const p = lis(LIS_TABLE, { ocr: true })[0];
  const r = rep(p, 'lrt');
  const c = r.checks.find((x) => x.id === 'ocr');
  assert.ok(c && c.block && c.sev === 'confirm');
  assert.equal(r.checks[0].id, 'ocr', 'mục OCR đứng đầu danh sách');
  // chủng chưa có bảng (ghi nguyên) vẫn phải có mục OCR
  const q = Object.assign({}, p, { organism: 'Candida albicans' });
  const r2 = rep(q, 'lrt');
  assert.ok(r2.unsupported && r2.checks.some((x) => x.id === 'ocr' && x.block));
});

test('phiếu khoa: văn bản PDF chạy liền một dòng và phiếu nhiều chủng', () => {
  const flow = 'PHIẾU KẾT QUẢ XÉT NGHIỆM VI SINH Họ tên: NGUYEN VAN A Năm sinh: 1967 Giới tính: Nữ Khoa phòng: Khoa hồi sức Yêu cầu vi sinh: Vi khuẩn nuôi cấy (Cấy máu) Kết quả cấy: DƯƠNG TÍNH Chủng vi sinh: Escherichia coli Kháng sinh đồ: Kháng sinh MIC (µg/mL) Interpretation Ampicillin >=32 R Gentamicin <=1 S Ciprofloxacin 0.5 I Bác sĩ đọc kết quả lúc: 08 giờ 05 phút, Ngày 07 tháng 11 năm 2026';
  const f = E.parseReport(flow)[0];
  assert.equal(f.organism, 'Escherichia coli');
  assert.equal(f.sex, 'NỮ');
  assert.equal(f.source, 'máu');
  assert.deepEqual(f.results.map((x) => x.id), ['AMP', 'GEN', 'CIP']);
  const multi = lis(`Chủng vi sinh: Escherichia coli
Ampicillin >=32 R
Gentamicin <=1 S
Chủng vi sinh: Klebsiella pneumoniae
Ampicillin >=32 R
Meropenem <=0.25 S`);
  assert.equal(multi.length, 2);
  assert.equal(multi[0].organism, 'Escherichia coli'); assert.equal(multi[0].results.length, 2);
  assert.equal(multi[1].organism, 'Klebsiella pneumoniae'); assert.equal(multi[1].results.length, 2);
  assert.equal(multi[1].patientName, 'NGUYEN VAN A');
});

test('phiếu khoa: cấy âm tính không có kháng sinh đồ; tự nhận dạng không làm hỏng báo cáo Vitek', () => {
  const neg = E.parseReport(LIS_HEAD('').replace('DƯƠNG TÍNH', 'ÂM TÍNH') + LIS_TAIL);
  assert.equal(neg.length, 1); assert.equal(neg[0].culture, 'negative'); assert.equal(neg[0].results.length, 0);
  const t = 'Patient Name: ., X Patient ID: 9 Lab ID: Z-1 Isolate Number: 1 Selected Organism : Escherichia coli BP Infection Site: Source: Urine Collected: Susceptibility Information Analysis Time: 1 hours Status: Final Antimicrobial MIC Interpretation Ampicillin <= 2 S Gentamicin <= 1 S';
  assert.equal(E.detectFormat(t), 'vitek');
  const v = E.parseReport(t);
  assert.equal(v.length, 1); assert.equal(v[0].format, 'vitek'); assert.equal(v[0].results.length, 2);
  assert.equal(E.parseReport('xin chào').length, 0);
});

test('khớp tên thuốc gần đúng không nhầm sang thuốc khác', () => {
  assert.equal(E.matchDrug('Cefepime').id, 'FEP');
  assert.equal(E.matchDrug('Cefepimc').id, 'FEP');
  assert.equal(E.matchDrug('Ampicilin').id, 'AMP');
  assert.equal(E.matchDrug('Imipenem / relebactam').id, 'IMR');
  assert.equal(E.matchDrug('Piperacillin-Tazobactam').id, 'TZP');
  assert.equal(E.matchDrug('Cefixime').id, 'CFM');
  assert.equal(E.matchDrug('xyzzy'), null);
});

test('phiếu khoa: văn bản chạy liền, "Loại mẫu:" để trống không được ăn sang trường kế tiếp', () => {
  const flow = 'Chẩn đoán: Viêm phổi Loại mẫu: Địa chỉ: 12 Lê Lợi Yêu cầu vi sinh: Vi khuẩn nuôi cấy (Cấy đàm) Kết quả cấy: DƯƠNG TÍNH Chủng vi sinh: Escherichia coli Kháng sinh đồ: Ampicillin >=32 R';
  const p = E.parseReport(flow)[0];
  assert.equal(p.source, 'đàm');
  assert.equal(p.address, '12 Lê Lợi');
  assert.equal(p.diagnosis, 'Viêm phổi');
});
