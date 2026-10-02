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
