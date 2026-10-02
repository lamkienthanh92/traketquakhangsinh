/* =====================================================================
 * AST engine: Vitek 2 (bioMérieux) report parser + CLSI M100-Ed36 (2026)
 * reporting rules.  Pure JS, no dependencies.
 *
 * Data sources (all read from the supplied M100-Ed36 PDF):
 *   Tier tables      : Table 1A-1 (Enterobacterales), 1C (Staphylococcus),
 *                      1H-2 (Viridans group streptococci)
 *   MIC breakpoints  : Table 2A-1, 2C, 2H-2
 *   Dosing           : Table 2 Dosages
 *   Intrinsic R      : Appendix B (B1, B3)
 *   Comments/footnotes: Table 1 footnotes + Table 2 comments
 * Cascade rules are NOT defined by CLSI ("rules established at each
 * institution") – the triggers below are editable examples.
 * ===================================================================== */
(function (root) {
  'use strict';

  const EDITION = 'CLSI M100-Ed36 (2026)';

  /* ------------------------------------------------------------------ */
  /* 1. Drug dictionary (Vitek names -> internal ids)                     */
  /* ------------------------------------------------------------------ */
  const DRUGS = {
    AMP: ['Ampicillin', ['ampicillin']],
    PEN: ['Penicillin', ['benzylpenicillin', 'penicillin', 'penicillin g']],
    AMC: ['Amoxicillin-clavulanate', ['amoxicillin/clavulanic acid', 'amoxicillin/clavulanate', 'amoxicillin-clavulanate']],
    SAM: ['Ampicillin-sulbactam', ['ampicillin/sulbactam']],
    PIP: ['Piperacillin', ['piperacillin']],
    TZP: ['Piperacillin-tazobactam', ['piperacillin/tazobactam']],
    OXA: ['Oxacillin', ['oxacillin']],
    CZO: ['Cefazolin', ['cefazolin']],
    CXM: ['Cefuroxime', ['cefuroxime']],
    CXMA: ['Cefuroxime axetil (uống)', ['cefuroxime axetil']],
    FOX: ['Cefoxitin', ['cefoxitin']],
    CTX: ['Cefotaxime', ['cefotaxime']],
    CRO: ['Ceftriaxone', ['ceftriaxone']],
    CAZ: ['Ceftazidime', ['ceftazidime']],
    FEP: ['Cefepime', ['cefepime']],
    CSL: ['Cefoperazone-sulbactam', ['cefoperazone/sulbactam']],
    ATM: ['Aztreonam', ['aztreonam']],
    CZA: ['Ceftazidime-avibactam', ['ceftazidime/avibactam']],
    CZT: ['Ceftolozane-tazobactam', ['ceftolozane/tazobactam']],
    ETP: ['Ertapenem', ['ertapenem']],
    IPM: ['Imipenem', ['imipenem']],
    MEM: ['Meropenem', ['meropenem']],
    GEN: ['Gentamicin', ['gentamicin']],
    AMK: ['Amikacin', ['amikacin']],
    TOB: ['Tobramycin', ['tobramycin']],
    CIP: ['Ciprofloxacin', ['ciprofloxacin']],
    LVX: ['Levofloxacin', ['levofloxacin']],
    MXF: ['Moxifloxacin', ['moxifloxacin']],
    SXT: ['Trimethoprim-sulfamethoxazole', ['trimethoprim/sulfamethoxazole']],
    TCY: ['Tetracycline', ['tetracycline']],
    DOX: ['Doxycycline', ['doxycycline']],
    MNO: ['Minocycline', ['minocycline']],
    TGC: ['Tigecycline', ['tigecycline']],
    CHL: ['Chloramphenicol', ['chloramphenicol']],
    NIT: ['Nitrofurantoin', ['nitrofurantoin']],
    FOS: ['Fosfomycin', ['fosfomycin']],
    CST: ['Colistin', ['colistin']],
    ERY: ['Erythromycin', ['erythromycin']],
    CLI: ['Clindamycin', ['clindamycin']],
    LNZ: ['Linezolid', ['linezolid']],
    VAN: ['Vancomycin', ['vancomycin']],
    TEC: ['Teicoplanin', ['teicoplanin']],
    DAP: ['Daptomycin', ['daptomycin']],
    RIF: ['Rifampin (rifampicin)', ['rifampicin', 'rifampin']],
    QDA: ['Quinupristin-dalfopristin', ['quinupristin/dalfopristin']],
    MUP: ['Mupirocin', ['mupirocin']],
    FUS: ['Fusidic acid', ['fusidic acid']],
    TIC: ['Ticarcillin', ['ticarcillin']],
    TCC: ['Ticarcillin-clavulanate', ['ticarcillin/clavulanic acid', 'ticarcillin/clavulanate']],
    DOR: ['Doripenem', ['doripenem']],
    PMB: ['Polymyxin B', ['polymyxin b']],
    FDC: ['Cefiderocol', ['cefiderocol']],
    IMR: ['Imipenem-relebactam', ['imipenem/relebactam']],
    SUD: ['Sulbactam-durlobactam', ['sulbactam/durlobactam']],
    AZM: ['Azithromycin', ['azithromycin']],
    CLR: ['Clarithromycin', ['clarithromycin']],
    AMX: ['Amoxicillin', ['amoxicillin']],
    CPT: ['Ceftaroline', ['ceftaroline']],
    TED: ['Tedizolid', ['tedizolid']],
    GENHL: ['Gentamicin mức cao (HLAR)', ['gentamicin high level', 'high level gentamicin', 'gentamicin high level (syn)', 'gentamicin high-level', 'high-level gentamicin', 'gentamicin synergy', 'gentamicin hl', 'gent high level']],
    CFM: ['Cefixime', ['cefixime']], CTT: ['Cefotetan', ['cefotetan']], CZX: ['Ceftizoxime', ['ceftizoxime']], CPD: ['Cefpodoxime', ['cefpodoxime']],
    SPC: ['Spectinomycin', ['spectinomycin']], MTZ: ['Metronidazole', ['metronidazole']], CMZ: ['Cefmetazole', ['cefmetazole']],
    STRHL: ['Streptomycin mức cao (HLAR)', ['streptomycin high level', 'high level streptomycin', 'streptomycin high level (syn)', 'streptomycin high-level', 'high-level streptomycin', 'streptomycin synergy', 'streptomycin hl', 'strep high level']],
  };
  const QUALS = {
    ESBL: ['ESBL', ['esbl']],
    FOXS: ['Cefoxitin screen', ['cefoxitin screen']],
    ICR: ['Inducible clindamycin resistance', ['inducible clindamycin resistance']],
    BLAC: ['β-lactamase', ['beta-lactamase', 'beta lactamase']],
  };

  const normName = (s) => s.toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
  const ALIAS = {};
  Object.keys(DRUGS).forEach((id) => DRUGS[id][1].forEach((a) => (ALIAS[normName(a)] = { id, qual: false })));
  Object.keys(QUALS).forEach((id) => QUALS[id][1].forEach((a) => (ALIAS[normName(a)] = { id, qual: true })));
  const drugName = (id) => (DRUGS[id] ? DRUGS[id][0] : QUALS[id] ? QUALS[id][0] : id);

  /* ------------------------------------------------------------------ */
  /* 2. Vitek 2 "Microbiology Chart Report" parser                        */
  /* ------------------------------------------------------------------ */
  function parseVitekText(raw) {
    const text = String(raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const pick = (re) => { const m = text.match(re); return m ? m[1].trim() : ''; };

    const iso = {
      patientName: pick(/Patient Name:\s*(.*?)\s+Patient ID:/).replace(/^[.,\s]+/, ''),
      patientId: pick(/Patient ID:\s*(\S+)/),
      labId: pick(/Lab ID:\s*(.*?)\s+Isolate Number:/),
      isolateNo: pick(/Isolate Number:\s*(\d+)/),
      printed: pick(/Printed\s+(.*?)\s+Patient Name/),
      organism: pick(/Selected Organism\s*:\s*(.*?)\s*(?:BP Infection Site|Page \d+ of|Source:)/),
      source: pick(/Source:\s*(.*?)\s*(?:Collected:|Comments:)/),
      location: pick(/Location:\s*(.*?)\s*Physician:/),
      physician: pick(/Physician:\s*(.*?)\s*(?:Lab ID:|Isolate Number:)/),
      hospital: pick(/^(.*?)\s+bioM/),
      aesConfidence: pick(/Confidence:\s*(\w+)/),
      results: [],
      quals: {},
      unknown: [],
    };

    // Susceptibility section
    let sec = '';
    const iStart = text.search(/Susceptibility Information/);
    if (iStart >= 0) {
      sec = text.slice(iStart);
      sec = sec.replace(/^Susceptibility Information\s+Analysis Time:\s*[\d.]+\s*hours?\s+Status:\s*\w+/i, '');
      sec = sec.replace(/^\s*Antimicrobial MIC Interpretation(?:\s+Antimicrobial MIC Interpretation)?/i, '');
      const iEnd = sec.search(/\*=\s*AES|AES™ Findings|AES Findings/);
      if (iEnd >= 0) sec = sec.slice(0, iEnd);
    } else {
      sec = text;
    }
    sec = sec.replace(/\s*\/\s*/g, '/');
    // repair of names split around their value when text was rebuilt spatially
    sec = sec.replace(/(Trimethoprim\/)\s*((?:<=|>=|=)?\s*\d+(?:\.\d+)?\s+[SIR])\s*(Sulfamethoxazole)/gi, '$1$3 $2');
    sec = sec.replace(/(Inducible Clindamycin)\s*((?:NEG|POS)\s*[+-])\s*(Resistance)/gi, '$1 $3 $2');

    const RE = /([A-Za-z][A-Za-z\-.\/ ()]*?)\s+(?:(NEG|POS)\s*([+\-])|(SYN-?[SR])|(<=|>=|<|>|=)?\s*(\d+(?:\.\d+)?)\s+(SDD|NS|IE|S|I|R)([*+#@«]*))(?=\s|$)/g;
    let m;
    while ((m = RE.exec(sec))) {
      let name = m[1].trim();
      const key = normName(name);
      let hit = ALIAS[key];
      if (!hit) {
        // allow leading stray words: try trailing 1-3 words
        const words = key.split(' ');
        for (let k = 1; k < words.length && !hit; k++) hit = ALIAS[words.slice(k).join(' ')];
        if (hit) name = words.slice(words.length - words.slice(1).length).join(' ');
      }
      if (m[2] || m[4]) {
        const tok = m[2] ? m[2] : m[4];
        if (hit && hit.qual) iso.quals[hit.id] = m[2] || (/R$/i.test(m[4]) ? 'POS' : 'NEG');
        else if (hit && hit.id && (hit.id === 'GENHL' || hit.id === 'STRHL')) {
          const hiR = m[2] ? m[2] === 'POS' : /R$/i.test(m[4]);
          iso.results.push({ id: hit.id, rawName: name, op: '=', mic: null, micRaw: tok + (m[3] || ''), vitek: hiR ? 'R' : 'S', flags: '' });
        } else iso.unknown.push({ name, raw: `${tok} ${m[3] || ''}`.trim() });
        continue;
      }
      const rec = {
        id: hit && !hit.qual ? hit.id : null,
        rawName: name,
        op: m[5] || '=',
        mic: parseFloat(m[6]),
        vitek: m[7],
        flags: m[8] || '',
      };
      if (rec.id) iso.results.push(rec);
      else iso.unknown.push({ name, raw: `${rec.op} ${rec.mic} ${rec.vitek}`, rec });
    }
    return iso;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Organism classification                                           */
  /* ------------------------------------------------------------------ */
  const ENT_GENERA = ['escherichia', 'klebsiella', 'enterobacter', 'citrobacter', 'proteus', 'serratia', 'morganella', 'providencia', 'hafnia', 'raoultella', 'pantoea', 'cronobacter', 'edwardsiella', 'yersinia', 'kluyvera', 'leclercia', 'lelliottia', 'shimwellia', 'cedecea', 'ewingella', 'moellerella', 'rahnella', 'tatumella', 'buttiauxella', 'obesumbacterium', 'plesiomonas'];
  const VGS_SPECIES = ['mitis', 'oralis', 'sanguinis', 'sanguis', 'parasanguinis', 'gordonii', 'salivarius', 'vestibularis', 'mutans', 'sobrinus', 'anginosus', 'constellatus', 'intermedius', 'bovis', 'gallolyticus', 'infantarius', 'equinus', 'cristatus', 'infantis', 'peroris', 'australis', 'viridans', 'pasteurianus', 'lutetiensis', 'macedonicus', 'thermophilus', 'cristatus', 'massiliensis', 'tigurinus'];
  const BH_SPECIES = ['pyogenes', 'agalactiae', 'dysgalactiae', 'equi', 'canis', 'iniae', 'porcinus', 'groupa', 'groupb', 'groupc', 'groupg'];
  const NONFERM_GENERA = ['achromobacter', 'alcaligenes', 'elizabethkingia', 'chryseobacterium', 'ralstonia', 'sphingomonas', 'pandoraea', 'brevundimonas', 'comamonas', 'delftia', 'cupriavidus', 'roseomonas', 'sphingobacterium', 'shewanella', 'methylobacterium', 'ochrobactrum', 'pseudomonas', 'flavobacterium', 'myroides', 'empedobacter', 'weeksella', 'bordetella', 'oligella', 'psychrobacter', 'acidovorax', 'burkholderia'];
  const GRAMPOS_OTHER = ['corynebacterium', 'bacillus', 'listeria', 'lactobacillus', 'aerococcus', 'gemella', 'granulicatella', 'abiotrophia', 'leuconostoc', 'lactococcus', 'pediococcus', 'rothia', 'micrococcus', 'kocuria', 'dermabacter', 'arcanobacterium', 'trueperella', 'rhodococcus', 'nocardia', 'actinomyces', 'cutibacterium', 'propionibacterium'];
  const FUNGI_GENERA = ['candida', 'cryptococcus', 'aspergillus', 'saccharomyces', 'trichosporon', 'rhodotorula', 'malassezia', 'geotrichum', 'kodamaea', 'pichia', 'meyerozyma', 'clavispora', 'lodderomyces', 'exophiala', 'fusarium', 'penicillium', 'mucor', 'rhizopus', 'cyberlindnera', 'wickerhamomyces', 'yarrowia', 'nakaseomyces', 'diutina', 'magnusiomyces', 'blastoschizomyces', 'cutaneotrichosporon'];
  const ANAEROBE_GENERA = ['bacteroides', 'prevotella', 'fusobacterium', 'clostridium', 'clostridioides', 'veillonella', 'peptostreptococcus', 'parabacteroides', 'phocaeicola', 'finegoldia', 'anaerococcus', 'porphyromonas', 'eggerthella', 'cutibacterium', 'propionibacterium', 'actinomyces', 'paeniclostridium', 'parvimonas', 'peptoniphilus'];

  /* Groups the app has CLSI rules for (value, label). Used by the mapping chooser. */
  const GROUP_LIST = [
    ['enterobacterales', 'Enterobacterales (trừ Salmonella, Shigella)', 'both'],
    ['salshi', 'Salmonella và Shigella', 'both'],
    ['pseudomonas', 'Pseudomonas aeruginosa', 'both'],
    ['acinetobacter', 'Acinetobacter spp.', 'both'],
    ['stenotrophomonas', 'Stenotrophomonas maltophilia', 'both'],
    ['burkholderia', 'Burkholderia cepacia complex', 'both'],
    ['other_nonent', 'Gram âm không lên men khác (Pseudomonas spp. khác…)', 'clsi'],
    ['staph_aureus', 'Staphylococcus aureus', 'both'],
    ['staph_sosa', 'Staphylococcus không phải S. aureus (CoNS…)', 'both'],
    ['enterococcus', 'Enterococcus spp.', 'both'],
    ['strep_pn', 'Streptococcus pneumoniae', 'both'],
    ['strep_bh', 'Streptococcus nhóm β-tan huyết (A, B, C, G)', 'both'],
    ['strep_vgs', 'Streptococcus nhóm viridans', 'both'],
    ['haemophilus', 'Haemophilus influenzae / parainfluenzae', 'both'],
    ['ngon', 'Neisseria gonorrhoeae', 'both'],
    ['nmen', 'Neisseria meningitidis', 'both'],
    ['anaerobe', 'Vi khuẩn kỵ khí', 'both'],
    ['moraxella', 'Moraxella catarrhalis', 'eucast'], ['hpylori', 'Helicobacter pylori', 'eucast'], ['listeria', 'Listeria monocytogenes', 'eucast'],
    ['pasteurella', 'Pasteurella spp.', 'eucast'], ['campylobacter', 'Campylobacter jejuni / coli', 'eucast'], ['corynebacterium', 'Corynebacterium spp.', 'eucast'],
    ['cdiph', 'Corynebacterium diphtheriae / ulcerans', 'eucast'], ['aerococcus', 'Aerococcus sanguinicola / urinae', 'eucast'], ['kingella', 'Kingella kingae', 'eucast'],
    ['aeromonas', 'Aeromonas spp.', 'eucast'], ['achromobacter', 'Achromobacter xylosoxidans', 'eucast'], ['vibrio', 'Vibrio spp.', 'eucast'],
    ['bacillus', 'Bacillus spp. (trừ B. anthracis)', 'eucast'], ['banthracis', 'Bacillus anthracis', 'eucast'], ['brucella', 'Brucella melitensis', 'eucast'],
    ['bpseudo', 'Burkholderia pseudomallei', 'eucast'],
  ];

  function classifyOrganism(name, override) {
    const n = (name || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    const w = n.split(' ');
    const genus = w[0] || '';
    const species = w[1] || '';
    const out = { raw: name || '', genus, species, group: null, label: name || '(chưa rõ)', key: n };
    if (override && override !== 'none') { out.group = override; out.mapped = true; return out; }
    if (FUNGI_GENERA.includes(genus)) { out.fungus = true; return out; }
    if (genus === 'salmonella' || genus === 'shigella') { out.group = 'salshi'; return out; }
    if (genus === 'aeromonas') { out.group = 'aeromonas'; return out; }
    if (genus === 'vibrio') { out.group = 'vibrio'; return out; }
    if (genus === 'moraxella') { out.group = species === 'catarrhalis' ? 'moraxella' : null; return out; }
    if (genus === 'neisseria') { out.group = species === 'gonorrhoeae' ? 'ngon' : species === 'meningitidis' ? 'nmen' : null; return out; }
    if (genus === 'helicobacter') { out.group = species === 'pylori' ? 'hpylori' : null; return out; }
    if (genus === 'listeria') { out.group = species === 'monocytogenes' ? 'listeria' : null; return out; }
    if (genus === 'pasteurella') { out.group = 'pasteurella'; return out; }
    if (genus === 'campylobacter') { out.group = ['jejuni', 'coli'].includes(species) ? 'campylobacter' : null; return out; }
    if (genus === 'corynebacterium') { out.group = ['diphtheriae', 'ulcerans'].includes(species) ? 'cdiph' : 'corynebacterium'; return out; }
    if (genus === 'aerococcus') { out.group = ['sanguinicola', 'urinae'].includes(species) ? 'aerococcus' : null; return out; }
    if (genus === 'kingella') { out.group = species === 'kingae' ? 'kingella' : null; return out; }
    if (genus === 'achromobacter' && species === 'xylosoxidans') { out.group = 'achromobacter'; return out; }
    if (genus === 'bacillus') { out.group = species === 'anthracis' ? 'banthracis' : species === 'cereus' || species === 'subtilis' || species === 'licheniformis' || species === 'pumilus' || species === 'thuringiensis' ? 'bacillus' : null; return out; }
    if (genus === 'brucella') { out.group = species === 'melitensis' ? 'brucella' : null; return out; }
    if (genus === 'legionella') { out.group = species === 'pneumophila' ? 'legionella' : null; return out; }
    if (genus === 'mycobacterium') { out.group = species === 'tuberculosis' ? 'mtb' : null; return out; }
    if (ANAEROBE_GENERA.includes(genus)) { out.group = 'anaerobe'; return out; }
    if (ENT_GENERA.includes(genus)) { out.group = 'enterobacterales'; return out; }
    if (genus === 'pseudomonas') { out.group = species === 'aeruginosa' ? 'pseudomonas' : 'other_nonent'; return out; }
    if (genus === 'acinetobacter') { out.group = 'acinetobacter'; return out; }
    if (genus === 'stenotrophomonas') { out.group = 'stenotrophomonas'; return out; }
    if (genus === 'burkholderia') { out.group = species === 'pseudomallei' ? 'bpseudo' : ['cepacia', 'cenocepacia', 'multivorans', 'vietnamiensis'].includes(species) ? 'burkholderia' : null; return out; }
    if (NONFERM_GENERA.includes(genus)) { out.group = 'other_nonent'; return out; }
    if (genus === 'staphylococcus') { out.group = ['aureus', 'argenteus', 'schweitzeri'].includes(species) ? 'staph_aureus' : 'staph_sosa'; return out; }
    if (genus === 'enterococcus') { out.group = 'enterococcus'; return out; }
    if (genus === 'haemophilus') { out.group = ['influenzae', 'parainfluenzae'].includes(species) ? 'haemophilus' : null; return out; }
    if (genus === 'streptococcus') {
      if (species === 'pneumoniae') out.group = 'strep_pn';
      else if (BH_SPECIES.includes(species) || /^group[a-z]?$/.test(species) || (w[1] === 'group' && /^[abcfg]$/.test(w[2] || ''))) out.group = 'strep_bh';
      else if (VGS_SPECIES.includes(species)) out.group = 'strep_vgs';
      return out;
    }
    return out;
  }

  /* Suggestions (by name only) for organisms with no CLSI table. CLSI M100 III.A: breakpoints must not be borrowed from a table
     in which the organism is not listed, so every suggestion carries that caveat and the technician has to confirm. */


  /* CLSI M100-Ed36 Table 3A-3L: supplemental tests. Summaries only (what, when, how to read, how to report); step-by-step methods stay in the PDF. */
  const SUPP = {
    '3A': { page: 186, title: 'Table 3A – Xét nghiệm ESBL (K. pneumoniae, K. oxytoca, E. coli, P. mirabilis)', use: 'Với breakpoint hiện hành, không cần thử ESBL thường quy trước khi báo kết quả. Nếu đã thử, dùng kết quả để hướng dẫn điều trị hoặc kiểm soát nhiễm khuẩn; chủng ESBL dương không cần đổi cephalosporin/aztreonam từ nhạy sang kháng. Riêng moxalactam, cefonicid, cefamandole, cefoperazone: ESBL dương thì báo kháng.', link: 'chỉ hướng dẫn' },
    '3B': { page: 192, title: 'Table 3B – Carba NP (Enterobacterales, P. aeruginosa)', use: 'Dùng cho điều trị (theo hướng dẫn bệnh viện), kiểm soát nhiễm khuẩn hoặc dịch tễ. Đỏ hoặc đỏ cam = âm; cam nhạt, vàng đậm, vàng = dương. Carba NP dương không làm đổi cách đọc nhạy/kháng carbapenem.', link: 'ô nhập: carbapenemase' },
    '3C': { page: 200, title: 'Table 3C – mCIM / eCIM (Enterobacterales, P. aeruginosa)', use: 'mCIM: vùng ức chế meropenem ≥19 mm (vùng trong) = âm; ngưỡng dương xem bảng gốc. eCIM chỉ đọc khi mCIM dương: tăng ≥5 mm so với mCIM = metallo-β-lactamase; tăng ≤4 mm = serine carbapenemase. Không đổi cách đọc nhạy/kháng carbapenem.', link: 'ô nhập: carbapenemase' },
    '3D': { page: 214, title: 'Table 3D – Aztreonam + ceftazidime-avibactam (broth disk elution)', use: 'Thử cho chủng đa kháng, nhất là sinh metallo-β-lactamase, để hướng dẫn điều trị. Đọc bằng mắt: không đục = nhạy; đục = không nhạy.', link: 'chỉ hướng dẫn' },
    '3E': { page: 224, title: 'Table 3E – Thử kháng colistin (Enterobacterales, P. aeruginosa)', use: 'Colistin và polymyxin B là thuốc cuối cùng cho chủng đa kháng, hiệu quả lâm sàng hạn chế. Bảng 3E mô tả các phương pháp thử riêng (inoculum và cách đọc khác với thử thường quy); xem bảng gốc để chọn và đọc.', link: 'chỉ hướng dẫn' },
    '3G': { page: 240, title: 'Table 3G – β-lactamase ở tụ cầu', use: 'Cho tụ cầu có MIC penicillin ≤0,12 µg/mL (hoặc vùng ≥29 mm). Vùng ức chế có bờ sắc ("cliff") = dương, bờ mờ ("beach") = âm. Test nitrocefin dương = dương; nitrocefin âm phải xác nhận bằng zone-edge trước khi báo penicillin nhạy. Dương = kháng penicillin, amino-, carboxy-, ureidopenicillin.', link: 'ô nhập: β-lactamase (S. aureus)' },
    '3H': { page: 244, title: 'Table 3H – Oxacillin salt agar (S. aureus)', use: '>1 khuẩn lạc hoặc màng mọc mỏng = kháng methicillin (oxacillin). Tụ cầu kháng methicillin kháng mọi β-lactam trừ ceftaroline.', link: 'chỉ hướng dẫn' },
    '3I': { page: 246, title: 'Table 3I – Vancomycin agar screen (S. aureus, Enterococcus)', use: 'Cho S. aureus có MIC vancomycin ≥8 µg/mL. >1 khuẩn lạc = nghi kháng hoặc giảm nhạy; cần xác định MIC và loài (E. gallinarum, E. casseliflavus kháng vancomycin nội tại vanC, khác với vanA/vanB). Test không phát hiện hết chủng trung gian (MIC 4 có thể sót).', link: 'chỉ hướng dẫn' },
    '3J': { page: 248, title: 'Table 3J – Kháng clindamycin cảm ứng (D-test)', use: 'Cho tụ cầu, phế cầu, liên cầu β-tan huyết khi erythromycin kháng và clindamycin nhạy hoặc trung gian. Dẹt vùng ức chế cạnh đĩa erythromycin (D-zone) hoặc mọc ở giếng = ICR: báo clindamycin kháng, có thể kèm ghi chú "nghi kháng do phát hiện kháng cảm ứng".', link: 'ô nhập: D-test' },
    '3K': { page: 252, title: 'Table 3K – Mupirocin mức cao (S. aureus)', use: 'Không có vùng ức chế (đĩa 200 µg) hoặc mọc ở giếng 256 µg/mL = kháng mupirocin mức cao; có vùng ức chế hoặc không mọc = không kháng mức cao.', link: 'chỉ hướng dẫn' },
    '3L': { page: 254, title: 'Table 3L – Kháng aminoglycoside mức cao (Enterococcus)', use: 'Gentamicin 500 µg/mL, streptomycin 1000 µg/mL (canh) hoặc 2000 µg/mL (thạch): mọc = kháng mức cao. "Nhạy" nghĩa là còn hiệp đồng với thuốc thành tế bào còn nhạy. Enterococcus có MIC ampicillin/penicillin cao (ampicillin ≥64, penicillin ≥128) có thể không còn hiệp đồng.', link: 'đọc từ Vitek (SYN-S/SYN-R)' },
  };
  const SUPP_BY_GROUP = {
    enterobacterales: ['3A', '3B', '3C', '3D', '3E'], pseudomonas: ['3B', '3C', '3E'], salshi: ['3A'],
    staph_aureus: ['3G', '3H', '3I', '3J', '3K'], staph_sosa: ['3G', '3J'], enterococcus: ['3I', '3L'], strep_pn: ['3J'], strep_bh: ['3J'],
  };
  const suppFor = (group) => (SUPP_BY_GROUP[group] || []).map((k) => Object.assign({ id: k }, SUPP[k]));


  /* EUCAST guidelines for detection of resistance mechanisms v2.0 (2017-07); page = page of that PDF (43 pages). */
  const SUPP_EU = {
    E1: { page: 4, title: 'Carbapenemase ở Enterobacterales (mục 2)', use: 'Không cần để phân loại S/I/R; cần cho kiểm soát nhiễm khuẩn và y tế công cộng. Sàng lọc: meropenem MIC >0,125 mg/L (đĩa 10 µg <28 mm) là cân bằng tốt nhất giữa độ nhạy và độ đặc hiệu; ertapenem >0,125 nhạy nhất nhưng kém đặc hiệu. Xét nghiệm kiểu hình: đĩa phối hợp meropenem (boronic acid: KPC/class A; DPA hoặc EDTA: metallo-β-lactamase; cloxacillin: loại AmpC + mất porin; temocillin MIC >128 mg/L hoặc vùng <11 mm gợi ý OXA-48), test màu (Carba NP, Blue-Carba, β-Carba), CIM, MALDI-TOF; không khuyến cáo test Hodge cải tiến. Chủng OXA-48 có thể vẫn nhạy cephalosporin.', link: 'cảnh báo sàng lọc (không có ô nhập)' },
    E2: { page: 12, title: 'ESBL ở Enterobacterales (mục 3)', use: 'Không cần để phân loại S/I/R (breakpoint cephalosporin của EUCAST phát hiện mọi cơ chế kháng quan trọng); cần cho kiểm soát nhiễm khuẩn. Sàng lọc: MIC >1 mg/L với cefotaxime/ceftriaxone và ceftazidime (hoặc cefpodoxime). Xác nhận: ceftazidime và cefotaxime ± clavulanate (đĩa phối hợp tăng vùng ≥5 mm; gradient hoặc vi pha loãng MIC giảm ≥8 lần; DDST). Nhóm 2 (Enterobacter, Serratia, C. freundii, Morganella, Providencia, Hafnia): xác nhận bằng cefepime ± clavulanate. Có thể dương tính giả ở K. oxytoca tăng sản xuất K1, Proteus vulgaris, Citrobacter koseri.', link: 'cảnh báo sàng lọc (không có ô nhập)' },
    E3: { page: 21, title: 'AmpC mắc phải ở Enterobacterales (mục 4)', use: 'Nghi AmpC mắc phải khi cefoxitin MIC >8 mg/L (vùng <19 mm) kèm kháng cefotaxime hoặc ceftazidime ở E. coli, K. pneumoniae, P. mirabilis, Salmonella, Shigella. Xác nhận bằng cloxacillin hoặc boronic acid; ở E. coli và Shigella cần PCR để phân biệt AmpC mắc phải với AmpC nhiễm sắc thể tăng sản xuất.', link: 'cảnh báo sàng lọc (không có ô nhập)' },
    E4: { page: 25, title: 'Kháng polymyxin ở trực khuẩn Gram âm (mục 5)', use: 'Cần cho phân loại lâm sàng. Chỉ dùng vi pha loãng canh với colistin sulfate; không dùng đĩa và gradient (dễ sai rất lớn và lớn). QC bằng chủng nhạy và chủng kháng mcr-1 (E. coli NCTC 13846, MIC đích 4 mg/L). Chỉ xét nghiệm cơ chế trên chủng kháng colistin.', link: 'cảnh báo khi colistin kháng' },
    E5: { page: 27, title: 'Carbapenemase ở P. aeruginosa và Acinetobacter (mục 6)', use: 'Không cần để phân loại S/I/R. Ở Acinetobacter, kháng carbapenem gần như luôn do OXA carbapenemase, chưa có xét nghiệm kiểu hình thỏa đáng. Ở P. aeruginosa xét nghiệm carbapenemase có ý nghĩa nhất (kháng còn do bơm đẩy, mất porin); test màu tốt hơn các test khác nhưng vẫn cần xác nhận bằng gen.', link: 'cảnh báo khi kháng carbapenem' },
    E6: { page: 29, title: 'MRSA (mục 7)', use: 'Cần cho phân loại lâm sàng. Cefoxitin là chất chỉ thị tốt nhất: MIC >4 mg/L (đĩa 30 µg <22 mm) = kháng methicillin. Không khuyến cáo sàng lọc bằng đĩa oxacillin. Nếu phát hiện mecA/mecC ngẫu nhiên hoặc khi điều trị thất bại thì luôn báo kháng. Có chủng mecA dương nhưng nhạy cefoxitin và oxacillin (OS-MRSA, ~3%) chỉ phát hiện bằng phương pháp phân tử.', link: 'đã tích hợp (cefoxitin MIC/screen)' },
    E7: { page: 32, title: 'S. aureus không nhạy glycopeptide: VISA, VRSA, hVISA (mục 8)', use: 'MIC vancomycin >2 mg/L = kháng (VISA 4–8; VRSA >8, do vanA). hVISA (MIC ≤2 nhưng có quần thể con) không phát hiện được bằng MIC; xác nhận bằng PAP-AUC ở labo tham chiếu. Vi pha loãng canh là chuẩn vàng (gradient có thể cao hơn 0,5–1 bậc). Chủng MIC >2 xác nhận nên gửi labo tham chiếu.', link: 'cảnh báo chặn duyệt khi MIC >2' },
    E8: { page: 36, title: 'VRE: E. faecium và E. faecalis (mục 9)', use: 'MIC vancomycin >4 mg/L. Ủ đủ 24 giờ để thấy kháng cảm ứng; vanB khó phát hiện hơn vanA (kể cả bằng máy tự động). Cần chắc không phải E. gallinarum/E. casseliflavus (VanC, MIC 4–16, ít quan trọng về kiểm soát nhiễm khuẩn) bị nhầm thành E. faecium (dùng MALDI-TOF, MGP, di động). Đĩa: bờ vùng sắc và ≥12 mm = nhạy; bờ mờ hoặc có khuẩn lạc trong vùng = kháng bất kể kích thước. Thạch ngưỡng: BHI + 6 mg/L vancomycin, ủ 24 giờ, >1 khuẩn lạc = dương.', link: 'cảnh báo khi MIC >4' },
    E9: { page: 41, title: 'Phế cầu giảm nhạy penicillin, không phải kiểu hoang dã (mục 10)', use: 'Không phải kiểu hoang dã khi MIC benzylpenicillin >0,06 mg/L. Viêm màng não: chủng MIC >0,06 luôn báo kháng; nhiễm khuẩn khác: dùng breakpoint không viêm màng não (app dùng bảng v16: S ≤0,06, R >1) và liều phù hợp. Sàng lọc bằng đĩa oxacillin 1 µg (<20 mm → xác định MIC) không dùng được với Vitek.', link: 'cảnh báo khi MIC >0,06' },
  };
  const SUPP_EU_BY_GROUP = {
    enterobacterales: ['E1', 'E2', 'E3', 'E4'], salshi: ['E2', 'E3'], pseudomonas: ['E4', 'E5'], acinetobacter: ['E4', 'E5'],
    staph_aureus: ['E6', 'E7'], staph_sosa: ['E6'], enterococcus: ['E8'], strep_pn: ['E9'],
  };
  const suppEuFor = (group) => (SUPP_EU_BY_GROUP[group] || []).map((k) => Object.assign({ id: k, doc: 'EUCAST detection of resistance mechanisms v2.0' }, SUPP_EU[k]));

  /* Coverage register: what the app does and does NOT do, shown in the UI ("Phạm vi") and in docs/COVERAGE.md. */
  const COVERAGE = [
    ['CLSI', 'Table 1A-1 / 2A-1 Enterobacterales', 'ok', 'MIC, tier, cascade, chú thích, liều.'],
    ['CLSI', 'Table 1A-2 / 2A-2 Salmonella, Shigella', 'ok', 'MIC; quy tắc mẫu phân.'],
    ['CLSI', 'Table 1B-1 / 2B-1 Pseudomonas aeruginosa', 'ok', ''],
    ['CLSI', 'Table 1B-2 / 2B-2 Acinetobacter', 'ok', ''],
    ['CLSI', 'Table 1B-3 / 2B-3 Burkholderia cepacia complex', 'ok', 'CLSI không có breakpoint: app không báo S/I/R.'],
    ['CLSI', 'Table 1B-4 / 2B-4 Stenotrophomonas maltophilia', 'ok', ''],
    ['CLSI', 'Table 1B-5 / 2B-5 Gram âm không lên men khác', 'ok', 'Achromobacter xylosoxidans tính vào nhóm này khi dùng CLSI.'],
    ['CLSI', 'Table 1C / 2C Staphylococcus', 'ok', 'S. aureus, S. lugdunensis (ngưỡng oxacillin như S. aureus), tụ cầu coagulase âm tính; S. pseudintermedius/intermedius/schleiferi/coagulans dùng oxacillin, bỏ qua cefoxitin screen. Chỉ MIC (cefoxitin đĩa không áp dụng).'],
    ['CLSI', 'Table 1D / 2D Enterococcus', 'ok', 'Gồm HLAR; thuốc không có trên Vitek (dalbavancin, oritavancin, telavancin, tedizolid) chưa nạp.'],
    ['CLSI', 'Table 1E / 2E Haemophilus influenzae, parainfluenzae', 'ok', ''],
    ['CLSI', 'Table 1F / 2F Neisseria gonorrhoeae', 'ok', 'Chỉ MIC (pha loãng thạch); Vitek 2 thường chỉ định danh Neisseria nên có thể không gặp PDF kháng sinh đồ.'],
    ['CLSI', 'Table 1G / 2G Streptococcus pneumoniae', 'ok', 'Gồm ngưỡng viêm màng não / không viêm màng não.'],
    ['CLSI', 'Table 1H-1 / 2H-1 Streptococcus β-tan huyết', 'ok', ''],
    ['CLSI', 'Table 1H-2 / 2H-2 Streptococcus viridans', 'ok', ''],
    ['CLSI', 'Table 1I / 2I Neisseria meningitidis', 'ok', 'Kèm cảnh báo an toàn sinh học (BSC).'],
    ['CLSI', 'Table 1J / 2J Vi khuẩn kỵ khí', 'part', 'Breakpoint dùng chung cho mọi kỵ khí (đã nạp); Vitek 2 không thử kỵ khí. Không có bảng riêng theo loài như EUCAST.'],
    ['CLSI', 'Breakpoint theo đường kính vùng ức chế (đĩa)', 'no', 'App chỉ xử lý MIC từ Vitek.'],
    ['CLSI', 'Table 3A–3L (xét nghiệm bổ sung; M100-Ed36 không có 3F)', 'part', 'Có tóm tắt mục đích, cách đọc và cách báo cho 3A, 3B, 3C, 3D, 3E, 3G, 3H, 3I, 3J, 3K, 3L, hiện theo nhóm vi khuẩn ở tab KTV. Có ô nhập kết quả cho D-test (3J), β-lactamase (3G), carbapenemase (3B/3C); HLAR (3L) đọc từ Vitek. Không có từng bước thực hiện, QC, ảnh minh họa; ESBL (3A), 3D, 3E, 3H, 3I, 3K chưa có ô nhập vì không đổi kết quả báo.'],
    ['CLSI', 'Appendix A (kết quả cần xác nhận)', 'ok', 'Cho mọi nhóm đã nạp, đối chiếu với trang PDF.'],
    ['CLSI', 'Appendix B (kháng tự nhiên)', 'ok', 'B1 (Enterobacterales), B2 (không lên men), B3 (tụ cầu), B4 (Enterococcus), phần Clostridium của B5. Novobiocin không có trên Vitek nên chỉ ghi chú.'],
    ['CLSI', 'Appendix C, D, F, H', 'no', 'Kiểm soát chất lượng, kháng sinh đồ tích lũy kỵ khí, ECV, điều chỉnh phương pháp MIC: chưa nạp.'],
    ['CLSI', 'Appendix E (SDD), Appendix G (xét nghiệm phân tử)', 'part', 'Dùng ý nghĩa SDD trên phiếu và quy tắc cefepime–carbapenemase (G3); phần còn lại của G chưa nạp.'],
    ['Chung', 'Nấm (Candida, Cryptococcus, Aspergillus…)', 'ok', 'Theo yêu cầu: không có bảng diễn giải, kết quả được ghi nguyên như Vitek đã diễn giải; không chặn duyệt, không lọc, không kiểm tra. Thuốc kháng nấm không có cột trong file Excel KSNK nên chỉ nằm ở sheet "Ghi chu KTV".'],
    ['CLSI', 'Neisseria loài khác, vi khuẩn khác ngoài M100', 'no', 'CLSI M100 không có bảng (Aeromonas, Vibrio, Listeria… : M45). Dùng EUCAST nếu có, hoặc chọn nhóm khác / ghi nguyên kết quả Vitek.'],
    ['EUCAST', 'Enterobacterales, Pseudomonas, Stenotrophomonas, Acinetobacter', 'ok', 'Nạp từ bảng PDF, có biến thể dịch não tủy / nước tiểu cho các thuốc chính.'],
    ['EUCAST', 'Staphylococcus, Enterococcus, Streptococcus A/B/C/G, S. pneumoniae, viridans, Haemophilus', 'ok', ''],
    ['EUCAST', 'Moraxella, Neisseria gonorrhoeae / meningitidis, kỵ khí (6 nhóm loài), H. pylori, Listeria, Pasteurella, Campylobacter, Corynebacterium (2 bảng), Aerococcus, Kingella, Aeromonas, Achromobacter, Vibrio, Bacillus (2 bảng), Brucella melitensis, B. pseudomallei, M. tuberculosis', 'part', 'Trích tự động từ PDF: thuốc có breakpoint số được báo hết (EUCAST không có tier/cascade). Dòng có điều kiện chưa áp dụng (dạng bào chế, chỉ định đặc biệt…) được liệt kê trong từng báo cáo. Chưa có PDF Vitek thật để thử.'],
    ['EUCAST', 'Burkholderia cepacia complex, Legionella pneumophila', 'no', 'EUCAST không có breakpoint số trong bảng (xem tài liệu hướng dẫn riêng).'],
    ['EUCAST', 'Topical agents, PK/PD cut-off, ngưỡng sàng lọc (screening cut-off)', 'no', 'Chưa nạp.'],
    ['EUCAST', 'ATU (vùng bất định kỹ thuật) theo MIC', 'part', 'Áp dụng cho các tổ hợp EUCAST liệt kê ATU MIC trong bảng: piperacillin-tazobactam và ciprofloxacin (Enterobacterales), ceftaroline (S. aureus), cefuroxime iv (H. influenzae). ATU theo đường kính vùng ức chế và các nhóm khác chưa nạp.'],
    ['EUCAST', 'Đường kính vùng ức chế (đĩa)', 'no', 'Chỉ MIC.'],
    ['EUCAST', 'Expected Resistant Phenotypes v1.2 (kháng kỳ vọng, Table 1–5)', 'ok', 'Thay Appendix B của CLSI khi chọn EUCAST: Enterobacterales + Aeromonas, trực khuẩn Gram âm không lên men, Gram dương, Haemophilus, Moraxella, Neisseria, Campylobacter, Clostridium. Kết quả nhạy ở thuốc kháng kỳ vọng bị đổi thành kháng và chặn duyệt.'],
    ['EUCAST', 'Expected Susceptible Phenotypes v1.1 (nhạy kỳ vọng)', 'ok', 'Kết quả kháng ở tổ hợp EUCAST coi là hiếm (vd. S. aureus kháng vancomycin, Enterobacterales kháng colistin) chặn duyệt để kiểm tra lại định danh và kháng sinh đồ.'],
    ['EUCAST', 'Expert Rules (đủ 10 tài liệu EUCAST công bố: Enterobacterales v3.3 2024; Staphylococcus, Streptococcus, S. pneumoniae, Enterococcus 2025; Salmonella, Haemophilus, Moraxella, Corynebacterium, Campylobacter v3.2 2019)', 'ok', 'Đã nạp mọi quy tắc làm được chỉ với máy (MIC và kết quả Vitek): suy kháng/nhạy từ thuốc chỉ thị (piperacillin theo ampicillin, tetracycline → doxycycline/minocycline/tigecycline, linezolid → tedizolid, penicillin → aminopenicillin/cephalosporin/carbapenem ở liên cầu, cefoxitin screen → mọi β-lactam ở MRSA, ciprofloxacin/levofloxacin kháng → mọi fluoroquinolone, Enterococcus ampicillin kháng → imipenem, E. faecium clindamycin, Salmonella aminoglycoside/cephalosporin thế hệ 2, Campylobacter erythromycin → azithromycin/clarithromycin…), cảnh báo AmpC, ESBL, HLAR, vanB, ICR. Mỗi lần áp dụng được ghi ở mục "Quy tắc EUCAST đã áp dụng" của tab KTV. Trang chính thức của EUCAST ghi các nhóm khác (Pseudomonas, Acinetobacter, Neisseria, kỵ khí, Listeria, Pasteurella, Aeromonas…) là "none": không có expert rule riêng.'],
    ['EUCAST', 'Expert Rules cần xét nghiệm đĩa hoặc xét nghiệm riêng', 'no', 'Không áp dụng được vì bệnh viện chỉ có máy Vitek: sàng lọc oxacillin 1 µg (phế cầu, viridans), benzylpenicillin 1 U (S. aureus zone-edge, Haemophilus), norfloxacin (tụ cầu, liên cầu, phế cầu, Enterococcus), nalidixic acid (Haemophilus, Moraxella), pefloxacin (Salmonella), phát hiện gen vanA/vanB, sàng lọc HLAR ở liên cầu, ICR của Corynebacterium (EUCAST không có breakpoint erythromycin cho Corynebacterium nên quy tắc không đánh giá được).'],
    ['EUCAST', 'Detection of resistance mechanisms v2.0 (2017)', 'part', 'Có tóm tắt 9 mục (carbapenemase, ESBL, AmpC, polymyxin, carbapenemase ở P. aeruginosa/Acinetobacter, MRSA, VISA/VRSA, VRE, phế cầu) ở tab KTV và các cảnh báo sàng lọc tự động theo MIC (ví dụ meropenem >0,125 mg/L). Không có từng bước thực hiện xét nghiệm.'],
    ['Chung', 'PDF Vitek thật của các nhóm mới', 'no', 'Mới thử bằng dữ liệu giả: Pseudomonas, Acinetobacter, Enterococcus, phế cầu, Haemophilus, Neisseria, kỵ khí và các nhóm EUCAST khác.'],
  ];

  function suggestGroups(org) {
    const g = org.genus || '';
    const sp = org.species || '';
    const out = [];
    const add = (group, reason) => { if (!out.some((x) => x.group === group)) out.push({ group, reason }); };
    let note = '';
    if (g === 'aeromonas' || g === 'vibrio') {
      note = 'CLSI hướng dẫn riêng cho Aeromonas và Vibrio trong tài liệu M45, không nằm trong M100.';
      add('other_nonent', 'Gram âm hiếu khí, oxidase dương; bảng Gram âm không lên men là gần nhất nhưng không liệt kê loài này.');
      add('enterobacterales', 'Cùng họ vi khuẩn đường ruột về hình thái; chỉ chọn nếu bác sĩ vi sinh đồng ý.');
    } else if (g === 'burkholderia') {
      add('burkholderia', 'Burkholderia cepacia complex (CLSI đã bỏ breakpoint).');
      add('other_nonent', 'Gram âm không lên men khác.');
      note = 'B. mallei và B. pseudomallei được CLSI M45 hướng dẫn riêng.';
    } else if (g === 'haemophilus') {
      add('haemophilus', 'Bảng Haemophilus chỉ liệt kê H. influenzae và H. parainfluenzae.');
      note = 'Loài Haemophilus khác không có breakpoint riêng trong M100 (xem CLSI M45).';
    } else if (g === 'streptococcus') {
      add('strep_bh', 'Streptococcus: nhóm β-tan huyết (A, B, C, G). Chọn nếu chủng tan huyết β.');
      add('strep_vgs', 'Streptococcus: nhóm viridans. Chọn nếu chủng không tan huyết hoặc tan huyết α.');
      add('strep_pn', 'Chỉ chọn nếu thực chất là S. pneumoniae.');
    } else if (g === 'staphylococcus') {
      add('staph_sosa', 'Tụ cầu không phải S. aureus.');
      add('staph_aureus', 'Chỉ chọn nếu thuộc S. aureus complex.');
    } else if (GRAMPOS_OTHER.includes(g)) {
      note = 'Vi khuẩn Gram dương này không có bảng riêng trong M100 (xem CLSI M45).';
      if (['abiotrophia', 'granulicatella', 'gemella', 'aerococcus', 'lactococcus', 'leuconostoc', 'pediococcus'].includes(g)) add('strep_vgs', 'Cầu khuẩn Gram dương dạng liên cầu, hay được đối chiếu với nhóm viridans.');
      add('staph_sosa', 'Cầu/trực khuẩn Gram dương; gần nhất là nhóm tụ cầu, nhưng không liệt kê loài này.');
      add('enterococcus', 'Cầu khuẩn Gram dương dạng chuỗi; chỉ chọn nếu bác sĩ vi sinh đồng ý.');
    } else if (g === 'neisseria') {
      add('ngon', 'Chỉ chọn nếu thực chất là N. gonorrhoeae.'); add('nmen', 'Chỉ chọn nếu thực chất là N. meningitidis.');
      note = 'Neisseria loài khác (thường không gây bệnh) không có breakpoint trong CLSI M100 và EUCAST.';
    } else if (g === 'moraxella' || g === 'helicobacter' || g === 'listeria' || g === 'campylobacter' || g === 'kingella' || g === 'aerococcus') {
      note = 'Loài này không nằm trong bảng của CLSI M100/EUCAST (xem tài liệu CLSI M45 hoặc hướng dẫn "no breakpoints" của EUCAST).';
    } else if (g === 'candida' || g === 'cryptococcus' || g === 'aspergillus') {
      note = 'Nấm: ngoài phạm vi CLSI M100 (xem CLSI M27/M60).';
    } else if (NONFERM_GENERA.includes(g)) {
      add('other_nonent', 'Gram âm không lên men khác (Table 2B-5).');
    } else {
      note = 'Không nhận ra tên vi khuẩn này. Chọn nhóm theo nhận định của bác sĩ vi sinh, hoặc ghi nguyên kết quả Vitek.';
    }
    return { list: out, note };
  }

  /* ------------------------------------------------------------------ */
  /* 4. Breakpoint evaluation                                             */
  /* ------------------------------------------------------------------ */
  // bp = { s, r, sdd:[lo,hi], i:[lo,hi], sNone:true (no S category, e.g. colistin), iMax }
  function catOf(x, bp) {
    if (bp.sNone) {
      if (x <= bp.iMax) return 'I';
      return 'R';
    }
    if (!bp.noS && x <= bp.s) return 'S';
    if (bp.r == null) return 'NS';
    if (x >= bp.r) return 'R';
    if (bp.sdd) return 'SDD';
    return 'I';
  }
  function classify(mic, op, bp) {
    let lo, hi;
    if (op === '<=' || op === '<') { lo = 0; hi = mic; }
    else if (op === '>=' || op === '>') { lo = mic; hi = Infinity; }
    else { lo = hi = mic; }
    const a = catOf(lo, bp), b = catOf(hi, bp);
    if (a === b) return { cat: a };
    return { cat: null, ambiguous: [a, b] };
  }
  const NONS = (c) => c === 'I' || c === 'R' || c === 'SDD' || c === 'NS';

  function bpText(bp) {
    const f = (x) => String(x);
    if (!bp) return '';
    if (bp.eu) {
      const parts = [];
      if (bp.noS) parts.push(`I ≤${f(bp.rGt)}`);
      else { parts.push(`S ≤${f(bp.s)}`); if (bp.rGt > bp.s) parts.push(`I >${f(bp.s)}–${f(bp.rGt)}`); }
      parts.push(`R >${f(bp.rGt)}`);
      return parts.join(' · ') + (bp.bracket ? ' (trong ngoặc)' : '');
    }
    if (bp.sNone) return `I ≤${f(bp.iMax)} · R ≥${f(bp.iMax * 2)}`;
    if (bp.noS) return `SDD ≤${f(bp.sdd[1])} · R ≥${f(bp.r)}`;
    const parts = [`S ≤${f(bp.s)}`];
    if (bp.sdd) parts.push(bp.sdd[0] === bp.sdd[1] ? `SDD ${f(bp.sdd[0])}` : `SDD ${f(bp.sdd[0])}–${f(bp.sdd[1])}`);
    else if (bp.r != null) {
      if (bp.i) parts.push(bp.i[0] === bp.i[1] ? `I ${f(bp.i[0])}` : `I ${f(bp.i[0])}–${f(bp.i[1])}`);
    }
    if (bp.r != null) parts.push(`R ≥${f(bp.r)}`);
    else parts.push('không có R (NS = không nhạy)');
    return parts.join(' · ');
  }

  /* ------------------------------------------------------------------ */
  /* 5. Footnote library (paraphrased, Vietnamese; with M100 reference)   */
  /* ------------------------------------------------------------------ */
  const FN = {
    ngon_note: ['Nên nuôi cấy và thử kháng sinh đồ N. gonorrhoeae khi điều trị thất bại; các thuốc tier 1 là mức tối thiểu cần thử. Hướng dẫn điều trị và thử mới nhất lấy từ CDC.', 'Table 1F fn a'],
    ngon_inter: ['N. gonorrhoeae: kết quả trung gian nghĩa là lỗi kỹ thuật cần thử lại hoặc chưa có kinh nghiệm lâm sàng với chủng này (ngoại trừ cefotetan); breakpoint đĩa của ceftriaxone đang tạm thời được CLSI bỏ để xem xét, chỉ dùng MIC.', 'Table 2F (4), (9)'],
    ngon_bla: ['Test β-lactamase dương dự đoán kháng penicillin, ampicillin và amoxicillin; kháng qua cơ chế nhiễm sắc thể chỉ phát hiện bằng đĩa hoặc pha loãng thạch.', 'Table 2F (6), (7)'],
    ngon_unk: ['Hiệu quả lâm sàng của cefotetan, cefoxitin và spectinomycin với chủng cho kết quả trung gian chưa được biết.', 'Table 2F (3)'],
    nmen_bsc: ['AN TOÀN: mọi thao tác thử kháng sinh đồ N. meningitidis phải làm trong tủ an toàn sinh học (BSC); thao tác ngoài BSC có nguy cơ lây bệnh màng não mô cầu cho nhân viên (tử vong 50% khi mắc trong phòng xét nghiệm). Nếu không có BSC, chuyển chủng đến labo tham chiếu.', 'Table 1I fn a, b'],
    nmen_pro: ['Chỉ có thể phù hợp để phòng ngừa cho người tiếp xúc ca bệnh màng não mô cầu; breakpoint này không áp dụng để điều trị bệnh nhân bị bệnh xâm lấn. Thử trimethoprim-sulfamethoxazole dùng để phát hiện kháng sulfonamide.', 'Table 1I fn c, d'],
    ana_gp: ['Ampicillin và penicillin là tier 1 cho kỵ khí Gram dương (đa số β-lactamase âm) và tier 4 cho kỵ khí Gram âm (nhiều chủng β-lactamase dương). Penicillin vẫn tốt với đa số Fusobacterium nên có thể thử và báo cho chi này.', 'Table 1J fn a, c'],
    ana_bla: ['Nếu chủng kỵ khí β-lactamase dương thì báo kháng penicillin và ampicillin; chủng β-lactamase âm vẫn có thể kháng penicillin/ampicillin bằng cơ chế khác.', 'Table 1J fn b'],
    ana_imr: ['Chủng nhạy imipenem được xem là nhạy imipenem-relebactam; nhạy imipenem-relebactam không suy ra nhạy imipenem.', 'Table 1J fn d'],
    ana_mtz: ['Nhiều trực khuẩn kỵ khí Gram dương không sinh bào tử kháng metronidazole.', 'Table 1J fn e'],
    ana_poly: ['Đa số nhiễm khuẩn kỵ khí là đa vi khuẩn nên có thể không cần thử; nếu cần chỉ thử và báo vi khuẩn dễ kháng nhất (vd. Bacteroides, Parabacteroides). Với Clostridium: thử và báo các thuốc tier 1.', 'Table 1J note 1, 2'],
    ana_method: ['Breakpoint kỵ khí của CLSI (Table 2J, CLSI M11) dành cho phương pháp pha loãng thạch; Vitek 2 không thử kháng sinh đồ kỵ khí, MIC từ phương pháp khác cần được kiểm chứng.', 'Table 2J; CLSI M11'],
    eu_I: ['EUCAST: I = "nhạy, tăng phơi nhiễm" (susceptible, increased exposure): khả năng điều trị thành công cao khi tăng phơi nhiễm thuốc (liều cao hơn hoặc truyền kéo dài theo bảng liều EUCAST). S = nhạy với liều chuẩn; R = kháng, thất bại điều trị dù đã tăng phơi nhiễm.', 'EUCAST Notes (định nghĩa S, I, R); Note 15'],
    eu_offscale: ['Breakpoint S ≤0,001 mg/L là mức "ngoài thang": chủng kiểu hoang dã được xếp I (nhạy, tăng phơi nhiễm); không bao giờ báo S (nhạy liều chuẩn) cho tổ hợp thuốc – vi khuẩn này.', 'EUCAST Note 13'],
    eu_bracket: ['Breakpoint trong ngoặc ( ) dựa trên ECOFF, dùng để phân biệt chủng có hay không có cơ chế kháng mắc phải. Thường thiếu bằng chứng khi dùng đơn trị; chỉ dùng cho chỉ định cụ thể hoặc phối hợp thuốc hoạt tính khác. Chủng kháng báo R; nên tránh báo S hoặc I, nếu báo thì phải kèm ghi chú về biện pháp bổ trợ.', 'EUCAST Notes 11, 12'],
    eu_ent_ceph: ['Breakpoint cephalosporin của EUCAST cho Enterobacterales phát hiện mọi cơ chế kháng quan trọng (gồm ESBL và AmpC qua plasmid); báo theo MIC đã thử, sự có mặt ESBL không tự thay đổi phân loại. Phát hiện ESBL khuyến cáo cho y tế công cộng và kiểm soát nhiễm khuẩn.', 'EUCAST Enterobacterales, ghi chú 1 (Cephalosporins)'],
    eu_staph_mr: ['Kháng methicillin: S. aureus, S. lugdunensis có cefoxitin MIC >4 mg/L (S. saprophyticus >8 mg/L), hoặc oxacillin MIC >2 mg/L (S. aureus, S. lugdunensis, S. saprophyticus), hoặc >0,25 mg/L ở tụ cầu coagulase âm tính khác. Kháng cefoxitin = kháng mọi penicillin.', 'EUCAST Staphylococcus, ghi chú 4, 5 (Penicillins, Cephalosporins)'],
    eu_staph_pen: ['Đa số tụ cầu sinh penicillinase và một số kháng methicillin. Chủng nhạy benzylpenicillin và cefoxitin có thể báo nhạy mọi penicillin; chủng kháng benzylpenicillin nhưng nhạy cefoxitin nhạy với phối hợp chất ức chế β-lactamase và penicillin kháng penicillinase (oxacillin, cloxacillin…). Với S. aureus, đĩa kháng sinh phát hiện penicillinase tin cậy hơn MIC.', 'EUCAST Staphylococcus, ghi chú 1/A, 2/C, B'],
    eu_endo: ['EUCAST có breakpoint riêng, chặt hơn cho viêm nội tâm mạc (và viêm màng não ở phế cầu), không có mức I: vd. benzylpenicillin S ≤0,06 / R >0,06 (phế cầu) hoặc S ≤0,25 / R >0,25 (viridans). Nếu chỉ định là viêm nội tâm mạc hoặc viêm màng não hãy dùng ngưỡng riêng đó.', 'EUCAST Streptococcus pneumoniae / Viridans group (Penicillins)'],
    eu_dose: ['Breakpoint EUCAST dựa trên liều chuẩn (cho kết quả S) và liều cao (cho kết quả I) ghi trong bảng liều EUCAST; không thay thế hướng dẫn liều của quốc gia/địa phương, liều thực tế còn tùy vị trí nhiễm khuẩn và chức năng cơ quan.', 'EUCAST Dosages used to define breakpoints v16.0'],
    // ---- non-fermenters (P. aeruginosa, Acinetobacter, S. maltophilia, others)
    pa_emerge: ['P. aeruginosa có thể kháng mọi kháng sinh trong lúc điều trị; chủng ban đầu nhạy có thể trở nên kháng sau vài ngày. Nên thử lại các chủng cấy sau.', 'Table 2B-1 (4)'],
    pa_aminoglycoside: ['Dữ liệu lâm sàng về aminoglycoside đơn trị cho nhiễm trùng ngoài đường tiết niệu còn hạn chế và cho kết quả điều trị kém hơn; nên cân nhắc phối hợp thuốc và hội chẩn truyền nhiễm. Tobramycin không dự đoán gentamicin.', 'Table 2B-1 (15, 16)'],
    pa_amk_u: ['Amikacin chỉ báo cho chủng phân lập từ đường tiết niệu.', 'Table 1B-1; Table 2B-1 fn a'],
    gn_aminoglycoside: ['Dữ liệu lâm sàng về aminoglycoside đơn trị cho nhiễm trùng ngoài đường tiết niệu còn hạn chế và cho kết quả điều trị kém hơn; nên cân nhắc phối hợp thuốc và hội chẩn truyền nhiễm.', 'Table 2B-5 / Table 2B-2 (aminoglycosides)'],
    fdc_note: ['Kết quả cefiderocol bị ảnh hưởng nhiều bởi nồng độ sắt và cách chuẩn bị mẫu cấy, có thể ra kháng giả hoặc nhạy giả. Nên thử lại ở các chủng sau và trao đổi với bác sĩ kê đơn, dược lâm sàng.', 'Table 2B-1 (9); Table 2B-2 (7); Table 2B-4 (4)'],
    bl_combo: ['Chủng nhạy với β-lactam đơn lẻ thì nhạy với dạng phối hợp chất ức chế; ngược lại không suy ra được.', 'Table 2B-1 (7); Table 2B-2 (4); Table 2B-5 (4)'],
    colistin_warn: ['Colistin/polymyxin B có hiệu quả lâm sàng hạn chế dù kết quả trung gian; ưu tiên thuốc khác, dùng phối hợp với ít nhất 1 thuốc còn hoạt tính, có liều nạp và liều tối đa chỉnh theo thận; dùng toàn thân thường không hiệu quả cho viêm phổi; nên hội chẩn truyền nhiễm.', 'Table 2B-1 (10–13); Table 2B-2 (8–11)'],
    acb_mino: ['Nên thử trực tiếp minocycline. Nếu không thử được: doxycycline MIC ≤1 hoặc tetracycline MIC ≤4 được xem là nhạy minocycline.', 'Table 2B-2 (13)'],
    acb_fdc: ['Cefiderocol chỉ báo cho A. baumannii complex.', 'Table 2B-2 (6)'],
    stm_rx: ['Rx: levofloxacin và trimethoprim-sulfamethoxazole không nên dùng đơn độc để điều trị S. maltophilia.', 'Table 2B-4 (5, 6)'],
    one_mic: ['Nhóm Gram âm không lên men khác: chỉ thử MIC, không khuyến cáo dùng đĩa kháng sinh.', 'Table 1B-5 fn b; Table 2B-5 (3)'],
    // ---- Enterococcus
    enc_warn: ['CẢNH BÁO: với Enterococcus, aminoglycoside (trừ thử kháng mức cao), cephalosporin, clindamycin và trimethoprim-sulfamethoxazole có thể tỏ ra nhạy in vitro nhưng không hiệu quả lâm sàng, không được báo là nhạy.', 'Table 1D fn a; Appendix B4'],
    enc_amp: ['Ampicillin dự đoán amoxicillin; ở chủng không sinh β-lactamase còn dự đoán amoxicillin-clavulanate, ampicillin-sulbactam, piperacillin-tazobactam; với E. faecalis còn dự đoán imipenem. Nhạy penicillin thì nhạy ampicillin nhưng nhạy ampicillin không suy ra nhạy penicillin.', 'Table 1D fn b, d'],
    enc_rx: ['Rx: nhiễm trùng nặng (vd. viêm nội tâm mạc) có thể cần phối hợp ampicillin, amoxicillin, penicillin liều cao đường tĩnh mạch hoặc vancomycin với aminoglycoside, trừ khi có kháng mức cao với cả gentamicin và streptomycin.', 'Table 1D fn c; Table 2D (9)'],
    enc_hlar: ['Gentamicin/streptomycin mức cao (HLAR): "nhạy" nghĩa là không kháng mức cao, còn dự đoán hiệp đồng diệt khuẩn với thuốc tác động thành tế bào; "kháng" nghĩa là mất hiệp đồng.', 'Table 1D fn e; Table 3L'],
    enc_van: ['Vancomycin: nếu MIC 8–16 µg/mL cần làm thêm thử nghiệm sinh hóa xác định loài (E. gallinarum, E. casseliflavus kháng tự nhiên). Chủng kháng vancomycin (VRE) cần báo kiểm soát nhiễm khuẩn.', 'Table 2D (11); Table 3I'],
    enc_dap: ['Daptomycin: E. faecium chỉ có mức SDD (liều 8–12 mg/kg q24h, nên hội chẩn truyền nhiễm); các Enterococcus khác dùng 6 mg/kg. Không báo thường quy cho mẫu đường hô hấp dưới. Chỉ thử MIC.', 'Table 1D fn f, g; Table 2D (13, 14)'],
    enc_fos: ['Fosfomycin chỉ báo cho E. faecalis phân lập từ đường tiết niệu.', 'Table 1D fn i; Table 2D (18)'],
    enc_lnz: ['E. faecalis nhạy linezolid được xem là nhạy tedizolid.', 'Table 2D (22)'],
    enc_urine: ['Chỉ báo cho chủng phân lập từ đường tiết niệu.', 'Table 1D (urine only); Table 2D fn a'],
    // ---- S. pneumoniae
    spn_men: ['Penicillin và cefotaxime/ceftriaxone phải thử bằng MIC. Chủng từ dịch não tủy chỉ báo ngưỡng viêm màng não; chủng từ nơi khác báo cả hai ngưỡng (viêm màng não và không viêm màng não).', 'Table 1G fn c; Table 2G (9, 10, 14, 16)'],
    spn_rx: ['Rx: cefotaxime hoặc ceftriaxone trong viêm màng não cần dùng liều tối đa.', 'Table 2G (15)'],
    spn_ery: ['Erythromycin dự đoán azithromycin và clarithromycin.', 'Table 2G (18); Table 2H-1 (10)'],
    spn_rif: ['Rx: rifampin không được dùng đơn độc.', 'Table 2G (22)'],
    spn_fq: ['Chủng nhạy levofloxacin được xem là nhạy gemifloxacin và moxifloxacin; chủng trung gian hoặc kháng levofloxacin có thể còn nhạy moxifloxacin.', 'Table 1G fn e; Table 2G (21)'],
    spn_pen: ['Rx: penicillin tĩnh mạch cho nhiễm trùng không viêm màng não 12 triệu đơn vị/ngày; chủng trung gian có thể cần 18–24 triệu đơn vị/ngày; viêm màng não 18 triệu đơn vị/ngày.', 'Table 2 Dosages (Table 2G)'],
    spn_fep: ['Cefepime cho chủng dịch não tủy: ở Mỹ chỉ báo ngưỡng không viêm màng não (không có chỉ định cefepime cho viêm màng não).', 'Table 2G (12, 13)'],
    tcy_pred: ['Chủng nhạy tetracycline được xem là nhạy doxycycline (và minocycline); nếu I/R mà cần dùng thì thử riêng.', 'Table 2B-5 (5); Table 2D (16); Table 2G (20); Table 2H-1 (13)'],
    // ---- beta-hemolytic streptococci
    sbh_pen: ['Penicillin/ampicillin là thuốc chọn lựa; không cần thử thường quy vì chủng không nhạy cực hiếm. Nếu thử mà ra không nhạy: định danh lại, thử lại, nếu xác nhận thì gửi labo y tế công cộng.', 'Table 1H-1 fn d'],
    sbh_gbs: ['Rx: dự phòng liên cầu nhóm B quanh sinh: penicillin hoặc ampicillin; cefazolin khi dị ứng nguy cơ thấp; clindamycin hoặc vancomycin khi dị ứng nguy cơ cao (thử cả erythromycin và clindamycin kể cả ICR, nhưng chỉ báo clindamycin).', 'Table 1H-1 fn b'],
    sbh_sxt: ['Trimethoprim-sulfamethoxazole chỉ thử và báo cho chủng từ nhiễm trùng da và mô mềm, không dùng cho chủng từ nơi khác (vd. họng).', 'Table 1H-1 fn i; Table 2H-1 (15)'],
    // ---- Haemophilus
    hae_amp: ['Ampicillin dự đoán amoxicillin. Chủng β-lactamase âm tính mà kháng ampicillin (BLNAR) hiếm, cần xác nhận.', 'Table 2E (10, 11); Appendix A'],
    // ---- Salmonella / Shigella
    sal_warn: ['CẢNH BÁO: với Salmonella và Shigella, aminoglycoside, cephalosporin thế hệ 1–2 và cephamycin có thể tỏ ra nhạy in vitro nhưng không hiệu quả lâm sàng, không được báo là nhạy.', 'Table 1A-2 fn b; Appendix B1'],
    sal_stool: ['Mẫu phân: chỉ báo ampicillin, fluoroquinolone và trimethoprim-sulfamethoxazole; Salmonella ngoài ruột còn báo cephalosporin thế hệ 3. Không thử thường quy Salmonella không thương hàn từ phân.', 'Table 1A-2 fn b; Table 2A-2 (13)'],
    sal_fq: ['Salmonella không nhạy fluoroquinolone có thể liên quan thất bại hoặc đáp ứng chậm khi điều trị.', 'Table 2A-2 (16)'],
    sal_azm: ['Azithromycin chỉ báo cho S. enterica ser. Typhi và Shigella spp.', 'Table 1A-2 fn d; Table 2A-2 (10, 11)'],
    sal_carba: ['Carbapenem chỉ cân nhắc cho chủng kháng mọi thuốc ở tier 1–2; dữ liệu lâm sàng còn hạn chế.', 'Table 1A-2 fn c'],
    // --- Enterobacterales
    ent_amp: ['Kết quả ampicillin dùng để dự đoán amoxicillin.', 'Table 2A-1 (5)'],
    ent_ampc: ['Citrobacter freundii complex, Enterobacter cloacae complex, Klebsiella aerogenes (nguy cơ vừa–cao), và Hafnia alvei, Morganella morganii, Providencia spp., Serratia marcescens, Yersinia enterocolitica (nguy cơ thấp hơn) có thể nhạy cephalosporin thế hệ 3 ban đầu nhưng kháng sau vài ngày điều trị do giải ức chế AmpC. Cân nhắc thử lại chủng phân lập sau; cefepime là Tier 1 cho các loài này.', 'Table 1A-1 fn b,c; Table 2A-1 (16)'],
    ent_ceph: ['Với breakpoint hiện hành, không cần thử ESBL thường quy trước khi báo cephalosporin. Việc thử ESBL (kiểu hình/gen) để hướng dẫn điều trị hoặc kiểm soát nhiễm khuẩn do BV và nhóm stewardship quyết định.', 'Table 2A-1 (15)'],
    ent_fep: ['Cefepime S/SDD phải ẩn hoặc sửa thành R nếu chủng được xác nhận sinh carbapenemase.', 'Table 2A-1 (19)'],
    ent_carba: ['Carbapenem ở mức I hoặc R: nên hội chẩn chuyên gia truyền nhiễm; với mức I có thể cân nhắc liều tối đa và truyền kéo dài. Chủng kháng bất kỳ carbapenem nào cần thử carbapenemase (kiểu hình và/hoặc sinh học phân tử, phân biệt KPC, NDM, OXA-48, VIM, IMP). Ngoại lệ: Proteus, Providencia, Morganella chỉ kháng imipenem.', 'Table 2A-1 (26)'],
    ent_imp_pm: ['Proteus, Providencia, Morganella có MIC imipenem cao hơn meropenem/ertapenem bằng cơ chế không phải carbapenemase; kết quả nhạy vẫn báo là nhạy.', 'Appendix B1 fn d; Table 2A-1 (26)'],
    ent_aminoglycoside: ['Dữ liệu lâm sàng về aminoglycoside đơn trị cho nhiễm trùng ngoài đường tiết niệu còn hạn chế và cho kết quả điều trị kém hơn các lựa chọn khác; cân nhắc phối hợp thuốc và hội chẩn chuyên gia truyền nhiễm.', 'Table 2A-1 (33)'],
    ent_nit: ['Chỉ báo cho chủng phân lập từ đường tiết niệu.', 'Table 1A-1 (Urine only)'],
    ent_fos: ['Chỉ báo cho E. coli phân lập từ đường tiết niệu; MIC chỉ thử bằng pha loãng thạch có glucose-6-phosphate.', 'Table 1A-1 fn f; Table 2A-1 (37, 39)'],
    ent_tcy: ['Chủng nhạy tetracycline được xem là nhạy doxycycline và minocycline; nếu I/R mà cần dùng thì thử riêng doxycycline/minocycline.', 'Table 2A-1 (34)'],
    ent_cst: ['Colistin/polymyxin B hiệu quả lâm sàng hạn chế (kể cả khi ở mức I); nên dùng phối hợp với ≥1 thuốc còn hoạt tính và hội chẩn truyền nhiễm. Chỉ dùng BMD, không dùng đĩa/E-test.', 'Table 2A-1 (27–32)'],
    ent_tzp_sdd: ['SDD: kết quả phụ thuộc chế độ liều; dùng liều cao/truyền kéo dài như ghi trong mục liều.', 'Table 2A-1; Table 2 Dosages'],
    // --- Staphylococcus
    st_mrs: ['Staphylococcus kháng methicillin (oxacillin) (MRS) kháng mọi β-lactam hiện có, trừ ceftaroline (chỉ S. aureus). Không cần thử các β-lactam khác (trừ ceftaroline).', 'Table 1C fn c; Table 2C (6, 12)'],
    st_pen_r: ['Với MRS, báo penicillin là kháng hoặc không báo.', 'Table 2C (10)'],
    st_pen_s: ['Penicillin MIC ≤0,12 µg/mL: phải xác nhận bằng test β-lactamase (vd. zone-edge) trước khi báo nhạy. Bệnh nặng cần điều trị penicillin: làm MIC và β-lactamase cho mọi chủng của bệnh nhân.', 'Table 2C (9); Table 3G'],
    st_oxa: ['Kết quả oxacillin (hoặc cefoxitin) áp dụng cho cloxacillin, dicloxacillin, methicillin, nafcillin. MSSA được xem là nhạy các β-lactam có hiệu quả lâm sàng đã được xác lập (tùy vị trí nhiễm và liều).', 'Table 2C (12)'],
    st_van: ['Chỉ thử MIC (đĩa không đáng tin). S. aureus nhạy có thể giảm nhạy vancomycin trong quá trình điều trị kéo dài. S. aureus có MIC vancomycin ≥8 µg/mL cần gửi labo tham chiếu.', 'Table 1C fn h; Table 2C (14–16)'],
    st_gen: ['Với tụ cầu nhạy, gentamicin chỉ dùng phối hợp với thuốc khác còn hoạt tính.', 'Table 1C fn l; Table 2C (19)'],
    st_rif: ['Rx: rifampin không được dùng đơn độc.', 'Table 1C fn k; Table 2C (24)'],
    st_cli: ['Chủng kháng erythromycin nhưng nhạy/trung gian clindamycin phải làm test kháng clindamycin cảm ứng (D-test hoặc BMD) trước khi báo clindamycin. Không báo thường quy cho mẫu đường tiết niệu.', 'Table 2C (23); Table 3J; Table 1C fn a'],
    st_cli_ind: ['Kháng clindamycin cảm ứng (ICR dương tính): báo clindamycin là kháng.', 'Table 2C (23); Table 3J'],
    st_ery: ['Azithromycin/clarithromycin được dự đoán từ erythromycin. Không báo thường quy cho mẫu đường tiết niệu.', 'Table 2C (20); Table 1C fn a'],
    st_tcy: ['Chủng nhạy tetracycline được xem là nhạy doxycycline/minocycline; nếu I/R mà cần dùng thì thử riêng.', 'Table 2C (21)'],
    st_lnz: ['S. aureus nhạy linezolid được xem là nhạy tedizolid.', 'Table 2C (26)'],
    st_dap: ['Chỉ thử MIC. Không báo thường quy cho mẫu đường hô hấp dưới.', 'Table 1C fn h,j; Table 2C (18)'],
    st_fq: ['Tụ cầu có thể phát sinh kháng quinolone trong lúc điều trị; chủng nhạy ban đầu có thể trở nên kháng sau vài ngày. Cân nhắc thử lại.', 'Table 2C (22)'],
    st_nit: ['Chỉ báo cho chủng phân lập từ đường tiết niệu.', 'Table 1C (Urine only)'],
    st_cpt: ['Ceftaroline: chỉ S. aureus (kể cả MRSA).', 'Table 1C fn g'],
    // --- Viridans group streptococci
    vgs_pen: ['Chỉ thử MIC (đĩa không đáng tin). Mẫu từ vị trí vô khuẩn (máu, dịch não tủy, xương…) phải thử penicillin bằng MIC.', 'Table 1H-2 fn a; Table 2H-2 (6)'],
    vgs_rx: ['Rx: chủng trung gian với penicillin hoặc ampicillin có thể cần phối hợp aminoglycoside để đạt tác dụng diệt khuẩn.', 'Table 1H-2 fn b; Table 2H-2 (8)'],
    vgs_bp: ['Breakpoint nhóm viridans dựa trên phân bố quần thể, dược động học và kinh nghiệm của tiểu ban; dữ liệu lâm sàng thu thập hệ thống còn hạn chế.', 'Table 2H-2 (5)'],
    vgs_ery: ['Azithromycin/clarithromycin được dự đoán từ erythromycin. Không báo thường quy cho mẫu đường tiết niệu.', 'Table 1H-2 fn d,e'],
    vgs_cli: ['Không báo thường quy cho mẫu đường tiết niệu.', 'Table 1H-2 fn d'],
    // --- generic
    dose_general: ['Breakpoint S/SDD được thiết lập với chế độ liều trong Table 2 Dosages của CLSI (xem mục "Liều tham chiếu" bên dưới); cần phơi nhiễm thuốc tại ổ nhiễm tương đương hoặc cao hơn phơi nhiễm toàn thân ở người lớn chức năng thận bình thường. Thông tin này cần chia sẻ với dược sĩ lâm sàng/bác sĩ truyền nhiễm.', 'Table 2 Dosages (giới thiệu)'],
  };

  /* ------------------------------------------------------------------ */
  /* 6. Group definitions (tiers, breakpoints, doses, cascade triggers)   */
  /* ------------------------------------------------------------------ */
  // tier: 1-4 = Table 1 tier; 0 = "Other" (has breakpoint in Table 2, absent from Table 1)
  // urine: 'only' | 'not' ; trig: cascade trigger (agent ids whose I/R/SDD/NS result opens this agent; or 'mrs'/'mssa'/'cre')
  const A = (o) => o;

  const ENT = {
    label: 'Enterobacterales (trừ Salmonella, Shigella)',
    tables: 'Table 1A-1 · Table 2A-1',
    order: ['AMP', 'CZO', 'CTX', 'CRO', 'AMC', 'SAM', 'TZP', 'GEN', 'CIP', 'LVX', 'SXT', 'CXM', 'FEP', 'ETP', 'IPM', 'MEM', 'TOB', 'AMK', 'FOS', 'CZA', 'CAZ', 'ATM', 'CZT', 'NIT', 'TCY', 'CHL', 'DOX', 'MNO', 'PIP', 'CXMA', 'CST'],
    agents: {
      AMP: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: 'Ampicillin 2 g IV q4–6h (hoặc amoxicillin 1–2 g IV q6h)' }, fn: ['ent_amp'] }),
      CZO: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: 'Cefazolin 2 g IV q8h (nhiễm trùng không phải UTI không biến chứng)' }, fn: [] }),
      CTX: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '1 g IV q8h' }, fn: ['ent_ceph', 'ent_ampc?'] }),
      CRO: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '1 g IV q24h' }, fn: ['ent_ceph', 'ent_ampc?'] }),
      AMC: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: 'IV 1,2 g (1 g amoxicillin + 0,2 g clavulanate) q6h; uống 500/125 mg q8h hoặc 875/125 mg q12h (chỉ UTI không biến chứng/hoàn tất điều trị)' }, fn: [] }),
      SAM: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: '3 g IV (2 g ampicillin + 1 g sulbactam) q6h' }, fn: [] }),
      TZP: A({ tier: 1, bp: { s: 8, r: 32, sdd: [16, 16] }, dose: { s: '3,375 g hoặc 4,5 g IV q6h', sdd: '4,5 g IV q6h truyền 3 giờ, hoặc IV q8h truyền 4 giờ' }, fn: ['ent_tzp_sdd?'] }),
      GEN: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: '7 mg/kg IV q24h' }, fn: ['ent_aminoglycoside'] }),
      CIP: A({ tier: 1, bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, dose: { s: '400 mg IV hoặc 500 mg uống q12h' }, fn: [] }),
      LVX: A({ tier: 1, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: { s: '750 mg IV/uống q24h' }, fn: [] }),
      SXT: A({ tier: 1, bp: { s: 40, r: 80 }, ladder: 'sxt', dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX (20 = 1/19; 40 = 2/38; 80 = 4/76); CLSI: S ≤2/38, R ≥4/76.' }),
      CXM: A({ tier: 2, bp: { s: 8, r: 32, i: [16, 16] }, trig: ['CZO', 'CTX', 'CRO'], dose: { s: 'Cefuroxime (tiêm) 1,5 g IV q8h' }, fn: [] }),
      FEP: A({ tier: 2, bp: { s: 2, r: 16, sdd: [4, 8] }, trig: ['CTX', 'CRO'], dose: { s: '1 g IV q8h hoặc 2 g IV q12h', sdd: '2 g IV q8h truyền 3 giờ' }, fn: ['ent_fep'] }),
      ETP: A({ tier: 2, bp: { s: 0.5, r: 2, i: [1, 1] }, trig: ['CTX', 'CRO', 'TZP'], dose: { s: '1 g IV q24h' }, fn: ['ent_carba'] }),
      IPM: A({ tier: 2, bp: { s: 1, r: 4, i: [2, 2] }, trig: ['CTX', 'CRO', 'TZP'], dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: ['ent_carba', 'ent_imp_pm?'] }),
      MEM: A({ tier: 2, bp: { s: 1, r: 4, i: [2, 2] }, trig: ['CTX', 'CRO', 'TZP'], dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: ['ent_carba'] }),
      TOB: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['GEN'], dose: { s: '7 mg/kg IV q24h' }, fn: ['ent_aminoglycoside'] }),
      AMK: A({ tier: 2, bp: { s: 4, r: 16, i: [8, 8] }, trig: ['GEN'], dose: { s: '15 mg/kg IV q24h' }, fn: ['ent_aminoglycoside'] }),
      TCY: A({ tier: 2, bp: { s: 4, r: 16, i: [8, 8] }, trig: [], dose: null, fn: ['ent_tcy'] }),
      FOS: A({ tier: 3, urine: 'only', onlyEcoli: true, bp: { s: 64, r: 256, i: [128, 128] }, trig: [], dose: null, fn: ['ent_fos'] }),
      CZA: A({ tier: 3, bp: { s: 8, r: 16 }, trig: ['ETP', 'IPM', 'MEM'], dose: { s: '2,5 g (2 g ceftazidime + 0,5 g avibactam) IV q8h truyền 2 giờ' }, fn: [] }),
      CAZ: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: { s: '1 g IV q8h' }, fn: ['ent_ceph', 'ent_ampc?'] }),
      ATM: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: { s: '1 g IV q8h' }, fn: [] }),
      CZT: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: '1,5 g IV q8h (3 g IV q8h nếu viêm phổi)' }, fn: [] }),
      NIT: A({ tier: 1, urine: 'only', bp: { s: 32, r: 128, i: [64, 64] }, dose: null, fn: ['ent_nit'] }),
      // "Other": có breakpoint ở Table 2A-1 nhưng không nằm trong Table 1A-1
      CHL: A({ tier: 0, bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
      DOX: A({ tier: 0, bp: { s: 4, r: 16, i: [8, 8] }, fn: [] }),
      MNO: A({ tier: 0, bp: { s: 4, r: 16, i: [8, 8] }, fn: [] }),
      PIP: A({ tier: 0, bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
      CXMA: A({ tier: 0, bp: { s: 4, r: 32, i: [8, 16] }, fn: [] }),
      CST: A({ tier: 0, bp: { sNone: true, iMax: 2 }, fn: ['ent_cst'] }),
    },
    // Drugs on the Vitek panel with no CLSI breakpoint for this group
    noBp: ['TGC', 'CSL', 'FOX'],
  };
  // cefoxitin has a breakpoint (S ≤8 / R ≥32) but is T2 – include for completeness
  ENT.agents.FOX = A({ tier: 2, bp: { s: 8, r: 32, i: [16, 16] }, trig: ['CTX', 'CRO'], dose: { s: 'Cefoxitin 8 g IV/ngày (vd. 2 g IV q6h)' }, fn: [] });
  ENT.noBp = ['TGC', 'CSL'];
  ENT.order.push('FOX');

  const SA = {
    label: 'Staphylococcus aureus',
    tables: 'Table 1C · Table 2C',
    order: ['OXA', 'ERY', 'CLI', 'TCY', 'DOX', 'MNO', 'SXT', 'VAN', 'NIT', 'PEN', 'DAP', 'LNZ', 'CPT', 'TED', 'RIF', 'CIP', 'LVX', 'MXF', 'GEN', 'QDA', 'CHL', 'TEC'],
    agents: {
      OXA: A({ tier: 1, bp: { s: 2, r: 4 }, dose: null, fn: ['st_oxa'], mrsAgent: true }),
      ERY: A({ tier: 1, urine: 'not', bp: { s: 0.5, r: 8, i: [1, 4] }, dose: null, fn: ['st_ery'] }),
      CLI: A({ tier: 1, urine: 'not', bp: { s: 0.5, r: 4, i: [1, 2] }, dose: null, fn: ['st_cli'] }),
      TCY: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['st_tcy'] }),
      DOX: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: [] }),
      MNO: A({ tier: 1, urine: 'not', bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: [] }),
      SXT: A({ tier: 1, bp: { s: 40, r: 80 }, ladder: 'sxt', dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX (20 = 1/19; 40 = 2/38; 80 = 4/76); CLSI: S ≤2/38, R ≥4/76.' }),
      VAN: A({ tier: 1, bp: { s: 2, r: 16, i: [4, 8] }, dose: null, fn: ['st_van'] }),
      NIT: A({ tier: 1, urine: 'only', bp: { s: 32, r: 128, i: [64, 64] }, dose: null, fn: ['st_nit'] }),
      PEN: A({ tier: 2, bp: { s: 0.12, r: 0.25 }, trig: 'mssa', dose: null, fn: ['st_pen_s?'] }),
      DAP: A({ tier: 2, notLRT: true, bp: { s: 1 }, trig: 'mrs', dose: null, fn: ['st_dap'] }),
      LNZ: A({ tier: 2, bp: { s: 4, r: 8 }, trig: 'mrs', dose: null, fn: ['st_lnz'] }),
      CPT: A({ tier: 3, bp: { s: 1, r: 8, sdd: [2, 4] }, trig: 'mrs', dose: { s: '600 mg IV q12h', sdd: '600 mg IV q8h truyền 2 giờ' }, fn: ['st_cpt'] }),
      TED: A({ tier: 3, bp: { s: 0.5, r: 2, i: [1, 1] }, trig: 'mrs', dose: { s: '200 mg IV/uống q24h' }, fn: [] }),
      RIF: A({ tier: 3, bp: { s: 1, r: 4, i: [2, 2] }, trig: 'mrs', dose: null, fn: ['st_rif'] }),
      CIP: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['st_fq'] }),
      LVX: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['st_fq'] }),
      MXF: A({ tier: 4, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: null, fn: ['st_fq'] }),
      GEN: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['st_gen'] }),
      QDA: A({ tier: 0, onlyMSSA: true, bp: { s: 1, r: 4, i: [2, 2] }, fn: [] }),
      CHL: A({ tier: 0, bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
      TEC: A({ tier: 0, bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
    },
    noBp: ['TGC'],
    intrinsic: (o) => staphIntrinsic(o),
  };
  const staphIntrinsic = (o) => {
    const ids = ['ATM', 'CST', 'PMB'];
    const txt = ['aztreonam, polymyxin B/colistin, nalidixic acid (Appendix B3, ghi chú 1)'];
    if (o.species === 'saprophyticus') { ids.push('FOS', 'FUS'); txt.push('S. saprophyticus còn kháng novobiocin, fosfomycin, acid fusidic'); }
    if (o.species === 'capitis') { ids.push('FOS'); txt.push('S. capitis còn kháng fosfomycin'); }
    if (o.species === 'cohnii' || o.species === 'xylosus') txt.push(`S. ${o.species} còn kháng novobiocin (không có trên Vitek)`);
    return { ids, texts: txt, all: '' };
  };
  // helper to remove the S. aureus-only agents for other staphylococci (SOSA)
  const SOSA = JSON.parse(JSON.stringify(SA));
  SOSA.label = 'Staphylococcus spp. (không phải S. aureus)';
  SOSA.intrinsic = SA.intrinsic; // JSON clone drops functions
  SOSA.agents.OXA.bp = { s: 0.5, r: 1 };
  SOSA.agents.VAN.bp = { s: 4, r: 32, i: [8, 16] };
  SOSA.agents.VAN.fn = ['st_van'];
  ['CPT', 'TED', 'QDA'].forEach((k) => delete SOSA.agents[k]);
  SOSA.order = SOSA.order.filter((k) => SOSA.agents[k]);
  SOSA.partial = 'Quy tắc cho tụ cầu không phải S. aureus mới nạp phần MIC; hãy đối chiếu thêm Table 2C và Table 3H (vd. cefoxitin đĩa, oxacillin theo loài).';

  const VGS = {
    label: 'Streptococcus nhóm viridans',
    tables: 'Table 1H-2 · Table 2H-2',
    order: ['PEN', 'AMP', 'CTX', 'CRO', 'VAN', 'LNZ', 'FEP', 'CLI', 'ERY', 'LVX', 'TCY', 'CHL', 'QDA'],
    agents: {
      PEN: A({ tier: 1, bp: { s: 0.12, r: 4, i: [0.25, 2] }, dose: null, fn: ['vgs_pen', 'vgs_rx?', 'vgs_bp'] }),
      AMP: A({ tier: 1, bp: { s: 0.25, r: 8, i: [0.5, 4] }, dose: null, fn: ['vgs_pen', 'vgs_rx?', 'vgs_bp'] }),
      CTX: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['vgs_bp'] }),
      CRO: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['vgs_bp'] }),
      VAN: A({ tier: 2, bp: { s: 1 }, trig: ['PEN', 'AMP', 'CTX', 'CRO'], dose: null, fn: ['vgs_bp'] }),
      LNZ: A({ tier: 3, bp: { s: 2 }, trig: ['PEN', 'AMP', 'CTX', 'CRO', 'VAN'], dose: null, fn: [] }),
      FEP: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['vgs_bp'] }),
      CLI: A({ tier: 4, urine: 'not', bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, dose: null, fn: ['vgs_cli'] }),
      ERY: A({ tier: 4, urine: 'not', bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, dose: null, fn: ['vgs_ery'] }),
      LVX: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: [] }),
      TCY: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: [] }),
      CHL: A({ tier: 0, bp: { s: 4, r: 16, i: [8, 8] }, fn: [] }),
      QDA: A({ tier: 0, bp: { s: 1, r: 4, i: [2, 2] }, fn: [] }),
    },
    noBp: ['TGC', 'MXF'],
  };


  /* ------------------------------------------------------------------ */
  /* 6b. Further groups (CLSI M100-Ed36 Tables 1A-2, 1B-1..5, 1D, 1E, 1G, 1H-1; 2A-2, 2B-1..5, 2D, 2E, 2G, 2H-1) */
  /* ------------------------------------------------------------------ */
  const NF_IDS = ['PEN', 'CZO', 'CXM', 'FOX', 'CLI', 'DAP', 'VAN', 'TEC', 'LNZ', 'ERY', 'AZM', 'CLR', 'QDA', 'RIF', 'FUS'];
  const NF_TEXT = 'penicillin, cephalosporin thế hệ 1–2, cephamycin, clindamycin, daptomycin, acid fusidic, glycopeptide, linezolid, macrolide, quinupristin-dalfopristin, rifampin (Appendix B2, ghi chú)';
  const TRIG_PA = ['CAZ', 'FEP', 'TZP'];
  const TRIG_CARBA = ['IPM', 'MEM'];

  const PSA = {
    label: 'Pseudomonas aeruginosa',
    tables: 'Table 1B-1 · Table 2B-1',
    order: ['CAZ', 'FEP', 'TZP', 'TOB', 'CIP', 'LVX', 'IPM', 'MEM', 'AMK', 'FDC', 'CZA', 'CZT', 'IMR', 'ATM', 'CST', 'PMB', 'PIP', 'TCC', 'DOR'],
    agents: {
      CAZ: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: '1 g IV q6h hoặc 2 g IV q8h' }, fn: ['pa_emerge'] }),
      FEP: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: '2 g IV q8h truyền 3 giờ' }, fn: ['pa_emerge'] }),
      TZP: A({ tier: 1, bp: { s: 16, r: 64, i: [32, 32] }, dose: { s: '4,5 g (4 g piperacillin + 0,5 g tazobactam) IV q6h truyền 0,5 hoặc 3 giờ' }, fn: ['bl_combo', 'pa_emerge'] }),
      TOB: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '7 mg/kg IV q24h' }, fn: ['pa_aminoglycoside'] }),
      CIP: A({ tier: 1, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: { s: '400 mg IV q8h hoặc 750 mg uống q12h' }, fn: [] }),
      LVX: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '750 mg IV/uống q24h' }, fn: [] }),
      IPM: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: TRIG_PA, dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: [] }),
      MEM: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: TRIG_PA, dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: [] }),
      AMK: A({ tier: 2, urine: 'only', bp: { s: 16, r: 64, i: [32, 32] }, trig: ['TOB'], dose: { s: '15 mg/kg IV q24h' }, fn: ['pa_amk_u', 'pa_aminoglycoside'] }),
      FDC: A({ tier: 3, bp: { s: 4, r: 16, i: [8, 8] }, trig: TRIG_PA.concat(TRIG_CARBA), dose: { s: '2 g IV q8h truyền 3 giờ' }, fn: ['fdc_note'] }),
      CZA: A({ tier: 3, bp: { s: 8, r: 16 }, trig: TRIG_PA.concat(TRIG_CARBA), dose: { s: '2,5 g (2 g ceftazidime + 0,5 g avibactam) IV q8h truyền 2 giờ' }, fn: ['bl_combo'] }),
      CZT: A({ tier: 3, bp: { s: 4, r: 16, i: [8, 8] }, trig: TRIG_PA.concat(TRIG_CARBA), dose: { s: '3 g IV q8h (viêm phổi); 1,5 g IV q8h (chỉ định khác)' }, fn: ['bl_combo'] }),
      IMR: A({ tier: 3, bp: { s: 2, r: 8, i: [4, 4] }, trig: TRIG_PA.concat(TRIG_CARBA), dose: { s: '1,25 g (0,5 g imipenem + 0,5 g cilastatin + 0,25 g relebactam) IV q6h' }, fn: ['bl_combo'] }),
      ATM: A({ tier: 4, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: '1 g IV q6h hoặc 2 g IV q8h' }, fn: [] }),
      CST: A({ tier: 4, bp: { sNone: true, iMax: 2 }, dose: null, fn: ['colistin_warn'] }),
      PMB: A({ tier: 4, bp: { sNone: true, iMax: 2 }, dose: null, fn: ['colistin_warn'] }),
      PIP: A({ tier: 0, bp: { s: 16, r: 64, i: [32, 32] }, fn: [] }),
      TCC: A({ tier: 0, bp: { s: 16, r: 128, i: [32, 64] }, fn: [] }),
      DOR: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: [] }),
    },
    noBp: ['GEN', 'TGC', 'MNO', 'TCY', 'SXT'],
    intrinsic: () => ({ ids: ['AMP', 'SAM', 'AMC', 'CTX', 'CRO', 'ETP', 'TCY', 'TGC', 'SXT', 'CHL'].concat(NF_IDS), texts: ['ampicillin/amoxicillin, ampicillin-sulbactam, amoxicillin-clavulanate, cefotaxime, ceftriaxone, ertapenem, tetracycline/tigecycline, trimethoprim, trimethoprim-sulfamethoxazole, chloramphenicol (Appendix B2)'], all: NF_TEXT }),
  };

  const ABC_SP = ['baumannii', 'calcoaceticus', 'nosocomialis', 'pittii', 'seifertii'];
  const ACB = {
    label: 'Acinetobacter spp.',
    tables: 'Table 1B-2 · Table 2B-2',
    order: ['SAM', 'CAZ', 'FEP', 'CIP', 'LVX', 'GEN', 'TOB', 'IPM', 'MEM', 'AMK', 'TZP', 'SXT', 'MNO', 'SUD', 'FDC', 'CTX', 'CRO', 'CST', 'PMB', 'PIP', 'TCC', 'DOR'],
    agents: {
      SAM: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: '3 g (2 g ampicillin + 1 g sulbactam) IV q6h truyền ≥3 giờ' }, fn: ['bl_combo'] }),
      CAZ: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: null, fn: [] }),
      FEP: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: null, fn: [] }),
      CIP: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: [] }),
      LVX: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: [] }),
      GEN: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: '7 mg/kg IV q24h' }, fn: ['gn_aminoglycoside'] }),
      TOB: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: '7 mg/kg IV q24h' }, fn: ['gn_aminoglycoside'] }),
      IPM: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['SAM', 'CAZ', 'FEP'], dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: [] }),
      MEM: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['SAM', 'CAZ', 'FEP'], dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: [] }),
      AMK: A({ tier: 2, bp: { s: 8, r: 32, i: [16, 16] }, trig: ['GEN', 'TOB'], dose: { s: '20 mg/kg IV q24h' }, fn: ['gn_aminoglycoside'] }),
      TZP: A({ tier: 2, bp: { s: 16, r: 128, i: [32, 64] }, trig: ['SAM', 'CAZ', 'FEP'], dose: null, fn: ['bl_combo'] }),
      SXT: A({ tier: 2, bp: { s: 40, r: 80 }, ladder: 'sxt', trig: ['SAM', 'CAZ', 'FEP'], dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX; CLSI: S ≤2/38, R ≥4/76.' }),
      MNO: A({ tier: 2, bp: { s: 1, r: 4, i: [2, 2] }, trig: ['SAM', 'CAZ', 'FEP'], dose: { s: '200 mg IV q12h' }, fn: ['acb_mino'] }),
      SUD: A({ tier: 3, bp: { s: 4, r: 16, i: [8, 8] }, trig: ['IPM', 'MEM'], dose: { s: '2 g (1 g sulbactam + 1 g durlobactam) IV q6h truyền 3 giờ' }, fn: [] }),
      FDC: A({ tier: 3, bp: { s: 4, r: 16, i: [8, 8] }, trig: ['IPM', 'MEM'], dose: { s: '2 g IV q8h truyền 3 giờ' }, fn: ['fdc_note', 'acb_fdc'], hideIf: (o) => (ABC_SP.includes(o.species) ? null : { kind: 'policy', reason: 'Cefiderocol chỉ báo cho A. baumannii complex (Table 2B-2 comment 6).', restore: 'blocked', risk: 'Breakpoint chỉ xác lập cho A. baumannii complex.' }) }),
      CTX: A({ tier: 4, bp: { s: 8, r: 64, i: [16, 32] }, dose: null, fn: [] }),
      CRO: A({ tier: 4, bp: { s: 8, r: 64, i: [16, 32] }, dose: null, fn: [] }),
      CST: A({ tier: 4, bp: { sNone: true, iMax: 2 }, dose: null, fn: ['colistin_warn'] }),
      PMB: A({ tier: 4, bp: { sNone: true, iMax: 2 }, dose: null, fn: ['colistin_warn'] }),
      PIP: A({ tier: 0, bp: { s: 16, r: 128, i: [32, 64] }, fn: [] }),
      TCC: A({ tier: 0, bp: { s: 16, r: 128, i: [32, 64] }, fn: [] }),
      DOR: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: [] }),
    },
    noBp: ['TGC', 'TCY', 'DOX', 'CHL'],
    intrinsic: (o) => (ABC_SP.includes(o.species)
      ? { ids: ['AMP', 'AMC', 'ATM', 'ETP', 'CHL', 'FOS'].concat(NF_IDS), texts: ['ampicillin/amoxicillin, amoxicillin-clavulanate, aztreonam, ertapenem, trimethoprim, chloramphenicol, fosfomycin (Appendix B2)'], all: NF_TEXT }
      : { ids: NF_IDS, texts: [], all: NF_TEXT }),
  };

  const STM = {
    label: 'Stenotrophomonas maltophilia',
    tables: 'Table 1B-4 · Table 2B-4',
    order: ['LVX', 'MNO', 'SXT', 'FDC', 'CHL'],
    agents: {
      LVX: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: ['stm_rx'] }),
      MNO: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '200 mg IV/uống q12h' }, fn: [] }),
      SXT: A({ tier: 1, bp: { s: 40, r: 80 }, ladder: 'sxt', dose: null, fn: ['stm_rx'], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX; CLSI: S ≤2/38, R ≥4/76.' }),
      FDC: A({ tier: 3, bp: { s: 1 }, trig: ['LVX', 'MNO', 'SXT'], dose: { s: '2 g IV q8h truyền 3 giờ' }, fn: ['fdc_note'] }),
      CHL: A({ tier: 0, urine: 'not', bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
    },
    noBp: ['TGC', 'CAZ', 'TCC'],
    intrinsic: () => ({ ids: ['AMP', 'PIP', 'TIC', 'SAM', 'AMC', 'TZP', 'CTX', 'CRO', 'ATM', 'IPM', 'MEM', 'ETP', 'GEN', 'AMK', 'TOB', 'TCY', 'FOS'].concat(NF_IDS), texts: ['penicillin phổ rộng, ức chế β-lactamase phối hợp, cefotaxime, ceftriaxone, aztreonam, carbapenem, aminoglycoside, tetracycline (không phải doxycycline/minocycline/tigecycline), trimethoprim, fosfomycin (Appendix B2)'], all: NF_TEXT }),
  };

  const BUR = {
    label: 'Burkholderia cepacia complex',
    tables: 'Table 1B-3 · Table 2B-3',
    order: [],
    agents: {},
    noBp: [],
    noAst: 'CLSI đã bỏ mọi breakpoint của B. cepacia complex vì hai phương pháp chuẩn (vi pha loãng và pha loãng thạch) không tương quan. Không báo S/I/R. Có thể ghi vào báo cáo: "Không làm kháng sinh đồ thường quy cho B. cepacia complex do thiếu phương pháp chính xác. MIC của ceftazidime, levofloxacin, meropenem, minocycline hoặc trimethoprim-sulfamethoxazole ở chủng hoang dã cao, có thể vượt mức đạt được bằng liều thường dùng." Nếu vẫn thử: chỉ vi pha loãng tủ đông là lặp lại được, và nên ghi "chưa biết mối liên quan giữa MIC và kết quả lâm sàng" (Table 2B-3 comments 1–3).',
  };

  const ONE = {
    label: 'Gram âm không lên men khác (Pseudomonas spp. khác…)',
    tables: 'Table 1B-5 · Table 2B-5',
    order: ['CAZ', 'GEN', 'TOB', 'TZP', 'SXT', 'TCY', 'FEP', 'IPM', 'MEM', 'AMK', 'ATM', 'CIP', 'LVX', 'MNO', 'CTX', 'CRO', 'PIP', 'TCC', 'CHL', 'DOX'],
    agents: {
      CAZ: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: null, fn: ['one_mic'] }),
      GEN: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['gn_aminoglycoside'] }),
      TOB: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['gn_aminoglycoside'] }),
      TZP: A({ tier: 1, bp: { s: 16, r: 128, i: [32, 64] }, dose: null, fn: ['bl_combo'] }),
      SXT: A({ tier: 1, bp: { s: 40, r: 80 }, ladder: 'sxt', dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX; CLSI: S ≤2/38, R ≥4/76.' }),
      TCY: A({ tier: 1, urine: 'only', bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['tcy_pred'] }),
      FEP: A({ tier: 2, bp: { s: 8, r: 32, i: [16, 16] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: [] }),
      IPM: A({ tier: 2, bp: { s: 4, r: 16, i: [8, 8] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: [] }),
      MEM: A({ tier: 2, bp: { s: 4, r: 16, i: [8, 8] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: [] }),
      AMK: A({ tier: 2, bp: { s: 16, r: 64, i: [32, 32] }, trig: ['GEN', 'TOB'], dose: null, fn: ['gn_aminoglycoside'] }),
      ATM: A({ tier: 2, bp: { s: 8, r: 32, i: [16, 16] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: [] }),
      CIP: A({ tier: 2, bp: { s: 1, r: 4, i: [2, 2] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: [] }),
      LVX: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: [] }),
      MNO: A({ tier: 2, bp: { s: 4, r: 16, i: [8, 8] }, trig: ['CAZ', 'GEN', 'TOB', 'TZP'], dose: null, fn: ['tcy_pred'] }),
      CTX: A({ tier: 4, bp: { s: 8, r: 64, i: [16, 32] }, dose: null, fn: [] }),
      CRO: A({ tier: 4, bp: { s: 8, r: 64, i: [16, 32] }, dose: null, fn: [] }),
      PIP: A({ tier: 0, bp: { s: 16, r: 128, i: [32, 64] }, fn: [] }),
      TCC: A({ tier: 0, bp: { s: 16, r: 128, i: [32, 64] }, fn: [] }),
      CHL: A({ tier: 0, urine: 'not', bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
      DOX: A({ tier: 0, bp: { s: 4, r: 16, i: [8, 8] }, fn: [] }),
    },
    noBp: ['TGC'],
    intrinsic: () => ({ ids: NF_IDS, texts: [], all: NF_TEXT }),
    note: 'Nhóm này gồm Pseudomonas spp. (trừ P. aeruginosa) và các trực khuẩn Gram âm không lên men khác; nếu Vitek ghi loài có bảng riêng thì hãy dùng bảng riêng (Table 1B-5 fn a).',
  };

  const SALSHI_TYPHI = (o) => /typhi|paratyphi/.test(o.key || '');
  const SAL = {
    label: 'Salmonella và Shigella',
    tables: 'Table 1A-2 · Table 2A-2',
    order: ['AMP', 'CIP', 'LVX', 'SXT', 'CTX', 'CRO', 'AZM', 'ETP', 'IPM', 'MEM', 'TCY'],
    agents: {
      AMP: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: { s: 'Ampicillin 2 g IV q4–6h hoặc amoxicillin 1–2 g IV q6h; uống: ampicillin 500 mg q6h, amoxicillin 250 mg q8h hoặc 500 mg q12h' }, fn: ['sal_warn', 'ent_amp'] }),
      CIP: A({ tier: 1, bpFor: (o) => (o.genus === 'shigella' ? { s: 0.25, r: 1, i: [0.5, 0.5] } : { s: 0.06, r: 1, i: [0.12, 0.5] }), bp: { s: 0.06, r: 1, i: [0.12, 0.5] }, dose: { s: '400 mg IV hoặc 500 mg uống q12h' }, fn: ['sal_fq?'] }),
      LVX: A({ tier: 1, bpFor: (o) => (o.genus === 'shigella' ? { s: 0.5, r: 2, i: [1, 1] } : { s: 0.12, r: 2, i: [0.25, 1] }), bp: { s: 0.12, r: 2, i: [0.25, 1] }, dose: { s: '750 mg IV/uống q24h' }, fn: ['sal_fq?'] }),
      SXT: A({ tier: 1, bp: { s: 40, r: 80 }, ladder: 'sxt', dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX; CLSI: S ≤2/38, R ≥4/76.' }),
      CTX: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '1 g IV q8h' }, fn: ['sal_stool'],
        hideIf: (o, spec) => ((o.genus === 'shigella' || spec === 'stool') ? { kind: 'specimen', reason: 'Mẫu phân hoặc Shigella: chỉ báo ampicillin, fluoroquinolone và trimethoprim-sulfamethoxazole; cephalosporin thế hệ 3 chỉ báo cho Salmonella ngoài ruột (Table 1A-2 fn b).', risk: 'Báo cephalosporin cho chủng phân lập từ ruột không theo khuyến cáo CLSI và có thể dẫn đến điều trị không cần thiết.' } : null) }),
      CRO: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '1 g IV q24h' }, fn: ['sal_stool'],
        hideIf: (o, spec) => ((o.genus === 'shigella' || spec === 'stool') ? { kind: 'specimen', reason: 'Mẫu phân hoặc Shigella: chỉ báo ampicillin, fluoroquinolone và trimethoprim-sulfamethoxazole; cephalosporin thế hệ 3 chỉ báo cho Salmonella ngoài ruột (Table 1A-2 fn b).', risk: 'Báo cephalosporin cho chủng phân lập từ ruột không theo khuyến cáo CLSI và có thể dẫn đến điều trị không cần thiết.' } : null) }),
      AZM: A({ tier: 2, bpFor: (o) => (o.genus === 'shigella' ? { s: 8, r: 32, i: [16, 16] } : { s: 16, r: 32 }), bp: { s: 16, r: 32 }, dose: { s: '500 mg IV/uống q24h' }, fn: ['sal_azm'], trig: [],
        hideIf: (o) => ((o.genus === 'shigella' || SALSHI_TYPHI(o)) ? null : { kind: 'policy', reason: 'Azithromycin chỉ báo cho S. enterica ser. Typhi và Shigella (Table 1A-2 fn d).', restore: 'blocked', risk: 'Chưa có breakpoint azithromycin cho Salmonella khác.' }) }),
      ETP: A({ tier: 4, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: { s: '1 g IV q24h' }, fn: ['sal_carba'] }),
      IPM: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: ['sal_carba'] }),
      MEM: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: '500 mg IV q6h hoặc 1 g IV q8h' }, fn: ['sal_carba'] }),
      TCY: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['tcy_pred'] }),
    },
    noBp: ['TGC'],
    suppress: ['GEN', 'AMK', 'TOB', 'CZO', 'CXM', 'FOX'],
    suppressText: 'Salmonella/Shigella: aminoglycoside, cephalosporin thế hệ 1–2 và cephamycin có thể tỏ ra nhạy in vitro nhưng không hiệu quả lâm sàng, không được báo là nhạy (Table 1A-2 fn b; Appendix B1).',
    intrinsic: () => ({ ids: [], texts: [], all: INTRINSIC_ALL_ENT_TEXT }),
  };

  const ENC_FAECIUM = (o) => o.species === 'faecium';
  const ENC_FAECALIS = (o) => o.species === 'faecalis';
  const ENC = {
    label: 'Enterococcus spp.',
    tables: 'Table 1D · Table 2D',
    order: ['AMP', 'PEN', 'VAN', 'GENHL', 'STRHL', 'DAP', 'LNZ', 'NIT', 'CIP', 'LVX', 'FOS', 'TCY', 'ERY', 'RIF', 'QDA', 'CHL', 'TEC'],
    agents: {
      AMP: A({ tier: 1, bp: { s: 8, r: 16 }, dose: { s: 'Ampicillin 2 g IV q4–6h hoặc 500 mg uống q6h; amoxicillin 1–2 g IV q6h hoặc 250 mg uống q8h/500 mg q12h (uống chỉ cho UTI không biến chứng)' }, fn: ['enc_warn', 'enc_amp', 'enc_rx'] }),
      PEN: A({ tier: 1, bp: { s: 8, r: 16 }, dose: null, fn: ['enc_amp', 'enc_rx'] }),
      VAN: A({ tier: 2, bp: { s: 4, r: 32, i: [8, 16] }, trig: ['AMP', 'PEN'], dose: null, fn: ['enc_van'] }),
      GENHL: A({ tier: 2, hlar: true, bp: null, trig: ['AMP', 'PEN'], dose: null, fn: ['enc_hlar', 'enc_rx'] }),
      STRHL: A({ tier: 3, hlar: true, bp: null, trig: ['AMP', 'PEN', 'VAN'], dose: null, fn: ['enc_hlar'] }),
      DAP: A({ tier: 2, notLRT: true, bpFor: (o) => (ENC_FAECIUM(o) ? { noS: true, s: 0, r: 8, sdd: [0, 4] } : { s: 2, r: 8, i: [4, 4] }), bp: { s: 2, r: 8, i: [4, 4] }, trig: ['AMP', 'PEN', 'VAN'], dose: null, fn: ['enc_dap'] }),
      LNZ: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['AMP', 'PEN', 'VAN'], dose: null, fn: ['enc_lnz?'] }),
      NIT: A({ tier: 1, urine: 'only', bp: { s: 32, r: 128, i: [64, 64] }, dose: null, fn: ['enc_urine'] }),
      CIP: A({ tier: 2, urine: 'only', bp: { s: 1, r: 4, i: [2, 2] }, trig: ['AMP', 'PEN'], dose: null, fn: ['enc_urine'] }),
      LVX: A({ tier: 2, urine: 'only', bp: { s: 2, r: 8, i: [4, 4] }, trig: ['AMP', 'PEN'], dose: null, fn: ['enc_urine'] }),
      FOS: A({ tier: 3, urine: 'only', bp: { s: 64, r: 256, i: [128, 128] }, trig: [], dose: null, fn: ['enc_fos'],
        hideIf: (o) => (ENC_FAECALIS(o) ? null : { kind: 'policy', reason: 'Fosfomycin chỉ báo cho E. faecalis (Table 1D fn i).', restore: 'blocked', risk: 'Breakpoint fosfomycin chỉ xác lập cho E. faecalis ở đường tiết niệu.' }) }),
      TCY: A({ tier: 3, urine: 'only', bp: { s: 4, r: 16, i: [8, 8] }, trig: [], dose: null, fn: ['tcy_pred', 'enc_urine'] }),
      ERY: A({ tier: 0, urine: 'not', bp: { s: 0.5, r: 8, i: [1, 4] }, fn: [] }),
      RIF: A({ tier: 0, bp: { s: 1, r: 4, i: [2, 2] }, fn: [] }),
      QDA: A({ tier: 0, bp: { s: 1, r: 4, i: [2, 2] }, fn: [] }),
      CHL: A({ tier: 0, urine: 'not', bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
      TEC: A({ tier: 0, bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
    },
    noBp: ['TGC', 'MXF'],
    intrinsic: (o) => {
      const ids = ['CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'CAZ', 'FEP', 'GEN', 'AMK', 'TOB', 'CLI', 'SXT', 'FUS'];
      const txt = ['cephalosporin, aminoglycoside (trừ thử kháng mức cao), clindamycin, trimethoprim, trimethoprim-sulfamethoxazole, acid fusidic (Appendix B4)'];
      if (!ENC_FAECIUM(o)) ids.push('QDA');
      if (['gallinarum', 'casseliflavus', 'flavescens'].includes(o.species)) { ids.push('VAN'); txt.push('E. gallinarum/E. casseliflavus còn kháng tự nhiên với vancomycin'); }
      return { ids, texts: txt, all: 'aztreonam, polymyxin B/colistin, nalidixic acid (Appendix B4)' };
    },
  };

  const SPN = {
    label: 'Streptococcus pneumoniae',
    tables: 'Table 1G · Table 2G',
    order: ['PEN', 'PEN_M', 'CTX', 'CTX_M', 'CRO', 'CRO_M', 'ERY', 'SXT', 'MEM', 'CLI', 'DOX', 'TCY', 'LVX', 'MXF', 'VAN', 'AMX', 'AMC', 'FEP', 'CPT', 'ETP', 'IPM', 'LNZ', 'CXM', 'RIF'],
    agents: {
      PEN: A({ tier: 1, dual: { non: { s: 2, r: 8, i: [4, 4] }, men: { s: 0.06, r: 0.12 } }, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: ['spn_men', 'spn_pen'] }),
      CTX: A({ tier: 1, dual: { non: { s: 1, r: 4, i: [2, 2] }, men: { s: 0.5, r: 2, i: [1, 1] } }, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['spn_men', 'spn_rx'] }),
      CRO: A({ tier: 1, dual: { non: { s: 1, r: 4, i: [2, 2] }, men: { s: 0.5, r: 2, i: [1, 1] } }, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['spn_men', 'spn_rx'] }),
      ERY: A({ tier: 1, urine: 'not', bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, dose: null, fn: ['spn_ery'] }),
      SXT: A({ tier: 1, bp: { s: 10, r: 80, i: [20, 40] }, ladder: 'sxt', dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX (10 = 0,5/9,5; 20 = 1/19; 40 = 2/38; 80 = 4/76).' }),
      MEM: A({ tier: 2, bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, trig: ['PEN', 'CTX', 'CRO'], dose: null, fn: ['spn_men'] }),
      CLI: A({ tier: 2, urine: 'not', bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, trig: ['ERY'], dose: null, fn: [] }),
      DOX: A({ tier: 2, bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, trig: ['ERY', 'SXT'], dose: null, fn: ['tcy_pred'] }),
      TCY: A({ tier: 2, bp: { s: 1, r: 4, i: [2, 2] }, trig: ['ERY', 'SXT'], dose: null, fn: ['tcy_pred'] }),
      LVX: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['PEN', 'CTX', 'CRO'], dose: null, fn: ['spn_fq'] }),
      MXF: A({ tier: 2, bp: { s: 1, r: 4, i: [2, 2] }, trig: ['PEN', 'CTX', 'CRO'], dose: null, fn: ['spn_fq'] }),
      VAN: A({ tier: 2, bp: { s: 1 }, trig: ['PEN', 'CTX', 'CRO'], dose: null, fn: ['spn_men'] }),
      AMX: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: '500 mg uống q8h hoặc 875 mg uống q12h (không viêm màng não)' }, fn: [] }),
      AMC: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: { s: '500/125 mg uống q8h hoặc 875/125 mg q12h (không viêm màng não)' }, fn: [] }),
      FEP: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['spn_fep'] }),
      CPT: A({ tier: 4, bp: { s: 0.5 }, dose: { s: '600 mg IV q12h (không viêm màng não)' }, fn: [] }),
      ETP: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: [] }),
      IPM: A({ tier: 4, bp: { s: 0.12, r: 1, i: [0.25, 0.5] }, dose: null, fn: [] }),
      LNZ: A({ tier: 4, bp: { s: 2 }, dose: null, fn: [] }),
      CXM: A({ tier: 4, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: null, fn: [] }),
      RIF: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: ['spn_rif'] }),
    },
    noBp: ['TGC'],
    intrinsic: () => ({ ids: [], texts: [], all: '' }),
  };

  const SBH = {
    label: 'Streptococcus nhóm β-tan huyết',
    tables: 'Table 1H-1 · Table 2H-1',
    order: ['PEN', 'AMP', 'ERY', 'CLI', 'TCY', 'CTX', 'CRO', 'VAN', 'FEP', 'CPT', 'LNZ', 'DAP', 'LVX', 'SXT'],
    agents: {
      PEN: A({ tier: 1, bp: { s: 0.12 }, dose: null, fn: ['sbh_pen'] }),
      AMP: A({ tier: 1, bp: { s: 0.25 }, dose: null, fn: ['sbh_pen', 'sbh_gbs?'] }),
      ERY: A({ tier: 1, urine: 'not', bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, dose: null, fn: ['spn_ery', 'sbh_gbs?'] }),
      CLI: A({ tier: 1, urine: 'not', bp: { s: 0.25, r: 1, i: [0.5, 0.5] }, dose: null, fn: ['sbh_gbs?'] }),
      TCY: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['PEN', 'AMP', 'ERY', 'CLI'], dose: null, fn: ['tcy_pred'] }),
      CTX: A({ tier: 3, bp: { s: 0.5 }, trig: ['PEN', 'AMP'], dose: null, fn: [] }),
      CRO: A({ tier: 3, bp: { s: 0.5 }, trig: ['PEN', 'AMP'], dose: null, fn: [] }),
      VAN: A({ tier: 3, bp: { s: 1 }, trig: ['PEN', 'AMP'], dose: null, fn: [] }),
      FEP: A({ tier: 4, bp: { s: 0.5 }, dose: null, fn: [] }),
      CPT: A({ tier: 4, bp: { s: 0.5 }, dose: { s: '600 mg IV q12h' }, fn: [] }),
      LNZ: A({ tier: 4, bp: { s: 2 }, dose: null, fn: [] }),
      DAP: A({ tier: 4, bp: { s: 1 }, notLRT: true, dose: null, fn: [] }),
      LVX: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: [] }),
      SXT: A({ tier: 4, bp: { s: 10, r: 40, i: [20, 20] }, ladder: 'sxt', dose: null, fn: ['sbh_sxt'], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX (10 = 0,5/9,5; 20 = 1/19; 40 = 2/38); CLSI: S ≤0,5, I 1, R ≥2 (thành phần trimethoprim).' }),
    },
    noBp: ['TGC', 'MXF'],
    intrinsic: () => ({ ids: [], texts: [], all: '' }),
  };

  const HAE = {
    label: 'Haemophilus influenzae / parainfluenzae',
    tables: 'Table 1E · Table 2E',
    order: ['AMP', 'CTX', 'CAZ', 'CRO', 'SAM', 'AMC', 'CIP', 'LVX', 'MXF', 'SXT', 'MEM', 'ETP', 'IPM', 'AZM', 'TCY', 'CXM', 'ATM', 'CPT', 'CLR', 'RIF'],
    agents: {
      AMP: A({ tier: 1, bp: { s: 1, r: 4, i: [2, 2] }, dose: { s: 'Ampicillin (viêm màng não) 2 g IV q4h' }, fn: ['hae_amp'] }),
      CTX: A({ tier: 2, bp: { s: 2 }, trig: ['AMP'], dose: null, fn: [] }),
      CAZ: A({ tier: 2, bp: { s: 2 }, trig: ['AMP'], dose: null, fn: [] }),
      CRO: A({ tier: 2, bp: { s: 2 }, trig: ['AMP'], dose: null, fn: [] }),
      SAM: A({ tier: 2, bp: { s: 2, r: 4 }, trig: ['AMP'], dose: { s: '3 g (2 g ampicillin + 1 g sulbactam) IV q6h' }, fn: ['bl_combo'] }),
      AMC: A({ tier: 2, bp: { s: 2, r: 8, i: [4, 4] }, trig: ['AMP'], dose: { s: '500/125 mg uống q8h hoặc 875/125 mg q12h' }, fn: ['bl_combo'] }),
      CIP: A({ tier: 2, bp: { s: 1 }, trig: ['AMP'], dose: null, fn: [] }),
      LVX: A({ tier: 2, bp: { s: 2 }, trig: ['AMP'], dose: null, fn: [] }),
      MXF: A({ tier: 2, bp: { s: 1 }, trig: ['AMP'], dose: null, fn: [] }),
      SXT: A({ tier: 2, bp: { s: 10, r: 80, i: [20, 40] }, ladder: 'sxt', trig: ['AMP'], dose: null, fn: [], vitekNote: 'Vitek báo MIC dạng tổng TMP+SMX.' }),
      MEM: A({ tier: 3, bp: { s: 0.5 }, trig: ['AMP', 'CTX', 'CRO', 'CAZ'], dose: null, fn: [] }),
      ETP: A({ tier: 4, bp: { s: 0.5 }, dose: null, fn: [] }),
      IPM: A({ tier: 4, bp: { s: 4 }, dose: null, fn: [] }),
      AZM: A({ tier: 4, bp: { s: 4 }, dose: null, fn: [] }),
      TCY: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: ['tcy_pred'] }),
      CXM: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: [] }),
      ATM: A({ tier: 4, bp: { s: 2 }, dose: null, fn: [] }),
      CPT: A({ tier: 4, bp: { s: 0.5 }, dose: { s: '600 mg IV q12h' }, fn: [] }),
      CLR: A({ tier: 4, bp: { s: 8, r: 32, i: [16, 16] }, dose: null, fn: [] }),
      RIF: A({ tier: 4, bp: { s: 1, r: 4, i: [2, 2] }, dose: null, fn: [] }),
    },
    noBp: ['TGC'],
    intrinsic: () => ({ ids: [], texts: [], all: '' }),
  };


  /* ---- Neisseria, anaerobes (CLSI Tables 1F/2F, 1I/2I, 1J/2J) ---- */
  const NGON = {
    label: 'Neisseria gonorrhoeae', tables: 'Table 1F · Table 2F',
    order: ['AZM', 'CRO', 'CFM', 'CIP', 'TCY', 'PEN', 'FEP', 'CTX', 'FOX', 'CTT', 'CZX', 'CPD', 'SPC'],
    agents: {
      AZM: A({ tier: 1, bp: { s: 1 }, dose: null, fn: ['ngon_note'] }),
      CRO: A({ tier: 1, bp: { s: 0.12, r: 0.5, i: [0.25, 0.25] }, dose: null, fn: ['ngon_note', 'ngon_inter'] }),
      CFM: A({ tier: 1, bp: { s: 0.06, r: 0.25, i: [0.12, 0.12] }, dose: null, fn: ['ngon_inter'] }),
      CIP: A({ tier: 1, bp: { s: 0.06, r: 1, i: [0.12, 0.5] }, dose: null, fn: [] }),
      TCY: A({ tier: 1, bp: { s: 0.25, r: 2, i: [0.5, 1] }, dose: null, fn: [] }),
      PEN: A({ tier: 0, bp: { s: 0.06, r: 2, i: [0.12, 1] }, fn: ['ngon_bla'] }),
      FEP: A({ tier: 0, bp: { s: 0.5 }, fn: [] }), CTX: A({ tier: 0, bp: { s: 0.5 }, fn: [] }), CZX: A({ tier: 0, bp: { s: 0.5 }, fn: [] }), CPD: A({ tier: 0, bp: { s: 0.5 }, fn: [] }),
      FOX: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: ['ngon_unk'] }), CTT: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: ['ngon_unk'] }),
      SPC: A({ tier: 0, bp: { s: 32, r: 128, i: [64, 64] }, fn: ['ngon_unk'] }),
    },
    noBp: ['TGC'], intrinsic: () => ({ ids: [], texts: [], all: '' }),
  };
  const NMEN = {
    label: 'Neisseria meningitidis', tables: 'Table 1I · Table 2I',
    order: ['PEN', 'CTX', 'CRO', 'MEM', 'AZM', 'CIP', 'LVX', 'MNO', 'SXT', 'RIF', 'AMP', 'CHL'],
    agents: {
      PEN: A({ tier: 1, bp: { s: 0.06, r: 0.5, i: [0.12, 0.25] }, dose: null, fn: ['nmen_bsc'] }),
      CTX: A({ tier: 1, bp: { s: 0.12 }, dose: null, fn: ['nmen_bsc'] }), CRO: A({ tier: 1, bp: { s: 0.12 }, dose: null, fn: ['nmen_bsc'] }),
      MEM: A({ tier: 4, bp: { s: 0.25 }, dose: null, fn: [] }),
      AZM: A({ tier: 4, bp: { s: 2 }, dose: null, fn: ['nmen_pro'] }), MNO: A({ tier: 4, bp: { s: 2 }, dose: null, fn: ['nmen_pro'] }),
      CIP: A({ tier: 4, bp: { s: 0.03, r: 0.12, i: [0.06, 0.06] }, dose: null, fn: ['nmen_pro'] }), LVX: A({ tier: 4, bp: { s: 0.03, r: 0.12, i: [0.06, 0.06] }, dose: null, fn: ['nmen_pro'] }),
      SXT: A({ tier: 4, bp: { s: 2.4, r: 10, i: [5, 5] }, ladder: 'sxt', dose: null, fn: ['nmen_pro'], vitekNote: 'Vitek báo tổng TMP+SMX; CLSI: S ≤0,12/2,4, I 0,25/4,75, R ≥0,5/9,5.' }),
      RIF: A({ tier: 4, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: null, fn: ['nmen_pro'] }),
      AMP: A({ tier: 0, bp: { s: 0.12, r: 2, i: [0.25, 1] }, fn: [] }), CHL: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: [] }),
    },
    noBp: ['TGC'], intrinsic: () => ({ ids: [], texts: [], all: '' }),
  };
  const GP_ANA = ['clostridium', 'clostridioides', 'paeniclostridium', 'cutibacterium', 'propionibacterium', 'actinomyces', 'peptostreptococcus', 'finegoldia', 'anaerococcus', 'eggerthella', 'parvimonas', 'peptoniphilus'];
  const ANA_PEN_TIER = (o) => (GP_ANA.includes(o.genus) || o.genus === 'fusobacterium' ? 1 : 4);
  const ANA = {
    label: 'Vi khuẩn kỵ khí', tables: 'Table 1J · Table 2J (CLSI M11)',
    order: ['AMP', 'PEN', 'AMC', 'SAM', 'TZP', 'CLI', 'ETP', 'IPM', 'MEM', 'MTZ', 'IMR', 'CTT', 'FOX', 'CRO', 'MXF', 'TCY', 'TCC', 'CZX', 'CMZ', 'CTX', 'DOR', 'CHL'],
    agents: {
      AMP: A({ tier: 1, tierFn: ANA_PEN_TIER, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: null, fn: ['ana_gp', 'ana_bla', 'ana_method'] }),
      PEN: A({ tier: 1, tierFn: ANA_PEN_TIER, bp: { s: 0.5, r: 2, i: [1, 1] }, dose: null, fn: ['ana_gp', 'ana_bla'] }),
      AMC: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['ana_poly'] }), SAM: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: null, fn: [] }),
      TZP: A({ tier: 1, bp: { s: 16, r: 128, i: [32, 64] }, dose: null, fn: [] }), CLI: A({ tier: 1, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: [] }),
      ETP: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: [] }), IPM: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['ana_imr'] }),
      MEM: A({ tier: 1, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: [] }), MTZ: A({ tier: 1, bp: { s: 8, r: 32, i: [16, 16] }, dose: null, fn: ['ana_mtz'] }),
      IMR: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: ['ana_imr'] }), CTT: A({ tier: 4, bp: { s: 16, r: 64, i: [32, 32] }, dose: null, fn: [] }),
      FOX: A({ tier: 4, bp: { s: 16, r: 64, i: [32, 32] }, dose: null, fn: [] }), CRO: A({ tier: 4, bp: { s: 16, r: 64, i: [32, 32] }, dose: null, fn: [] }),
      MXF: A({ tier: 4, bp: { s: 2, r: 8, i: [4, 4] }, dose: null, fn: [] }), TCY: A({ tier: 4, bp: { s: 4, r: 16, i: [8, 8] }, dose: null, fn: [] }),
      TCC: A({ tier: 0, bp: { s: 32, r: 128, i: [64, 64] }, fn: [] }), CZX: A({ tier: 0, bp: { s: 32, r: 128, i: [64, 64] }, fn: [] }), CMZ: A({ tier: 0, bp: { s: 16, r: 64, i: [32, 32] }, fn: [] }),
      CTX: A({ tier: 0, bp: { s: 16, r: 64, i: [32, 32] }, fn: [] }), DOR: A({ tier: 0, bp: { s: 2, r: 8, i: [4, 4] }, fn: [] }), CHL: A({ tier: 0, bp: { s: 8, r: 32, i: [16, 16] }, fn: [] }),
    },
    noBp: ['TGC'],
    intrinsic: (o) => ((o.genus === 'clostridium' || o.genus === 'clostridioides')
      ? { ids: ['GEN', 'AMK', 'TOB'].concat(o.species === 'innocuum' ? ['VAN'] : []), texts: ['aminoglycoside' + (o.species === 'innocuum' ? ' và vancomycin' : '') + ' (Appendix B5)'], all: '' }
      : { ids: [], texts: [], all: '' }),
    note: 'Vitek 2 không thử kháng sinh đồ vi khuẩn kỵ khí; breakpoint CLSI Table 2J dành cho phương pháp pha loãng thạch (CLSI M11). MIC lấy từ phương pháp khác cần được kiểm chứng. Hầu hết nhiễm khuẩn kỵ khí là đa vi khuẩn, có thể không cần thử.',
  };
  const EUSTUB = (label) => ({ label, tables: 'EUCAST v16.0 (CLSI M100 không có bảng)', order: [], agents: {}, noBp: [], euOnly: true, euAll: true, intrinsic: () => ({ ids: [], texts: [], all: '' }) });
  const EU_ONLY_GROUPS = {
    moraxella: EUSTUB('Moraxella catarrhalis'), hpylori: EUSTUB('Helicobacter pylori'), listeria: EUSTUB('Listeria monocytogenes'), pasteurella: EUSTUB('Pasteurella spp.'),
    campylobacter: EUSTUB('Campylobacter jejuni / C. coli'), corynebacterium: EUSTUB('Corynebacterium spp.'), cdiph: EUSTUB('Corynebacterium diphtheriae / C. ulcerans'),
    aerococcus: EUSTUB('Aerococcus sanguinicola / A. urinae'), kingella: EUSTUB('Kingella kingae'), aeromonas: EUSTUB('Aeromonas spp.'),
    achromobacter: Object.assign(EUSTUB('Achromobacter xylosoxidans'), { clsiAlias: 'other_nonent' }), vibrio: EUSTUB('Vibrio spp.'), bacillus: EUSTUB('Bacillus spp. (trừ B. anthracis)'),
    banthracis: EUSTUB('Bacillus anthracis'), brucella: EUSTUB('Brucella melitensis'), bpseudo: EUSTUB('Burkholderia pseudomallei'), legionella: EUSTUB('Legionella pneumophila'), mtb: EUSTUB('Mycobacterium tuberculosis'),
  };

  const GROUPS = Object.assign({}, EU_ONLY_GROUPS, { ngon: NGON, nmen: NMEN, anaerobe: ANA }, { enterobacterales: ENT, staph_aureus: SA, staph_sosa: SOSA, strep_vgs: VGS, salshi: SAL, pseudomonas: PSA, acinetobacter: ACB, stenotrophomonas: STM, burkholderia: BUR, other_nonent: ONE, enterococcus: ENC, strep_pn: SPN, strep_bh: SBH, haemophilus: HAE });

  /* Appendix B1 (verified rows) — intrinsic resistance for Enterobacterales */
  const INTRINSIC_ENT = [
    { test: (o) => o.genus === 'klebsiella' && ['pneumoniae', 'oxytoca', 'variicola'].includes(o.species), ids: ['AMP'], text: 'ampicillin (và amoxicillin), ticarcillin' },
    { test: (o) => o.genus === 'klebsiella' && o.species === 'aerogenes', ids: ['AMP', 'AMC', 'SAM', 'CZO', 'FOX'], text: 'ampicillin, amoxicillin-clavulanate, ampicillin-sulbactam, cephalosporin thế hệ 1, cephamycin (cefoxitin, cefotetan)' },
    { test: (o) => o.genus === 'enterobacter' && ['cloacae', 'asburiae', 'hormaechei'].includes(o.species), ids: ['AMP', 'AMC', 'SAM', 'CZO', 'FOX'], text: 'ampicillin, amoxicillin-clavulanate, ampicillin-sulbactam, cephalosporin thế hệ 1, cephamycin (cefoxitin, cefotetan)' },
    { test: (o) => o.genus === 'citrobacter' && o.species === 'freundii', ids: ['AMP', 'AMC', 'SAM', 'CZO', 'FOX', 'CXM'], text: 'ampicillin, amoxicillin-clavulanate, ampicillin-sulbactam, cephalosporin thế hệ 1 và 2, cephamycin' },
    { test: (o) => o.genus === 'citrobacter' && ['koseri', 'amalonaticus', 'farmeri', 'sedlakii'].includes(o.species), ids: ['AMP'], text: 'ampicillin, ticarcillin' },
    { test: (o) => o.genus === 'hafnia' && o.species === 'alvei', ids: ['AMP', 'AMC', 'SAM', 'CZO', 'FOX', 'CST'], text: 'ampicillin, amoxicillin-clavulanate, ampicillin-sulbactam, cephalosporin thế hệ 1, cephamycin, colistin/polymyxin B' },
    { test: (o) => o.genus === 'morganella' && o.species === 'morganii', ids: ['AMP', 'AMC', 'CZO', 'CXM', 'TGC', 'NIT', 'CST'], text: 'ampicillin, amoxicillin-clavulanate, cephalosporin thế hệ 1 và 2, tigecycline, nitrofurantoin, colistin/polymyxin B' },
    { test: (o) => o.genus === 'proteus' && o.species === 'mirabilis', ids: ['TCY', 'TGC', 'NIT', 'CST'], text: 'tetracycline, tigecycline, nitrofurantoin, colistin/polymyxin B' },
  ];
  const INTRINSIC_ALL_ENT_TEXT = 'clindamycin, daptomycin, acid fusidic, glycopeptide (vancomycin, teicoplanin), linezolid, tedizolid, quinupristin-dalfopristin, rifampin, macrolide';

  const AMPC_GENERA = (o) => (o.genus === 'citrobacter' && o.species === 'freundii') || (o.genus === 'enterobacter' && ['cloacae', 'asburiae', 'hormaechei'].includes(o.species)) || (o.genus === 'klebsiella' && o.species === 'aerogenes') || (o.genus === 'hafnia') || (o.genus === 'morganella') || (o.genus === 'providencia') || (o.genus === 'serratia') || (o.genus === 'yersinia');
  const PMP = (o) => ['proteus', 'providencia', 'morganella'].includes(o.genus);

  /* ------------------------------------------------------------------ */
  /* 7. Report builder                                                    */
  /* ------------------------------------------------------------------ */
  const SPECIMENS = [
    { v: 'unknown', t: 'Chưa xác định' },
    { v: 'blood', t: 'Máu' },
    { v: 'urine', t: 'Nước tiểu' },
    { v: 'lrt', t: 'Hô hấp dưới (đàm, dịch phế quản)' },
    { v: 'csf', t: 'Dịch não tủy' },
    { v: 'wound', t: 'Mủ / vết thương / mô mềm' },
    { v: 'other', t: 'Khác' },
  ];
  function guessSpecimen(src) {
    const s = (src || '').toLowerCase();
    if (!s) return 'unknown';
    if (/urin|nước tiểu|nuoc tieu|\bnt\b/.test(s)) return 'urine';
    if (/blood|máu|\bmau\b|cấy máu/.test(s)) return 'blood';
    if (/sputum|đàm|dam|respir|bronch|phế quản|trach|đờm|\bbal\b/.test(s)) return 'lrt';
    if (/csf|cerebro|dịch não|dich nao|não tủy/.test(s)) return 'csf';
    if (/pus|mủ|wound|vết thương|abscess|tissue|swab|mô/.test(s)) return 'wound';
    return 'other';
  }

  const DEFAULT_SETTINGS = { tier2: 'cascade', mdro: false, tier4: false, standard: 'clsi' };

  const CAT_VI = { S: 'Nhạy', I: 'Trung gian', SDD: 'Nhạy phụ thuộc liều', R: 'Kháng', NS: 'Không nhạy' };

  function fmtMic(op, mic) {
    const sym = op === '<=' ? '≤' : op === '>=' ? '≥' : op === '<' ? '<' : op === '>' ? '>' : '';
    return (sym ? sym + ' ' : '') + String(mic);
  }


  /* ------------------------------------------------------------------ */
  /* 7a. Tier text, risks of restoring hidden agents, Appendix A rules     */
  /* ------------------------------------------------------------------ */
  const TIER_TEXT = {
    0: 'Other: có breakpoint ở Table 2 nhưng không nằm trong Table 1, CLSI không khuyến cáo báo thường quy.',
    1: 'Tier 1: thuốc phù hợp để thử và báo thường quy.',
    2: 'Tier 2: thử thường quy nhưng chỉ báo theo cascade (khi chủng kháng thuốc Tier 1) hoặc theo quy định riêng của bệnh viện.',
    3: 'Tier 3: dành cho bệnh viện có nhiều bệnh nhân nguy cơ đa kháng (MDRO); chỉ báo theo cascade khi chủng kháng thuốc Tier 1–2.',
    4: 'Tier 4: chỉ thử và báo khi bác sĩ lâm sàng yêu cầu (thuốc ưu tiên không dùng được, dị ứng, hồ sơ nhạy cảm bất thường, nhiễm đa vi khuẩn…).',
  };
  const HIDE_INFO = {
    cascade: { risk: 'Báo thuốc phổ rộng khi thuốc hẹp hơn còn nhạy khiến bác sĩ chọn thuốc không cần thiết, tăng chọn lọc kháng thuốc và chi phí. Đây chính là lý do CLSI đặt ra cascade.', restore: 'confirm' },
    tier3: { risk: 'Thuốc dự trữ cho chủng đa kháng. Báo rộng rãi dễ bị dùng quá mức và nhanh mất tác dụng; kết quả cũng dễ bị hiểu sai nếu chưa biết loại carbapenemase.', restore: 'confirm' },
    tier4: { risk: 'CLSI chỉ báo Tier 4 khi bác sĩ yêu cầu. Báo thường quy dễ dẫn đến chọn thuốc kém tối ưu, độc tính cao hơn hoặc dữ liệu lâm sàng hạn chế.', restore: 'confirm' },
    policy: { risk: 'CLSI không khuyến cáo báo thường quy; báo ra có thể dẫn đến chỉ định thuốc thiếu căn cứ.', restore: 'confirm' },
    specimen: { risk: 'Kết quả không dự đoán được hiệu quả ở loại bệnh phẩm này; báo ra có thể dẫn đến thất bại điều trị.', restore: 'confirm' },
    nobp: { risk: 'Không có breakpoint CLSI nên không diễn giải được. Vitek có thể dùng tiêu chuẩn khác (FDA/EUCAST); trộn tiêu chuẩn làm kết quả sai.', restore: 'blocked' },
    qc: { risk: 'Báo khi chưa có xét nghiệm bắt buộc có thể báo sai và dẫn đến thất bại điều trị.', restore: 'test' },
    manual: { risk: '', restore: 'ok' },
  };
  const CAT_APPX = {
    I: { label: 'Category I (chưa từng hoặc rất hiếm được ghi nhận)', block: true, actions: 'Xác nhận lại định danh và kháng sinh đồ; báo kiểm soát nhiễm khuẩn ngay (có thể báo trước khi có kết quả xác nhận); liên hệ cơ quan y tế dự phòng về cách báo cáo và chuyển chủng; lưu giữ chủng.' },
    II: { label: 'Category II (hiếm gặp ở đa số cơ sở)', block: true, actions: 'Xác nhận lại định danh và kháng sinh đồ nếu hiếm gặp tại bệnh viện; trao đổi với kiểm soát nhiễm khuẩn để quyết định báo cáo đặc biệt; hỏi cơ quan y tế dự phòng.' },
    III: { label: 'Category III (có thể phổ biến, quan trọng về dịch tễ)', block: false, actions: 'Xác nhận lại nếu hiếm gặp tại bệnh viện; hỏi kiểm soát nhiễm khuẩn xem có cần báo cáo đặc biệt không.' },
  };
  // CLSI M100-Ed36 Appendix A, verified visually against the PDF pages (p.342, 344, 347)
  const APPX_A = {
    enterobacterales: [
      { ids: ['CST'], cats: ['R'], cat: 'I', skipIntrinsic: true },
      { ids: ['CZA'], cats: ['R'], cat: 'II' },
      { ids: ['ETP', 'IPM', 'MEM'], cats: ['I', 'R'], cat: 'II', carba: true },
      { ids: ['AMK', 'GEN', 'TOB'], cats: ['R'], cat: 'III' },
    ],
    staph_aureus: [
      { ids: ['VAN'], cats: ['R'], cat: 'I' },
      { ids: ['VAN'], cats: ['I'], cat: 'II' },
      { ids: ['CPT'], cats: ['SDD', 'R'], cat: 'II' },
      { ids: ['LNZ'], cats: ['R'], cat: 'II' },
      { ids: ['DAP'], cats: ['NS', 'R'], cat: 'II' },
      { ids: ['QDA'], cats: ['I', 'R'], cat: 'II', mssaOnly: true },
    ],
    staph_sosa: [
      { ids: ['VAN'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['LNZ'], cats: ['R'], cat: 'II' },
      { ids: ['DAP'], cats: ['NS', 'R'], cat: 'II' },
    ],
    salshi: [
      { ids: ['CTX', 'CRO'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['AZM'], cats: ['R'], cat: 'II' },
      { ids: ['CIP', 'LVX'], cats: ['I', 'R'], cat: 'II' },
    ],
    pseudomonas: [
      { ids: ['CZA'], cats: ['R'], cat: 'III' },
      { ids: ['CZT', 'IMR'], cats: ['I', 'R'], cat: 'III' },
      { ids: ['FDC'], cats: ['I', 'R'], cat: 'I' },
      { ids: ['IPM', 'MEM', 'DOR', 'ETP'], cats: ['I', 'R'], cat: 'III', carba: true },
      { ids: ['AMK', 'TOB'], cats: ['R'], cat: 'III' },
      { ids: ['CST', 'PMB'], cats: ['R'], cat: 'I' },
    ],
    acinetobacter: [
      { ids: ['SUD'], cats: ['I', 'R'], cat: 'I' },
      { ids: ['FDC'], cats: ['I', 'R'], cat: 'I' },
      { ids: ['IPM', 'MEM', 'DOR'], cats: ['I', 'R'], cat: 'III' },
      { ids: ['CST', 'PMB'], cats: ['R'], cat: 'I' },
    ],
    stenotrophomonas: [
      { ids: ['FDC'], cats: ['NS'], cat: 'I' },
      { ids: ['SXT'], cats: ['I', 'R'], cat: 'III' },
    ],
    enterococcus: [
      { ids: ['VAN'], cats: ['R'], cat: 'III' },
      { ids: ['LNZ'], cats: ['R'], cat: 'II' },
      { ids: ['DAP'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['GENHL', 'STRHL'], cats: ['R'], cat: 'III' },
    ],
    strep_pn: [
      { ids: ['PEN', 'AMX'], cats: ['R'], cat: 'III' },
      { ids: ['CTX', 'CRO'], cats: ['R'], cat: 'III' },
      { ids: ['CPT'], cats: ['NS'], cat: 'I' },
      { ids: ['MEM', 'ETP', 'IPM'], cats: ['I', 'R', 'NS'], cat: 'II' },
      { ids: ['VAN'], cats: ['NS'], cat: 'I' },
      { ids: ['LVX', 'MXF'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['RIF'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['LNZ'], cats: ['NS'], cat: 'I' },
    ],
    strep_bh: [
      { ids: ['PEN', 'AMP'], cats: ['NS'], cat: 'I' },
      { ids: ['CTX', 'CRO', 'CPT'], cats: ['NS'], cat: 'I' },
      { ids: ['VAN'], cats: ['NS'], cat: 'I' },
      { ids: ['DAP'], cats: ['NS'], cat: 'I' },
      { ids: ['LNZ'], cats: ['NS'], cat: 'I' },
    ],
    haemophilus: [
      { ids: ['AMC'], cats: ['R'], cat: 'II' },
      { ids: ['CTX', 'CAZ', 'CRO', 'CPT'], cats: ['NS'], cat: 'I' },
      { ids: ['MEM', 'ETP', 'IPM'], cats: ['NS'], cat: 'I' },
      { ids: ['CIP', 'LVX', 'MXF'], cats: ['NS'], cat: 'I' },
    ],
    ngon: [
      { ids: ['CRO', 'CTX', 'FEP', 'CFM'], cats: ['I', 'R', 'NS'], cat: 'II' },
      { ids: ['AZM'], cats: ['NS', 'R'], cat: 'III' },
      { ids: ['CIP'], cats: ['I', 'R'], cat: 'III' },
    ],
    nmen: [
      { ids: ['PEN', 'AMP'], cats: ['R'], cat: 'I' },
      { ids: ['PEN', 'AMP'], cats: ['I'], cat: 'II' },
      { ids: ['CTX', 'CRO', 'MEM'], cats: ['NS'], cat: 'I' },
      { ids: ['AZM', 'MNO'], cats: ['NS'], cat: 'II' },
      { ids: ['CIP', 'LVX', 'CHL', 'RIF'], cats: ['I', 'R'], cat: 'II' },
    ],
    anaerobe: [
      { ids: ['IMR'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['ETP', 'IPM', 'MEM', 'DOR'], cats: ['I', 'R'], cat: 'II' },
      { ids: ['MTZ'], cats: ['I', 'R'], cat: 'II' },
    ],
    strep_vgs: [
      { ids: ['VAN'], cats: ['NS', 'R'], cat: 'I' },
      { ids: ['LNZ'], cats: ['NS', 'R'], cat: 'I' },
      { ids: ['ETP', 'IPM', 'MEM'], cats: ['NS', 'R'], cat: 'I' },
      { ids: ['QDA'], cats: ['I', 'R'], cat: 'I' },
    ],
  };

  function buildChecks(rep, org, by, quals, mrs, intrinsicIds, cliHold, penHold, standard) {
    const checks = [];
    const add = (o) => checks.push(Object.assign({ block: false, drugs: [] }, o));
    const cat = (id) => (by[id] && by[id].cat) || null;
    const nm = (id) => drugName(id);
    const grp = org.group;

    // (1) intrinsic resistance but the isolate tested S/I -> not biologically plausible
    Object.keys(by).forEach((id) => {
      const r = by[id];
      if (r.intrinsic && r.intrinsicWas && r.intrinsicWas !== 'R') add({ id: 'intr:' + id, sev: 'retest', block: true, drugs: [id],
        title: `${nm(id)}: ${org.raw} kháng tự nhiên nhưng kết quả ra "${r.intrinsicWas}"`,
        why: 'Không thể đúng về sinh học: nhiều khả năng nhầm định danh vi khuẩn hoặc lỗi thẻ/nhập liệu. Nếu định danh sai thì cả bảng kháng sinh đồ này sai.',
        ref: 'CLSI Appendix B; Appendix A chú thích a',
        action: 'Kiểm tra lại định danh, lặp lại định danh và kháng sinh đồ (hoặc dùng phương pháp thứ hai). Trong lúc chờ, app đã đổi kết quả thành KHÁNG theo CLSI.' });
    });

    // (2) hierarchy of activity / internal consistency (CLSI M100 section V) and implausible phenotypes
    if (grp === 'enterobacterales') {
      const c3 = ['CTX', 'CRO'].filter((i) => cat(i) === 'R');
      ['CZO', 'CXM'].forEach((low) => { if (cat(low) === 'S' && c3.length) add({ id: 'hier:' + low, sev: 'retest', block: true, drugs: [low, c3[0]],
        title: `${nm(low)} nhạy nhưng ${nm(c3[0])} kháng`,
        why: 'Cephalosporin thế hệ 3 thường hoạt tính hơn thế hệ 1–2 trên Enterobacterales; kết quả ngược lại không hợp lý.',
        ref: 'CLSI M100 mục V (kiểm tra thứ bậc hoạt tính)', action: 'Lặp lại kháng sinh đồ; kiểm tra định danh và thẻ.' }); });
      if (cat('AMP') === 'S' && !intrinsicIds.has('AMP') && ['CTX', 'CRO', 'CAZ'].some((i) => cat(i) === 'R')) add({ id: 'amp_s_c3_r', sev: 'retest', block: true, drugs: ['AMP', 'CTX', 'CRO', 'CAZ'],
        title: 'Ampicillin nhạy nhưng cephalosporin thế hệ 3 kháng',
        why: 'β-lactamase làm kháng cephalosporin thế hệ 3 (ESBL, AmpC) cũng phá ampicillin; kiểu hình này hiếm khi đúng.',
        ref: 'Quy tắc chuyên gia (phụ trợ, không phải điều khoản CLSI)', action: 'Lặp lại kháng sinh đồ; kiểm tra định danh.' });
      if (cat('ETP') === 'S' && (cat('MEM') === 'R' || (cat('IPM') === 'R' && !PMP(org)))) add({ id: 'etp_s_mem_r', sev: 'retest', block: true, drugs: ['ETP', 'MEM', 'IPM'],
        title: 'Ertapenem nhạy nhưng meropenem/imipenem kháng',
        why: 'Ertapenem có breakpoint nhạy thấp nhất nên thường kháng trước; chủng kháng meropenem mà nhạy ertapenem là bất thường.',
        ref: 'Quy tắc chuyên gia (phụ trợ, không phải điều khoản CLSI)', action: 'Lặp lại kháng sinh đồ; nếu vẫn vậy, thử carbapenemase.' });
      const a = cat('CTX'), b = cat('CRO');
      if (a && b && a !== b) add({ id: 'ctx_cro', sev: (a === 'S' && b === 'R') || (a === 'R' && b === 'S') ? 'retest' : 'review', block: (a === 'S' && b === 'R') || (a === 'R' && b === 'S'), drugs: ['CTX', 'CRO'],
        title: `Cefotaxime (${a}) và ceftriaxone (${b}) khác nhau`,
        why: 'CLSI coi hai thuốc này tương đương (breakpoint giống nhau), kết quả của thuốc này dùng để dự đoán thuốc kia.', ref: 'CLSI M100 mục II.B (thuốc tương đương)', action: 'Lặp lại; dùng kết quả chắc chắn hơn sau khi xác nhận.' });
    }
    if (grp === 'staph_aureus' || grp === 'staph_sosa') {
      if (rep._foxIncons === 'neg') add({ id: 'fox_neg_oxa_r', sev: 'retest', block: true, drugs: ['OXA', 'FOX'],
        title: 'Cefoxitin screen ÂM nhưng oxacillin kháng', why: 'Không nhất quán: không phân biệt được MRSA hay MSSA.', ref: 'CLSI Table 2C; Appendix A chú thích a', action: 'Lặp lại; xét PBP2a/mecA nếu có.' });
      if (rep._foxIncons === 'pos') add({ id: 'fox_pos_oxa_s', sev: 'retest', block: true, drugs: ['OXA', 'FOX'],
        title: 'Cefoxitin screen DƯƠNG nhưng oxacillin nhạy', why: 'Không nhất quán. CLSI: kháng bằng bất kỳ phương pháp khuyến cáo nào thì báo MRS; app đang báo kháng.', ref: 'CLSI Table 2C', action: 'Lặp lại; xét PBP2a/mecA nếu có.' });
      if (cat('ERY') === 'S' && cat('CLI') === 'R') add({ id: 'ery_s_cli_r', sev: 'retest', block: true, drugs: ['ERY', 'CLI'],
        title: 'Erythromycin nhạy nhưng clindamycin kháng', why: 'Kháng clindamycin do erm thường kéo theo kháng erythromycin; kiểu hình này rất hiếm.', ref: 'Quy tắc chuyên gia (phụ trợ, không phải điều khoản CLSI)', action: 'Lặp lại kháng sinh đồ.' });
    }

    // (3) unexpected resistance in a broader-spectrum agent: CLSI says always report R and confirm it
    rep.reported.filter((r) => r.why === 'rAlways').forEach((r) => {
      if (grp === 'enterobacterales' && PMP(org) && r.id === 'IPM' && !['ETP', 'MEM'].some((o) => by[o] && by[o].cat === 'R')) return;
      const t = r.def && r.def.trig;
      const narrowS = Array.isArray(t) ? t.some((id) => by[id] && by[id].cat === 'S') : t === 'mssa';
      add({ id: 'ur:' + r.id, sev: narrowS ? 'confirm' : 'review', block: narrowS, drugs: [r.id],
        title: narrowS ? `${r.name} kháng trong khi thuốc Tier 1 liên quan còn nhạy` : `${r.name} kháng (Tier ${r.tier}, chưa đủ điều kiện cascade)`,
        why: narrowS ? 'Kháng bất ngờ ở thuốc phổ rộng: CLSI vẫn yêu cầu báo kết quả KHÁNG nhưng phải xác nhận.' : 'CLSI luôn báo kết quả KHÁNG của thuốc Tier 2–3, nên app hiển thị thuốc này dù chưa đủ điều kiện cascade.',
        ref: 'CLSI M100 mục "Cascade reporting"; Appendix A chú thích a', action: narrowS ? 'Lặp lại định danh và kháng sinh đồ, hoặc xác nhận bằng phương pháp thứ hai/labo tham chiếu.' : 'Đối chiếu với tiền sử điều trị và kết quả khác của chủng.' });
    });

    // (4) Appendix A rare / unusual phenotypes
    (APPX_A[grp] || []).forEach((rule) => {
      const hit = rule.ids.filter((id) => by[id] && rule.cats.includes(by[id].cat) && !(rule.skipIntrinsic && intrinsicIds.has(id)) && !(rule.mssaOnly && mrs) && !(rule.carba && PMP(org) && id === 'IPM' && !['ETP', 'MEM'].some((o) => by[o] && rule.cats.includes(by[o].cat))));
      if (!hit.length) return;
      const ca = CAT_APPX[rule.cat];
      add({ id: `appx:${rule.cat}:${rule.ids.join('')}`, sev: ca.block ? 'confirm' : 'review', block: ca.block, drugs: hit,
        title: `${hit.map((id) => `${nm(id)} ${by[id].cat}`).join(', ')}: kết quả hiếm cần xác nhận`,
        why: `CLSI xếp phenotype này vào ${ca.label}.`, ref: 'CLSI M100-Ed36 Appendix A',
        action: ca.actions + (rule.carba ? ' Với kháng carbapenem: thử carbapenemase (mCIM hoặc Carba NP, Table 3B/3C), phân loại KPC/NDM/OXA-48/VIM/IMP và hội chẩn truyền nhiễm. Proteus/Providencia/Morganella chỉ kháng imipenem thì không bắt buộc.' : '') });
    });

    // (4b) organism mapped to another group's table
    if (rep.mapped) add({ id: 'mapped', sev: rep.mapped.remembered ? 'review' : 'confirm', block: !rep.mapped.remembered, drugs: [],
      title: `"${rep.mapped.from}" không có bảng riêng trong CLSI: đang áp bảng "${rep.mapped.label}"`,
      why: 'CLSI M100 mục III.A nêu không nên áp breakpoint mượn từ bảng không liệt kê vi khuẩn đó. Kết quả chỉ là ngoại suy và đã được ghi chú trên bản trả lâm sàng.',
      ref: 'CLSI M100 mục III.A', action: rep.mapped.remembered ? 'Nhóm này đã được chọn từ trước cho tên vi khuẩn này; vẫn cần bác sĩ vi sinh hoặc dược lâm sàng xem lại định kỳ.' : 'Chỉ giữ khi bác sĩ vi sinh hoặc nhóm kiểm soát nhiễm khuẩn đồng ý; nếu không, quay lại và chọn "ghi nguyên kết quả Vitek".',
      reasons: ['Bác sĩ vi sinh hoặc nhóm KSNK đồng ý dùng bảng này cho vi khuẩn này'] });
    // enterococcus: penicillin S cannot coexist with ampicillin R
    if (grp === 'enterococcus' && cat('PEN') === 'S' && cat('AMP') === 'R') add({ id: 'enc_pen_amp', sev: 'retest', block: true, drugs: ['PEN', 'AMP'],
      title: 'Penicillin nhạy nhưng ampicillin kháng', why: 'Enterococcus nhạy penicillin thì chắc chắn nhạy ampicillin (chiều ngược lại mới không đúng).', ref: 'CLSI Table 1D fn d', action: 'Lặp lại kháng sinh đồ; kiểm tra định danh.' });
    // H. influenzae ampicillin R but beta-lactamase negative (BLNAR)
    if (grp === 'haemophilus' && cat('AMP') === 'R' && quals.BLAC === 'NEG') add({ id: 'blnar', sev: 'confirm', block: true, drugs: ['AMP'],
      title: 'Ampicillin kháng nhưng β-lactamase âm tính (BLNAR)', why: 'Kiểu hình hiếm (Category II); thường do thay đổi PBP3.', ref: 'CLSI Appendix A; Table 2E (11)', action: 'Xác nhận lại định danh và kháng sinh đồ; trao đổi với kiểm soát nhiễm khuẩn.' });
    // (4c) EUCAST expected susceptible phenotypes + resistance-mechanism screening (EUCAST guideline v2.0)
    if (standard === 'eucast') {
      EU_S_RULES.forEach(([rid, test, drugIds, label]) => {
        if (!test(org)) return;
        const hit = drugIds.filter((i) => by[i] && (by[i].cat === 'R' || by[i].cat === 'NS') && !by[i].intrinsic);
        if (!hit.length) return;
        add({ id: 'exps:' + rid + ':' + hit.join(''), sev: 'confirm', block: true, drugs: hit,
          title: `Kết quả không mong đợi: ${hit.map((i) => `${nm(i)} ${by[i].cat}`).join(', ')}`,
          why: `${label}. EUCAST: kết quả kháng ở tổ hợp này nên bị nghi ngờ; kiểm tra lại định danh và kháng sinh đồ, xác nhận bằng phương pháp khác, và nếu nghĩ là cơ chế kháng mắc phải thì phải xác nhận bằng phương pháp tham chiếu (tốt nhất cả giải trình tự gen).`,
          ref: `EUCAST Expected Susceptible Phenotypes v1.1, rule ${rid}`, action: 'Lặp lại định danh và kháng sinh đồ; gửi labo tham chiếu nếu vẫn kháng.' });
      });
      const val = (i) => (by[i] && by[i].mic != null && (by[i].op === '=' || by[i].op === '>' || by[i].op === '>=') ? by[i].mic : null);
      const grp1 = ['escherichia', 'klebsiella', 'raoultella', 'proteus', 'salmonella', 'shigella'];
      const grp2 = ['enterobacter', 'serratia', 'citrobacter', 'morganella', 'providencia', 'hafnia'];
      if (org.group === 'enterobacterales' || org.group === 'salshi') {
        if (val('MEM') != null && val('MEM') > 0.125) add({ id: 'scr_carba', sev: 'review', block: false, drugs: ['MEM'],
          title: `Meropenem MIC ${by.MEM.micText} vượt ngưỡng sàng lọc carbapenemase của EUCAST (>0,125 mg/L)`,
          why: 'MIC carbapenem của chủng sinh carbapenemase có thể thấp hơn breakpoint lâm sàng; ngưỡng sàng lọc EUCAST (meropenem >0,125 mg/L) dùng để phát hiện chủng nghi sinh carbapenemase. Phát hiện cơ chế không tự động làm đổi phân loại S/I/R.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 2.4.1', action: 'Làm xét nghiệm carbapenemase (đĩa phối hợp, CIM, test màu) hoặc gen; nên báo kiểm soát nhiễm khuẩn.' });
        const c3 = ['CTX', 'CRO', 'CAZ'].filter((i) => val(i) != null && val(i) > 1);
        if (c3.length && grp1.includes(org.genus)) add({ id: 'scr_esbl', sev: 'review', block: false, drugs: c3,
          title: `Sàng lọc ESBL dương (${c3.map((i) => `${nm(i)} MIC ${by[i].micText}`).join(', ')} >1 mg/L)`,
          why: 'Ngưỡng sàng lọc EUCAST cho cefotaxime/ceftriaxone, ceftazidime, cefpodoxime là >1 mg/L. Breakpoint cephalosporin của EUCAST phát hiện mọi cơ chế kháng quan trọng nên có hay không có ESBL không tự đổi phân loại; xác nhận ESBL khuyến cáo cho y tế công cộng và kiểm soát nhiễm khuẩn.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 3.4', action: 'Xác nhận ESBL bằng ceftazidime/cefotaxime ± clavulanate (đĩa phối hợp, gradient, vi pha loãng) nếu bệnh viện cần.' });
        if (c3.length && grp2.includes(org.genus)) add({ id: 'scr_esbl2', sev: 'review', block: false, drugs: c3,
          title: 'Sàng lọc dương ở Enterobacterales có AmpC cảm ứng: xác nhận ESBL bằng cefepime ± clavulanate',
          why: 'Ở Enterobacter, Serratia, C. freundii, Morganella, Providencia, Hafnia, kháng cephalosporin thường do AmpC mất kìm hãm; cefepime bền với AmpC nên dùng để xác nhận ESBL.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 3.4.1', action: 'Xác nhận bằng cefepime ± clavulanate nếu cần biết có ESBL.' });
        const fox = val('FOX');
        if (fox != null && fox > 8 && ['escherichia', 'klebsiella', 'proteus', 'salmonella', 'shigella'].includes(org.genus) && ['CTX', 'CAZ', 'CRO'].some((i) => by[i] && by[i].cat === 'R')) add({ id: 'scr_ampc', sev: 'review', block: false, drugs: ['FOX'],
          title: 'Nghi AmpC mắc phải (cefoxitin MIC >8 mg/L kèm kháng cefotaxime hoặc ceftazidime)',
          why: 'Tiêu chuẩn kiểu hình để nghi AmpC mắc phải ở nhóm 1 Enterobacterales; cefoxitin kháng còn có thể do mất porin. Ở E. coli và Shigella cần PCR để phân biệt AmpC mắc phải với AmpC nhiễm sắc thể tăng sản xuất.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 4.4', action: 'Thử cloxacillin (hoặc boronic acid) để xác nhận; PCR khi cần.' });
        if (by.CST && by.CST.cat === 'R') add({ id: 'scr_cst', sev: 'review', block: false, drugs: ['CST'],
          title: 'Colistin kháng: xác nhận bằng vi pha loãng với colistin sulfate',
          why: 'Đĩa và gradient không dùng cho polymyxin vì dễ sai (rất lớn và lớn). Chỉ xét nghiệm cơ chế (mcr) trên chủng kháng colistin.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 5', action: 'Lặp lại bằng vi pha loãng canh; QC bằng chủng mcr-1 dương.' });
      }
      if (org.group === 'pseudomonas' || org.group === 'acinetobacter') {
        if (['IPM', 'MEM', 'DOR'].some((i) => by[i] && by[i].cat === 'R')) add({ id: 'scr_crpa', sev: 'review', block: false, drugs: ['IPM', 'MEM'],
          title: `${org.group === 'pseudomonas' ? 'P. aeruginosa' : 'Acinetobacter'} kháng carbapenem: cân nhắc xác định carbapenemase`,
          why: org.group === 'pseudomonas' ? 'P. aeruginosa có thể kháng carbapenem qua nhiều cơ chế nhiễm sắc thể (bơm đẩy, mất porin) nên xét nghiệm carbapenemase có ý nghĩa lâm sàng nhất; xét nghiệm kiểu hình chưa đủ đặc hiệu để dùng đơn độc, nên xác nhận bằng gen.' : 'Ở Acinetobacter, kháng carbapenem hầu như luôn do carbapenemase OXA; chưa có chất ức chế đặc hiệu và xét nghiệm kiểu hình không cho kết quả thỏa đáng.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 6', action: 'Xác nhận bằng PCR/giải trình tự nếu cần; báo kiểm soát nhiễm khuẩn.' });
      }
      if (org.group === 'staph_aureus' && val('VAN') != null && val('VAN') > 2) add({ id: 'scr_visa', sev: 'confirm', block: true, drugs: ['VAN'],
        title: `Vancomycin MIC ${by.VAN.micText} >2 mg/L ở S. aureus (VISA hoặc VRSA)`,
        why: 'MIC vancomycin >2 mg/L được xếp kháng (VISA 4–8, VRSA >8). Chủng có MIC >2 xác nhận bằng vi pha loãng nên được gửi labo tham chiếu. hVISA không phát hiện được bằng MIC.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 8', action: 'Xác nhận MIC bằng vi pha loãng; gửi labo tham chiếu; báo kiểm soát nhiễm khuẩn.' });
      if (org.group === 'enterococcus' && ['faecalis', 'faecium'].includes(org.species) && val('VAN') != null && val('VAN') > 4) add({ id: 'scr_vre', sev: 'review', block: false, drugs: ['VAN'],
        title: `Vancomycin MIC ${by.VAN.micText} >4 mg/L ở ${org.raw}: VRE`,
        why: 'Cần chắc không phải E. gallinarum/E. casseliflavus (VanC, kháng mức thấp, ít quan trọng về kiểm soát nhiễm khuẩn) bị định danh nhầm thành E. faecium; vanB có thể khó phát hiện bằng máy tự động; ủ đủ 24 giờ.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 9', action: 'Xác nhận loài (MALDI-TOF, MGP, di động) và gen vanA/vanB nếu cần; báo kiểm soát nhiễm khuẩn.' });
      if (org.group === 'strep_pn' && val('PEN') != null && val('PEN') > 0.06) add({ id: 'scr_pnwt', sev: 'review', block: false, drugs: ['PEN'],
        title: `Phế cầu không phải kiểu hoang dã với benzylpenicillin (MIC ${by.PEN.micText} >0,06 mg/L)`,
        why: 'MIC 0,12–2 mg/L vẫn xếp nhạy khi nhiễm khuẩn không phải viêm màng não nếu dùng liều cao; với viêm màng não luôn báo kháng.', ref: 'EUCAST detection of resistance mechanisms v2.0, mục 10', action: 'Dùng đúng breakpoint theo chỉ định (viêm màng não hay không) và liều.' });
    }
    if (rep.euBhPenR) add({ id: 'bh_penr', sev: 'confirm', block: true, drugs: ['PEN'], title: 'Liên cầu β-tan huyết kháng benzylpenicillin',
      why: 'Chưa có kháng β-lactam đáng kể ở liên cầu β-tan huyết trừ liên cầu nhóm B (MIC penicillin tới 1 mg/L). Nếu kháng penicillin cần kiểm tra lại định danh và kháng sinh đồ; nếu đúng thì báo theo MIC của từng thuốc.', ref: 'EUCAST Expert Rules Streptococcus (Nov 2025), rule 1', action: 'Xác nhận định danh và MIC; gửi labo tham chiếu nếu vẫn kháng.' });
    // (5) tests that must be done before a result can be reported
    if ((rep.flags.cre || rep.flags.crpa) && quals.CARBA !== 'POS' && quals.CARBA !== 'NEG') add({ id: 'carba', sev: 'test', block: false, drugs: ['ETP', 'IPM', 'MEM'], input: 'carba',
      title: 'Cần thử carbapenemase (mCIM hoặc Carba NP)', why: 'Chủng kháng carbapenem: CLSI khuyến cáo xác định có sinh carbapenemase hay không (Table 3B/3C áp dụng cho Enterobacterales và P. aeruginosa). Với Enterobacterales, nếu có thì cefepime S/SDD phải báo là KHÁNG.', ref: 'CLSI Table 3B/3C; Table 2A-1 comment 19; Appendix G Table G3', action: 'Làm mCIM hoặc Carba NP (hoặc PCR) rồi nhập kết quả.' });
    if (cliHold) add({ id: 'icr', sev: 'test', block: false, drugs: ['CLI'], input: 'icr',
      title: 'Cần D-test (kháng clindamycin cảm ứng)', why: 'Erythromycin kháng mà clindamycin nhạy/trung gian: phải loại trừ kháng cảm ứng trước khi báo clindamycin. Clindamycin đang bị ẩn.', ref: 'CLSI Table 2C comment 23; Table 3J', action: 'Làm D-test (hoặc BMD có erythromycin + clindamycin) rồi nhập kết quả.' });
    if (penHold) add({ id: 'pen_bla', sev: 'test', block: false, drugs: ['PEN'], input: 'blac',
      title: 'Cần test β-lactamase trước khi báo penicillin nhạy', why: 'S. aureus MIC penicillin ≤0,12 vẫn có thể sinh β-lactamase mà MIC không phát hiện. Penicillin đang bị ẩn.', ref: 'CLSI Table 2C comment 9; Table 3G', action: 'Làm test zone-edge (đĩa penicillin 10 đơn vị) rồi nhập kết quả.' });
    return checks;
  }

  function treatmentInfo(rep, org, by) {
    const doses = rep.reported.filter((r) => r.dose && r.cat !== 'R').map((r) => ({ name: r.name, kind: r.dose.kind, text: r.dose.text }));
    const em = [];
    const shown = (id) => rep.reported.find((r) => r.id === id);
    if (org.group === 'enterobacterales' && AMPC_GENERA(org) && ['CTX', 'CRO', 'CAZ'].some((i) => shown(i) && shown(i).cat !== 'R')) em.push({ text: `${org.raw} có thể kháng cephalosporin thế hệ 3 chỉ sau vài ngày điều trị (giải ức chế AmpC cảm ứng), dù lần đầu báo nhạy. Cefepime ít bị ảnh hưởng hơn.`, ref: 'CLSI Table 1A-1 chú thích b; Table 2A-1 comment 16; mục VI' });
    if ((org.group === 'staph_aureus' || org.group === 'staph_sosa') && ['CIP', 'LVX', 'MXF'].some((i) => shown(i) && shown(i).cat === 'S')) em.push({ text: 'Tụ cầu có thể kháng fluoroquinolone trong lúc điều trị; chủng nhạy ban đầu có thể trở nên kháng sau vài ngày.', ref: 'CLSI Table 2C comment 22; mục VI' });
    if (org.group === 'staph_aureus' && shown('VAN') && shown('VAN').cat === 'S') em.push({ text: 'S. aureus nhạy vancomycin có thể giảm nhạy (trung gian) khi điều trị kéo dài.', ref: 'CLSI mục VI' });
    const euNote = 'Liều dưới đây là liều EUCAST dùng để xác lập breakpoint: liều chuẩn cho kết quả S, liều cao cho kết quả I. Đây không phải chỉ định điều trị và không thay thế hướng dẫn liều của quốc gia hoặc địa phương; liều thực tế còn tùy vị trí nhiễm khuẩn, chức năng thận/gan và ý kiến dược sĩ lâm sàng hoặc bác sĩ truyền nhiễm.';
    return { doses, emergence: em,
      general: 'Chủng ban đầu nhạy có thể trở nên trung gian hoặc kháng sau khi bắt đầu điều trị, có khi chỉ sau vài ngày. Nếu đáp ứng kém, nên cấy lại mẫu cùng vị trí và thử lại kháng sinh đồ.',
      generalRef: 'CLSI M100 mục VI',
      doseNote: (rep.standard === 'eucast') ? euNote : 'Liều dưới đây là chế độ liều CLSI dùng để xác lập breakpoint, cho người lớn chức năng thận bình thường. Đây không phải chỉ định điều trị: liều thực tế phụ thuộc thận, cân nhắc vị trí nhiễm và ý kiến dược sĩ lâm sàng/bác sĩ truyền nhiễm.' };
  }


  /* ------------------------------------------------------------------ */
  /* 6c. EUCAST Clinical Breakpoint Tables v16.0 (valid from 2026-01-01)  */
  /* MIC breakpoints S<= / R> extracted from the supplied PDF (pages 16-67). EUCAST has no tiers or SDD:        */
  /* I = "susceptible, increased exposure"; S<=0.001 = off-scale (wild type is I); brackets = ECOFF-based.        */
  /* ------------------------------------------------------------------ */
  const EUCAST_EDITION = 'EUCAST v16.0 (2026)';
  const DIL = [0.002, 0.004, 0.008, 0.015, 0.03, 0.06, 0.12, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const nxtDil = (x) => DIL.find((d) => d > x * 1.01);
  // S<=s, R>rGt  ->  engine bp (R is the first dilution above rGt)
  const eu = (s, rGt, x) => Object.assign({ s, r: nxtDil(rGt), rGt, eu: true }, x || {});
  const euN = (rGt, x) => Object.assign({ noS: true, s: 0, r: nxtDil(rGt), rGt, eu: true }, x || {}); // S<=0.001 (off scale): wild type = I
  const euS = (s, rGt, x) => eu(s * 20, rGt * 20, x);   // trimethoprim-sulfamethoxazole: Vitek reports total TMP+SMX (x20)
  const euSN = (rGt, x) => euN(rGt * 20, x);
  const BR = { bracket: true };
  const E_ = (bp, o) => Object.assign({ bp }, o || {});
  const MORGAN = (o) => ['morganella', 'providencia', 'proteus'].includes(o.genus);
  const KLEB_NOTAERO = (o) => o.genus === 'klebsiella' && o.species !== 'aerogenes';

  const EU_ENT = (o, spec) => {
    const ecoli = o.genus === 'escherichia' && o.species === 'coli';
    const m = {
      AMP: E_(eu(8, 8)), SAM: E_(eu(8, 8)), AMC: E_(eu(8, 8)), AMX: E_(eu(8, 8)),
      PIP: E_(eu(8, 8)), TZP: E_(eu(8, 8)), TCC: E_(eu(8, 16)),
      FEP: E_(eu(1, 4), { fn: ['eu_ent_ceph'] }),
      CTX: E_(eu(1, 2), { fn: ['eu_ent_ceph'], men: eu(1, 1) }),
      CRO: E_(eu(1, 2), { fn: ['eu_ent_ceph'], men: eu(1, 1) }),
      CAZ: E_(eu(1, 4), { fn: ['eu_ent_ceph'] }),
      CZA: E_(eu(8, 8)), CZT: E_(eu(2, 2)), FDC: E_(eu(2, 2)),
      ETP: E_(eu(0.5, 0.5)),
      MEM: E_(eu(2, 8), { men: eu(2, 2) }), DOR: E_(eu(1, 2)),
      IPM: E_(MORGAN(o) ? euN(4) : eu(2, 4)),
      ATM: E_(eu(1, 4)),
      CIP: E_(o.genus === 'salmonella' ? eu(0.06, 0.06) : eu(0.25, 0.5), { men: eu(0.125, 0.125) }),
      LVX: E_(eu(0.5, 1)),
      AMK: E_(eu(8, 8, BR), { uti: eu(8, 8), fn: ['eu_bracket?'] }),
      GEN: E_(eu(2, 2, BR), { uti: eu(2, 2), fn: ['eu_bracket?'] }),
      TOB: E_(eu(2, 2, BR), { uti: eu(2, 2), fn: ['eu_bracket?'] }),
      CST: E_(eu(2, 2, BR), { fn: ['eu_bracket?'] }),
      SXT: E_((o.genus === 'serratia') ? euSN(2) : euS(0.5, 0.5)),
    };
    if (!['morganella', 'proteus', 'serratia'].includes(o.genus)) m.MXF = E_(eu(0.25, 0.25));
    if (ecoli || (o.genus === 'citrobacter' && o.species === 'koseri')) m.TGC = E_(eu(0.5, 0.5));
    if (ecoli || KLEB_NOTAERO(o)) m.CZO = E_(euN(4), { fn: ['eu_offscale'] });
    if (ecoli || KLEB_NOTAERO(o) || o.genus === 'raoultella' || (o.genus === 'proteus' && o.species === 'mirabilis')) m.CXM = E_(euN(8), { fn: ['eu_offscale'] });
    if (ecoli && spec === 'urine') { m.FOS = E_(eu(8, 8)); m.NIT = E_(eu(64, 64)); }
    return m;
  };
  const EU_PSA = (o) => ({
    PIP: E_(euN(16)), TZP: E_(euN(16)), TCC: E_(euN(16)), FEP: E_(euN(8)), CAZ: E_(euN(8)),
    CZA: E_(eu(8, 8)), CZT: E_(eu(4, 4)), FDC: E_(eu(2, 2)), DOR: E_(euN(2)), IPM: E_(euN(4)), IMR: E_(eu(2, 2)),
    MEM: E_(eu(2, 8), { men: eu(2, 2) }), ATM: E_(euN(16)), CIP: E_(euN(0.5)), LVX: E_(euN(2)),
    AMK: E_(eu(16, 16, BR), { uti: eu(16, 16), fn: ['eu_bracket?'] }), TOB: E_(eu(2, 2, BR), { uti: eu(2, 2), fn: ['eu_bracket?'] }),
    CST: E_(eu(4, 4, BR), { fn: ['eu_bracket?'] }),
  });
  const EU_ONE = (o) => (o.genus === 'pseudomonas' ? { MEM: E_(eu(2, 8), { men: eu(2, 2) }) } : {});
  const EU_STM = () => ({ SXT: E_(euSN(2)) });
  const EU_ACB = () => ({
    DOR: E_(euN(2)), IPM: E_(eu(2, 4)), MEM: E_(eu(2, 8), { men: eu(2, 2) }), CIP: E_(euN(1)), LVX: E_(eu(0.5, 1)),
    AMK: E_(eu(8, 8, BR), { uti: eu(8, 8), fn: ['eu_bracket?'] }), GEN: E_(eu(4, 4, BR), { uti: eu(4, 4), fn: ['eu_bracket?'] }),
    TOB: E_(eu(4, 4, BR), { uti: eu(4, 4), fn: ['eu_bracket?'] }), CST: E_(eu(2, 2, BR), { fn: ['eu_bracket?'] }), SXT: E_(euS(0.5, 0.5)),
  });
  const EU_STAPH = (o) => {
    const aureusLike = ['aureus', 'argenteus', 'schweitzeri', 'lugdunensis'].includes(o.species);
    const mrOxa = aureusLike || o.species === 'saprophyticus';
    const m = {
      OXA: E_(mrOxa ? eu(2, 2) : eu(0.25, 0.25), { fn: ['eu_staph_mr'] }),
      FOX: E_(o.species === 'saprophyticus' ? eu(8, 8) : eu(4, 4), { fn: ['eu_staph_mr'], euOnly: true }),
      CIP: E_(euN(2, BR), { fn: ['eu_bracket?'] }), LVX: E_(euN(1)), MXF: E_(eu(0.25, 0.25)),
      AMK: E_(eu(16, 16, BR), { fn: ['eu_bracket?'] }), GEN: E_(eu(2, 2, BR), { fn: ['eu_bracket?'] }), TOB: E_(eu(2, 2, BR), { fn: ['eu_bracket?'] }),
      VAN: E_(aureusLike || o.species === 'saprophyticus' ? (o.species === 'saprophyticus' || o.species === 'lugdunensis' ? eu(4, 4) : eu(2, 2)) : eu(4, 4)),
      TEC: E_(aureusLike ? (o.species === 'lugdunensis' ? eu(4, 4) : eu(2, 2)) : eu(4, 4)),
      AZM: E_(eu(2, 2), { euOnly: true }), CLR: E_(eu(1, 1), { euOnly: true }), ERY: E_(eu(1, 1)), CLI: E_(eu(0.25, 0.25)), QDA: E_(eu(1, 1)),
      DOX: E_(eu(1, 1)), MNO: E_(eu(0.5, 0.5)), TCY: E_(eu(1, 1)), TGC: E_(eu(0.5, 0.5), { euOnly: true }),
      LNZ: E_(eu(4, 4)), TED: E_(eu(0.5, 0.5)), FUS: E_(eu(1, 1), { euOnly: true }), RIF: E_(eu(0.06, 0.06)), SXT: E_(euS(0.5, 0.5)),
    };
    if (o.species === 'aureus' || o.species === 'argenteus' || o.species === 'schweitzeri') { m.PEN = E_(eu(0.125, 0.125), { fn: ['eu_staph_pen'] }); m.CPT = E_(eu(1, 2)); m.DAP = E_(eu(1, 1)); }
    if (o.species === 'lugdunensis') m.PEN = E_(eu(0.125, 0.125), { fn: ['eu_staph_pen'] });
    if (o.species === 'saprophyticus') m.NIT = E_(eu(64, 64));
    return m;
  };
  const EU_ENC = (o) => ({
    AMP: E_(eu(4, 4)), AMX: E_(eu(4, 4)), VAN: E_(eu(4, 4)), TEC: E_(eu(2, 2)), LNZ: E_(eu(4, 4)), TGC: E_(eu(0.5, 0.5), { euOnly: true }),
    CIP: E_(eu(4, 4)), LVX: E_(eu(4, 4)),
    PIP: E_(o.species === 'faecalis' ? euN(16) : null), TZP: E_(o.species === 'faecalis' ? euN(16) : null), IPM: E_(o.species === 'faecalis' ? euN(4) : null),
    QDA: E_(o.species === 'faecium' ? eu(1, 1) : null), NIT: E_(o.species === 'faecalis' ? eu(64, 64) : null),
  });
  const EU_SPN = () => ({
    PEN: E_(eu(0.06, 1), { men: eu(0.06, 0.06), fn: ['eu_endo'] }), AMP: E_(eu(0.5, 1), { men: eu(0.06, 0.06) }), AMX: E_(eu(0.5, 1), { men: eu(0.06, 0.06) }), AMC: E_(eu(0.5, 1)),
    CXM: E_(eu(0.5, 1)), FEP: E_(eu(1, 2)), CTX: E_(eu(0.5, 2), { men: eu(0.5, 0.5), fn: ['eu_endo'] }), CRO: E_(eu(0.5, 2), { men: eu(0.5, 0.5), fn: ['eu_endo'] }),
    CPT: E_(eu(0.25, 0.25)), ETP: E_(eu(0.5, 0.5)), IPM: E_(eu(2, 2)), MEM: E_(eu(2, 2), { men: eu(0.25, 0.25) }),
    LVX: E_(euN(2)), MXF: E_(eu(0.5, 0.5)), TEC: E_(eu(2, 2)), VAN: E_(eu(2, 2)),
    AZM: E_(eu(0.25, 0.25), { euOnly: true }), CLR: E_(eu(0.25, 0.25), { euOnly: true }), ERY: E_(eu(0.25, 0.25)), CLI: E_(eu(0.5, 0.5)),
    DOX: E_(eu(1, 1)), MNO: E_(eu(0.5, 0.5)), TCY: E_(eu(1, 1)), LNZ: E_(eu(2, 2)), RIF: E_(eu(0.125, 0.125)), SXT: E_(euS(1, 1)),
  });
  const EU_SBH = (o) => ({
    PEN: E_(o.species === 'agalactiae' ? eu(0.125, 0.125) : eu(0.03, 0.03)),
    LVX: E_(euN(2)), MXF: E_(eu(0.5, 0.5)), TEC: E_(eu(2, 2)), VAN: E_(eu(2, 2)),
    AZM: E_(eu(0.25, 0.25), { euOnly: true }), CLR: E_(eu(0.25, 0.25), { euOnly: true }), ERY: E_(eu(0.25, 0.25)), CLI: E_(eu(0.5, 0.5)),
    DOX: E_(eu(1, 1)), MNO: E_(eu(0.5, 0.5)), TCY: E_(eu(1, 1)), TGC: E_(eu(0.125, 0.125), { euOnly: true }), LNZ: E_(eu(2, 2)), TED: E_(eu(0.5, 0.5)),
    DAP: E_(eu(1, 1)), RIF: E_(eu(0.25, 0.25)), SXT: E_(euS(0.5, 0.5)), NIT: E_(o.species === 'agalactiae' ? eu(64, 64) : null),
  });
  const EU_VGS = () => ({
    PEN: E_(eu(0.25, 1), { fn: ['eu_endo'] }), AMP: E_(eu(0.5, 2), { fn: ['eu_endo'] }), AMX: E_(eu(0.5, 2)),
    FEP: E_(eu(0.5, 0.5)), CTX: E_(eu(0.5, 0.5)), CRO: E_(eu(0.5, 0.5)), CXM: E_(eu(0.5, 0.5)),
    ETP: E_(eu(0.5, 0.5)), IPM: E_(eu(2, 2)), MEM: E_(eu(2, 2)), TEC: E_(eu(2, 2)), VAN: E_(eu(2, 2)), CLI: E_(eu(0.5, 0.5)),
  });
  const EU_HAE = () => ({
    AMP: E_(eu(1, 1), { fn: [] }), SAM: E_(eu(1, 1)), AMX: E_(eu(2, 2)), AMC: E_(eu(2, 2)), TZP: E_(eu(0.25, 0.25)), FEP: E_(eu(0.25, 0.25)),
    CTX: E_(eu(0.125, 0.125)), CRO: E_(eu(0.125, 0.125)), CXM: E_(eu(1, 2)), CPT: E_(eu(0.03, 0.03)),
    ETP: E_(eu(0.5, 0.5)), IPM: E_(eu(2, 2)), MEM: E_(eu(2, 2), { men: eu(0.25, 0.25) }),
    CIP: E_(eu(0.03, 0.03)), LVX: E_(eu(0.06, 0.06)), MXF: E_(eu(0.125, 0.125)),
    TCY: E_(eu(2, 2)), DOX: E_(eu(1, 1)), MNO: E_(eu(1, 1)), CHL: E_(eu(2, 2)), SXT: E_(euS(0.5, 0.5)),
  });
  const EU_AUTO = {
    moraxella: [["Benzylpenicillin","","",null,null,0,"-"],["Ampicillin","","",null,null,0,"-"],["Ampicillin-sulbactam","","",1.0,1.0,0,""],["Amoxicillin","","",null,null,0,"-"],["Amoxicillin-clavulanic acid","","",1.0,1.0,0,""],["Piperacillin","","",null,null,0,"-"],["Piperacillin-tazobactam","","",null,null,0,"Note"],["Ticarcillin-clavulanic acid","","",null,null,0,"IE"],["Temocillin","","",null,null,0,"IE"],["Phenoxymethylpenicillin","","",null,null,0,"-"],["Oxacillin","","",null,null,0,"-"],["Cloxacillin","","",null,null,0,"-"],["Dicloxacillin","","",null,null,0,"-"],["Flucloxacillin","","",null,null,0,"-"],["Mecillinam","oral","pivmecillinam) (uncomplicated UTI only",null,null,0,"-"],["Cefaclor","","",null,null,0,"-"],["Cefadroxil","","",null,null,0,"-"],["Cefalexin","","",null,null,0,"-"],["Cefazolin","","",null,null,0,"-"],["Cefepime","","",4.0,4.0,0,""],["Cefepime-enmetazobactam","","",null,null,0,"Note"],["Cefiderocol","","",null,null,0,"IE"],["Cefixime","","",0.5,0.5,0,""],["Cefotaxime","","",1.0,2.0,0,""],["Cefoxitin","","",null,null,0,"IE"],["Ceftaroline","","",null,null,0,"IE"],["Ceftazidime","","",null,null,0,"-"],["Ceftazidime-avibactam","","",null,null,0,"-"],["Ceftibuten","","",null,null,0,"IE"],["Ceftobiprole","","",null,null,0,"IE"],["Ceftolozane-tazobactam","","",null,null,0,"IE"],["Ceftriaxone","","",1.0,2.0,0,""],["Cefuroxime","iv","",4.0,8.0,0,""],["Cefuroxime","oral","",0.001,4.0,0,""],["Doripenem","","",1.0,1.0,0,""],["Ertapenem","","",0.5,0.5,0,""],["Imipenem","","",2.0,2.0,0,""],["Imipenem-relebactam","","",null,null,0,"Note"],["Meropenem","","",2.0,2.0,0,""],["Meropenem-vaborbactam","","",null,null,0,"Note"],["Aztreonam","","",null,null,0,"IE"],["Aztreonam-avibactam","","",null,null,0,"IE"],["Ciprofloxacin","","",0.125,0.125,0,""],["Delafloxacin","","",null,null,0,"IE"],["Levofloxacin","","",0.125,0.125,0,""],["Moxifloxacin","","",0.25,0.25,0,""],["Nalidixic acid","","screen only",null,null,0,"NA"],["Norfloxacin","","uncomplicated UTI only",null,null,0,"-"],["Ofloxacin","","",0.25,0.25,0,""],["Amikacin","","",null,null,0,"IE"],["Gentamicin","","",null,null,0,"IE"],["Netilmicin","","",null,null,0,"IE"],["Tobramycin","","",null,null,0,"IE"],["Dalbavancin","","",null,null,0,"-"],["Oritavancin","","",null,null,0,"-"],["Teicoplanin","","",null,null,0,"-"],["Telavancin","","",null,null,0,"-"],["Vancomycin","","",null,null,0,"-"],["Azithromycin","","",0.25,0.25,0,""],["Clarithromycin","","",0.25,0.25,0,""],["Erythromycin","","",0.25,0.25,0,""],["Roxithromycin","","",0.5,0.5,0,""],["Clindamycin","","",null,null,0,"-"],["Quinupristin-dalfopristin","","",null,null,0,"-"],["Doxycycline","","",1.0,1.0,0,""],["Eravacycline","","",null,null,0,"IE"],["Minocycline","","",1.0,1.0,0,""],["Tetracycline","","",2.0,2.0,0,""],["Tigecycline","","",null,null,0,"IE"],["Linezolid","","",null,null,0,"-"],["Tedizolid","","",null,null,0,"-"],["Chloramphenicol","","",null,null,0,"Note"],["Colistin","","",null,null,0,"-"],["Daptomycin","","",null,null,0,"-"],["Fosfomycin","iv","",null,null,0,"IE"],["Fosfomycin","oral","",null,null,0,"-"],["Fusidic acid","","",null,null,0,"-"],["Lefamulin","","",null,null,0,"IE"],["Metronidazole","","",null,null,0,"-"],["Nitrofurantoin","","uncomplicated UTI only",null,null,0,"-"],["Nitroxoline","","uncomplicated UTI only",null,null,0,"-"],["Rifampicin","","",null,null,0,"-"],["Spectinomycin","","",null,null,0,"-"],["Trimethoprim","","uncomplicated UTI only",null,null,0,"-"],["Trimethoprim-sulfamethoxazole","","",1.0,1.0,0,""]],
    ngon: [["Benzylpenicillin","","surrogate agent",0.06,1.0,0,""],["Ampicillin","","",null,null,0,"Note"],["Ampicillin-sulbactam","","",null,null,0,"IE"],["Amoxicillin","","",null,null,0,"Note"],["Amoxicillin-clavulanic acid","","",null,null,0,"IE"],["Piperacillin","","",null,null,0,"-"],["Piperacillin-tazobactam","","",null,null,0,"-"],["Ticarcillin-clavulanic acid","","",null,null,0,"-"],["Temocillin","","",null,null,0,"IE"],["Phenoxymethylpenicillin","","",null,null,0,"-"],["Oxacillin","","",null,null,0,"-"],["Cloxacillin","","",null,null,0,"-"],["Dicloxacillin","","",null,null,0,"-"],["Flucloxacillin","","",null,null,0,"-"],["Mecillinam","oral","pivmecillinam) (uncomplicated UTI only",null,null,0,"-"],["Cefaclor","","",null,null,0,"-"],["Cefadroxil","","",null,null,0,"-"],["Cefalexin","","",null,null,0,"-"],["Cefazolin","","",null,null,0,"-"],["Cefepime","","",null,null,0,"-"],["Cefepime-enmetazobactam","","",null,null,0,"-"],["Cefiderocol","","",null,null,0,"IE"],["Cefixime","","",0.125,0.125,0,""],["Cefotaxime","","",0.125,0.125,0,""],["Cefoxitin","","",null,null,0,"IE"],["Cefpodoxime","","",null,null,0,"-"],["Ceftaroline","","",null,null,0,"-"],["Ceftazidime","","",null,null,0,"-"],["Ceftazidime-avibactam","","",null,null,0,"-"],["Ceftibuten","","",null,null,0,"-"],["Ceftobiprole","","",null,null,0,"-"],["Ceftolozane-tazobactam","","",null,null,0,"-"],["Ceftriaxone","","",0.125,0.125,0,""],["Cefuroxime","iv","",null,null,0,"-"],["Cefuroxime","oral","",null,null,0,"-"],["Doripenem","","",null,null,0,"IE"],["Ertapenem","","",null,null,0,"IE"],["Imipenem","","",null,null,0,"IE"],["Imipenem-relebactam","","",null,null,0,"IE"],["Meropenem","","",null,null,0,"IE"],["Meropenem-vaborbactam","","",null,null,0,"IE"],["Aztreonam","","",null,null,0,"IE"],["Aztreonam-avibactam","","",null,null,0,"IE"],["Ciprofloxacin","","",0.03,0.06,0,""],["Delafloxacin","","",null,null,0,"IE"],["Levofloxacin","","",null,null,0,"IE"],["Moxifloxacin","","",null,null,0,"IE"],["Nalidixic acid","","screen only",null,null,0,"NA"],["Norfloxacin","","uncomplicated UTI only",null,null,0,"-"],["Ofloxacin","","",0.125,0.25,0,""],["Amikacin","","",null,null,0,"-"],["Gentamicin","","",null,null,0,"-"],["Netilmicin","","",null,null,0,"-"],["Tobramycin","","",null,null,0,"-"],["Dalbavancin","","",null,null,0,"-"],["Oritavancin","","",null,null,0,"-"],["Teicoplanin","","",null,null,0,"-"],["Telavancin","","",null,null,0,"-"],["Vancomycin","","",null,null,0,"-"],["Azithromycin","","",null,null,0,"Note"],["Clarithromycin","","",null,null,0,"-"],["Erythromycin","","",null,null,0,"-"],["Roxithromycin","","",null,null,0,"-"],["Clindamycin","","",null,null,0,"-"],["Quinupristin-dalfopristin","","",null,null,0,"-"],["Doxycycline","","",null,null,0,"IE"],["Eravacycline","","",null,null,0,"IE"],["Minocycline","","",null,null,0,"IE"],["Tetracycline","","",0.5,0.5,0,""],["Tigecycline","","",null,null,0,"IE"],["Linezolid","","",null,null,0,"-"],["Tedizolid","","",null,null,0,"-"],["Chloramphenicol","","",null,null,0,"-"],["Colistin","","",null,null,0,"-"],["Daptomycin","","",null,null,0,"-"],["Fosfomycin","iv","",null,null,0,"-"],["Fosfomycin","oral","",null,null,0,"-"],["Fusidic acid","","",null,null,0,"-"],["Lefamulin","","",null,null,0,"IE"],["Metronidazole","","",null,null,0,"-"],["Nitrofurantoin","","uncomplicated UTI only",null,null,0,"-"],["Nitroxoline","","uncomplicated UTI only",null,null,0,"-"],["Rifampicin","","",null,null,0,"-"],["Spectinomycin","","",64.0,64.0,0,""],["Trimethoprim","","uncomplicated UTI only",null,null,0,"-"],["Trimethoprim-sulfamethoxazole","","",null,null,0,"-"]],
    nmen: [["Benzylpenicillin","","all indications",0.25,0.25,0,""],["Ampicillin","","indications other than meningitis",0.125,1.0,0,""],["Ampicillin","","meningitis",null,null,0,"IE"],["Ampicillin-sulbactam","","",null,null,0,"IE"],["Amoxicillin","","indications other than meningitis",0.125,1.0,0,""],["Amoxicillin","","meningitis",null,null,0,"IE"],["Amoxicillin-clavulanic acid","","",null,null,0,"-"],["Piperacillin","","",null,null,0,"-"],["Piperacillin-tazobactam","","",null,null,0,"-"],["Ticarcillin-clavulanic acid","","",null,null,0,"-"],["Temocillin","","",null,null,0,"-"],["Phenoxymethylpenicillin","","",null,null,0,"-"],["Oxacillin","","",null,null,0,"-"],["Cloxacillin","","",null,null,0,"-"],["Dicloxacillin","","",null,null,0,"-"],["Flucloxacillin","","",null,null,0,"-"],["Mecillinam","oral","pivmecillinam) (uncomplicated UTI only",null,null,0,"-"],["Cefaclor","","",null,null,0,"-"],["Cefadroxil","","",null,null,0,"-"],["Cefalexin","","",null,null,0,"-"],["Cefazolin","","",null,null,0,"-"],["Cefepime","","",null,null,0,"-"],["Cefepime-enmetazobactam","","",null,null,0,"-"],["Cefiderocol","","",null,null,0,"IE"],["Cefixime","","",null,null,0,"-"],["Cefotaxime","","all indications",0.125,0.125,0,""],["Cefoxitin","","",null,null,0,"-"],["Cefpodoxime","","",null,null,0,"-"],["Ceftaroline","","",null,null,0,"-"],["Ceftazidime","","",null,null,0,"-"],["Ceftazidime-avibactam","","",null,null,0,"-"],["Ceftibuten","","",null,null,0,"-"],["Ceftobiprole","","",null,null,0,"-"],["Ceftolozane-tazobactam","","",null,null,0,"-"],["Ceftriaxone","","all indications including prophylaxis",0.125,0.125,0,""],["Cefuroxime","iv","",null,null,0,"-"],["Cefuroxime","oral","",null,null,0,"-"],["Doripenem","","",null,null,0,"Note"],["Ertapenem","","",null,null,0,"IE"],["Imipenem","","",null,null,0,"Note"],["Imipenem-relebactam","","",null,null,0,"Note"],["Meropenem","","all indications",0.25,0.25,0,""],["Meropenem-vaborbactam","","",null,null,0,"Note"],["Aztreonam","","",null,null,0,"IE"],["Aztreonam-avibactam","","",null,null,0,"IE"],["Ciprofloxacin","","all indications, including meningitis and prophylaxis",0.016,0.016,0,""],["Delafloxacin","","",null,null,0,"IE"],["Levofloxacin","","",null,null,0,"IE"],["Moxifloxacin","","",null,null,0,"IE"],["Nalidixic acid","","screen only",null,null,0,"NA"],["Norfloxacin","","uncomplicated UTI only",null,null,0,"-"],["Ofloxacin","","",null,null,0,"IE"],["Amikacin","","",null,null,0,"-"],["Gentamicin","","",null,null,0,"-"],["Netilmicin","","",null,null,0,"-"],["Tobramycin","","",null,null,0,"-"],["Dalbavancin","","",null,null,0,"-"],["Oritavancin","","",null,null,0,"-"],["Teicoplanin","","",null,null,0,"-"],["Telavancin","","",null,null,0,"-"],["Vancomycin","","",null,null,0,"-"],["Azithromycin","","",null,null,0,"-"],["Clarithromycin","","",null,null,0,"-"],["Erythromycin","","",null,null,0,"-"],["Roxithromycin","","",null,null,0,"-"],["Clindamycin","","",null,null,0,"-"],["Quinupristin-dalfopristin","","",null,null,0,"-"],["Doxycycline","","",null,null,0,"-"],["Eravacycline","","",null,null,0,"IE"],["Minocycline","","prophylaxis only",1.0,1.0,0,""],["Tetracycline","","screen only",2.0,2.0,0,""],["Tigecycline","","",null,null,0,"IE"],["Linezolid","","",null,null,0,"-"],["Tedizolid","","",null,null,0,"-"],["Chloramphenicol","","meningitis",2.0,2.0,0,""],["Colistin","","",null,null,0,"-"],["Daptomycin","","",null,null,0,"-"],["Fosfomycin","iv","",null,null,0,"-"],["Fosfomycin","oral","",null,null,0,"-"],["Fusidic acid","","",null,null,0,"-"],["Lefamulin","","",null,null,0,"-"],["Metronidazole","","",null,null,0,"-"],["Nitrofurantoin","","uncomplicated UTI only",null,null,0,"-"],["Nitroxoline","","uncomplicated UTI only",null,null,0,"-"],["Rifampicin","","prophylaxis only",0.25,0.25,0,""],["Spectinomycin","","",null,null,0,"-"],["Trimethoprim","","uncomplicated UTI only",null,null,0,"-"],["Trimethoprim-sulfamethoxazole","","",null,null,0,"-"]],
    hpylori: [["Amoxicillin","oral","",0.125,0.125,0,""],["Levofloxacin","","",1.0,1.0,0,""],["Clarithromycin","","",0.25,0.25,0,""],["Tetracycline","","",1.0,1.0,0,""],["Metronidazole","","",8.0,8.0,0,""],["Rifampicin","","",1.0,1.0,0,""]],
    listeria: [["Benzylpenicillin","","indications other than meningitis",1.0,1.0,0,""],["Benzylpenicillin","","meningitis",null,null,0,"IE"],["Ampicillin","iv","all indications",1.0,1.0,0,""],["Meropenem","","all indications",0.25,0.25,0,""],["Moxifloxacin","","meningitis",null,null,0,"IE"],["Linezolid","","meningitis",null,null,0,"IE"],["Erythromycin","","indications other than meningitis",1.0,1.0,0,""],["Trimethoprim-sulfamethoxazole","","all indications",0.06,0.06,0,""]],
    pasteurella: [["Benzylpenicillin","","",0.5,0.5,0,""],["Ampicillin","","",1.0,1.0,0,""],["Amoxicillin","","",1.0,1.0,0,""],["Amoxicillin-clavulanic acid","","",1.0,1.0,0,""],["Cefotaxime","","",0.03,0.03,0,""],["Ciprofloxacin","","",0.06,0.06,0,""],["Levofloxacin","","",0.06,0.06,0,""],["Nalidixic acid","","screen only",null,null,0,"NA"],["Doxycycline","","",1.0,1.0,0,""],["Tetracycline","","screen only",null,null,0,"NA"],["Trimethoprim-sulfamethoxazole","","",0.25,0.25,0,""]],
    campylobacter: [["Ciprofloxacin","","",0.001,0.5,0,""],["Azithromycin","","",null,null,0,"Note"],["Clarithromycin","","",null,null,0,"Note"],["Erythromycin","","C. jejuni",4.0,4.0,0,""],["Erythromycin","","C. coli",8.0,8.0,0,""],["Doxycycline","","",null,null,0,"Note"],["Tetracycline","","",2.0,2.0,0,""]],
    coryn: [["Benzylpenicillin","","",0.001,1.0,0,""],["Ciprofloxacin","","",0.001,1.0,0,""],["Moxifloxacin","","",0.5,0.5,0,""],["Gentamicin","","",null,null,0,"IE"],["Vancomycin","","",2.0,2.0,0,""],["Clindamycin","","",0.5,0.5,0,""],["Tetracycline","","",2.0,2.0,0,""],["Linezolid","","",2.0,2.0,0,""],["Rifampicin","","",0.06,0.06,0,""]],
    cdiph: [["Benzylpenicillin","","",0.001,1.0,0,""],["Amoxicillin","","",1.0,1.0,0,""],["Cefotaxime","","",0.001,2.0,0,""],["Meropenem","","",0.25,0.25,0,""],["Ciprofloxacin","","",0.001,0.5,0,""],["Erythromycin","","",0.06,0.06,0,""],["Clindamycin","","C. diphtheriae",0.5,0.5,0,""],["Doxycycline","","",0.5,0.5,0,""],["Tetracycline","","",1.0,1.0,0,""],["Linezolid","","",2.0,2.0,0,""],["Rifampicin","","",0.06,0.06,0,""],["Trimethoprim-sulfamethoxazole","","",0.5,0.5,0,""]],
    aerococcus: [["Benzylpenicillin","","",0.125,0.125,0,""],["Ampicillin","","",0.25,0.25,0,""],["Amoxicillin","","",null,null,0,"Note"],["Meropenem","","",0.25,0.25,0,""],["Ciprofloxacin","","uncomplicated UTI only",2.0,2.0,0,""],["Levofloxacin","","uncomplicated UTI only",2.0,2.0,0,""],["Norfloxacin","","screen only",null,null,0,"NA"],["Vancomycin","","",1.0,1.0,0,""],["Nitrofurantoin","","uncomplicated UTI only",16.0,16.0,0,""],["Rifampicin","","",0.125,0.125,0,""]],
    kingella: [["Benzylpenicillin","","",0.03,0.03,0,""],["Ampicillin","","",0.06,0.06,0,""],["Amoxicillin","","",0.125,0.125,0,""],["Amoxicillin-clavulanic acid","","",null,null,0,"Note"],["Cefotaxime","","",0.125,0.125,0,""],["Ceftriaxone","","",0.06,0.06,0,""],["Cefuroxime","iv","",0.5,0.5,0,""],["Meropenem","","",0.03,0.03,0,""],["Ciprofloxacin","","",0.06,0.06,0,""],["Levofloxacin","","",0.125,0.125,0,""],["Azithromycin","","",0.25,0.25,0,""],["Clarithromycin","","",0.5,0.5,0,""],["Erythromycin","","",0.5,0.5,0,""],["Clindamycin","","",null,null,0,"-"],["Doxycycline","","",0.5,0.5,0,""],["Tetracycline","","",0.5,0.5,0,""],["Rifampicin","","",0.5,0.5,0,""],["Trimethoprim-sulfamethoxazole","","",0.25,0.25,0,""]],
    aeromonas: [["Cefepime","","",1.0,4.0,0,""],["Ceftazidime","","",1.0,4.0,0,""],["Aztreonam","","",1.0,4.0,0,""],["Ciprofloxacin","","",0.25,0.5,0,""],["Levofloxacin","","",0.5,1.0,0,""],["Trimethoprim-sulfamethoxazole","","",1.0,1.0,0,""]],
    achromobacter: [["Piperacillin-tazobactam","","",4.0,4.0,0,""],["Cefiderocol","","",null,null,0,"Note"],["Meropenem","","",1.0,4.0,0,""],["Trimethoprim-sulfamethoxazole","","",0.125,0.125,0,""]],
    vibrio: [["Piperacillin-tazobactam","","",1.0,1.0,0,""],["Cefotaxime","","",0.25,0.25,0,""],["Cefotaxime","","V. fluvialis",null,null,0,"IE"],["Ceftazidime","","",1.0,1.0,0,""],["Meropenem","","",0.5,0.5,0,""],["Ciprofloxacin","","",0.25,0.25,0,""],["Levofloxacin","","",0.25,0.25,0,""],["Pefloxacin","","screen only",null,null,0,"NA"],["Azithromycin","","",4.0,4.0,0,""],["Erythromycin","","screen only",null,null,0,"NA"],["Doxycycline","","",0.5,0.5,0,""],["Tetracycline","","screen only",null,null,0,"NA"],["Trimethoprim-sulfamethoxazole","","",0.25,0.25,0,""]],
    bacillus: [["Imipenem","","",0.5,0.5,0,""],["Meropenem","","",0.25,0.25,0,""],["Ciprofloxacin","","",0.001,0.5,0,""],["Levofloxacin","","",0.001,1.0,0,""],["Norfloxacin","","screen only",null,null,0,"NA"],["Vancomycin","","",2.0,2.0,0,""],["Erythromycin","","",0.5,0.5,0,""],["Clindamycin","","",1.0,1.0,0,""],["Linezolid","","",2.0,2.0,0,""]],
    banthracis: [["Benzylpenicillin","","",0.001,0.5,0,""],["Amoxicillin","iv","",0.125,0.125,0,""],["Ciprofloxacin","","",0.001,0.25,0,""],["Levofloxacin","","",0.001,0.5,0,""],["Vancomycin","","",4.0,4.0,1,""],["Clindamycin","","",1.0,1.0,0,""],["Doxycycline","","",0.06,0.06,0,""],["Tetracycline","","",0.125,0.125,0,""],["Linezolid","","",2.0,2.0,0,""],["Rifampicin","","",1.0,1.0,1,""]],
    brucella: [["Ceftriaxone","","meningitis",2.0,2.0,1,""],["Ciprofloxacin","","",0.001,1.0,0,""],["Levofloxacin","","",0.001,1.0,0,""],["Gentamicin","","",0.5,0.5,1,""],["Streptomycin","","",1.0,1.0,1,""],["Doxycycline","","",0.25,0.25,0,""],["Tetracycline","","",0.5,0.5,0,""],["Rifampicin","","",2.0,2.0,1,""],["Trimethoprim-sulfamethoxazole","","",0.125,0.125,0,""]],
    bpseudo: [["Amoxicillin-clavulanic acid","","",0.001,8.0,0,""],["Ceftazidime","","",0.001,8.0,0,""],["Imipenem","","",2.0,2.0,0,""],["Meropenem","","",2.0,2.0,0,""],["Doxycycline","","",0.001,2.0,0,""],["Tetracycline","","screen only",null,null,0,"NA"],["Chloramphenicol","","",0.001,8.0,0,""],["Trimethoprim-sulfamethoxazole","","",0.001,4.0,0,""]],
    bcepacia: [],
    legionella: [],
    mtb: [["Bedaquiline","","",0.25,0.25,0,""],["Delamanid","","",0.06,0.06,0,""],["Pretomanid","","",null,null,0,"Note"]],
    anaerobe: {"bacteroides":[["Ampicillin-sulbactam","","",2.0,2.0,0,""],["Amoxicillin-clavulanic acid","","",2.0,2.0,0,""],["Piperacillin-tazobactam","","",2.0,2.0,0,""],["Ertapenem","","",2.0,2.0,1,""],["Imipenem","","",1.0,1.0,0,""],["Meropenem","","",1.0,1.0,0,""],["Clindamycin","","",4.0,4.0,1,""],["Metronidazole","","",4.0,4.0,0,""]],"prevotella":[["Benzylpenicillin","","",0.5,0.5,0,""],["Ampicillin","","",0.5,0.5,0,""],["Ampicillin-sulbactam","","",null,null,0,"Note"],["Amoxicillin","","",0.25,0.25,0,""],["Amoxicillin-clavulanic acid","","",null,null,0,"Note"],["Piperacillin-tazobactam","","",null,null,0,"Note"],["Ertapenem","","",0.5,0.5,0,""],["Imipenem","","",0.125,0.125,0,""],["Meropenem","","",0.25,0.25,0,""],["Clindamycin","","",0.25,0.25,0,""],["Metronidazole","","",4.0,4.0,0,""]],"fusonec":[["Benzylpenicillin","","",0.125,0.125,0,""],["Ampicillin","","",0.5,0.5,0,""],["Ampicillin-sulbactam","","",0.5,0.5,0,""],["Amoxicillin","","",0.5,0.5,0,""],["Amoxicillin-clavulanic acid","","",0.5,0.5,0,""],["Piperacillin-tazobactam","","",0.5,0.5,0,""],["Ertapenem","","",0.06,0.06,0,""],["Imipenem","","",0.125,0.125,0,""],["Meropenem","","",0.03,0.03,0,""],["Clindamycin","","",0.25,0.25,0,""],["Metronidazole","","",0.5,0.5,0,""]],"cperf":[["Benzylpenicillin","","",0.5,0.5,0,""],["Ampicillin","","",0.25,0.25,0,""],["Ampicillin-sulbactam","","",0.25,0.25,0,""],["Amoxicillin","","",0.25,0.25,0,""],["Amoxicillin-clavulanic acid","","",0.25,0.25,0,""],["Piperacillin-tazobactam","","",0.5,0.5,0,""],["Ertapenem","","",0.5,0.5,0,""],["Imipenem","","",0.5,0.5,0,""],["Meropenem","","",0.125,0.125,0,""],["Vancomycin","","",2.0,2.0,0,""],["Clindamycin","","",0.25,0.25,0,""],["Metronidazole","","",4.0,4.0,0,""]],"cacnes":[["Benzylpenicillin","","",0.06,0.06,0,""],["Ampicillin","","",0.25,0.25,0,""],["Ampicillin-sulbactam","","",null,null,0,"Note"],["Amoxicillin","","",0.25,0.25,0,""],["Amoxicillin-clavulanic acid","","",null,null,0,"Note"],["Piperacillin-tazobactam","","",null,null,0,"Note"],["Cefotaxime","","",null,null,0,"NA"],["Ceftriaxone","","",0.06,0.06,0,""],["Ertapenem","","",0.25,0.25,0,""],["Imipenem","","",0.03,0.03,0,""],["Meropenem","","",0.125,0.125,0,""],["Vancomycin","","",2.0,2.0,0,""],["Clindamycin","","",0.25,0.25,0,""],["Linezolid","","",2.0,2.0,0,""]],"cdiff":[["Vancomycin","","",2.0,2.0,0,""],["Fidaxomicin","","",0.5,0.5,0,""],["Metronidazole","","",2.0,2.0,0,""]]},
  };

  /* EU_AUTO rows: [agent, route, qualifier, S<=, R>, bracket(0/1), token]. token = IE / NA / Note / - when there is no numeric breakpoint.
     Extracted from the EUCAST v16.0 PDF (pages 68-114) with pdfplumber; indication/organism qualifiers are evaluated by euQual(). */
  let EU_LAST_SKIPPED = [];
  let EU_LAST_NOTE = '';
  const euSlug = (x) => String(x).toUpperCase().replace(/[^A-Z0-9]+/g, '');
  function euDrugId(name) {
    const raw = String(name).trim();
    const keys = [normName(raw), normName(raw.replace(/-/g, '/'))];
    for (const k of keys) if (ALIAS[k] && !ALIAS[k].qual) return ALIAS[k].id;
    const id = 'Z' + euSlug(raw).slice(0, 14);
    if (!DRUGS[id]) { DRUGS[id] = [raw, [raw.toLowerCase()]]; }
    keys.forEach((k) => { if (!ALIAS[k]) ALIAS[k] = { id, qual: false }; });
    return id;
  }
  function euQual(q, o, spec) {
    const ql = String(q || '').toLowerCase().trim();
    if (!ql) return { use: true };
    if (/^all indications/.test(ql)) return { use: true };
    if (/indications other than (endocarditis and )?meningitis/.test(ql)) return spec === 'csf' ? { use: false, why: 'dòng cho các chỉ định khác viêm màng não (đang là dịch não tủy)' } : { use: true };
    if (ql === 'meningitis') return spec === 'csf' ? { use: true } : { use: false, why: 'chỉ dùng cho viêm màng não (hãy chọn "Là dịch não tủy")' };
    if (/uncomplicated uti only/.test(ql)) return spec === 'urine' ? { use: true } : { use: false, why: 'chỉ áp dụng cho nước tiểu (UTI không biến chứng)' };
    if (/prophylaxis/.test(ql)) return { use: false, why: 'chỉ dùng cho phòng ngừa, không phải điều trị' };
    if (/screen only/.test(ql)) return { use: false, why: 'chỉ dùng để sàng lọc, không phân loại S/I/R' };
    if (/surrogate/.test(ql)) return { use: false, why: 'thuốc thay thế (surrogate), không phải điều trị' };
    const m = ql.match(/^([a-z])\. ([a-z]+)$/);
    if (m) return { use: !!(o.genus && o.genus[0] === m[1] && o.species === m[2]) };
    return { use: false, why: `điều kiện "${q}" chưa được áp dụng tự động` };
  }
  function euRows(rows, o, spec) {
    const map = {}; const skipped = []; const nonOral = {};
    rows.forEach((r) => { if (r[1] !== 'oral' && r[3] != null) nonOral[euDrugId(r[0])] = true; });
    rows.forEach((r) => {
      const name = r[0], route = r[1], qual = r[2], s = r[3], rg = r[4], br = r[5];
      if (s == null || rg == null) return; // IE / NA / Note / "-": EUCAST has no numeric breakpoint
      const q = euQual(qual, o, spec);
      const id = euDrugId(name);
      const label = `${name}${route ? ' ' + route : ''}${qual ? ' (' + qual + ')' : ''}`;
      if (!q.use) { if (q.why) skipped.push(`${label}: ${q.why}`); return; }
      if (route === 'oral' && nonOral[id]) { skipped.push(`${label}: đã dùng dòng tĩnh mạch/chung`); return; }
      const mul = id === 'SXT' ? 20 : 1;
      const x = br ? BR : {};
      const bp = s <= 0.001 ? euN(rg * mul, x) : eu(s * mul, rg * mul, x);
      if (!map[id]) map[id] = E_(bp, br ? { fn: ['eu_bracket?'] } : {});
    });
    EU_LAST_SKIPPED = skipped;
    return map;
  }
  const euAuto = (key) => (o, spec) => { EU_LAST_NOTE = ''; return euRows(EU_AUTO[key] || [], o, spec); };
  const ANA_SUB = (o) => {
    const g = o.genus, sp = o.species;
    if (['bacteroides', 'parabacteroides', 'phocaeicola'].includes(g)) return 'bacteroides';
    if (g === 'prevotella') return 'prevotella';
    if (g === 'fusobacterium' && sp === 'necrophorum') return 'fusonec';
    if ((g === 'clostridium' || g === 'clostridioides') && sp === 'perfringens') return 'cperf';
    if ((g === 'clostridioides' || g === 'clostridium') && sp === 'difficile') return 'cdiff';
    if ((g === 'cutibacterium' || g === 'propionibacterium') && sp === 'acnes') return 'cacnes';
    return null;
  };
  const EU_ANA = (o, spec) => {
    const sub = ANA_SUB(o);
    if (!sub) { EU_LAST_NOTE = 'EUCAST v16.0 chỉ có bảng cho Bacteroides/Parabacteroides, Prevotella, Fusobacterium necrophorum, Clostridium perfringens, Cutibacterium acnes và Clostridioides difficile; loài này không có breakpoint (xem hướng dẫn "no breakpoints" của EUCAST).'; EU_LAST_SKIPPED = []; return {}; }
    EU_LAST_NOTE = '';
    return euRows(EU_AUTO.anaerobe[sub], o, spec);
  };

  const EUCAST_MAP = {
    moraxella: euAuto('moraxella'), ngon: euAuto('ngon'), nmen: euAuto('nmen'), anaerobe: EU_ANA, hpylori: euAuto('hpylori'), listeria: euAuto('listeria'),
    pasteurella: euAuto('pasteurella'), campylobacter: euAuto('campylobacter'), corynebacterium: euAuto('coryn'), cdiph: euAuto('cdiph'), aerococcus: euAuto('aerococcus'),
    kingella: euAuto('kingella'), aeromonas: euAuto('aeromonas'), achromobacter: euAuto('achromobacter'), vibrio: euAuto('vibrio'), bacillus: euAuto('bacillus'),
    banthracis: euAuto('banthracis'), brucella: euAuto('brucella'), bpseudo: euAuto('bpseudo'), legionella: euAuto('legionella'), mtb: euAuto('mtb'),
    enterobacterales: EU_ENT, salshi: EU_ENT, pseudomonas: EU_PSA, other_nonent: EU_ONE, stenotrophomonas: EU_STM, acinetobacter: EU_ACB,
    staph_aureus: EU_STAPH, staph_sosa: EU_STAPH, enterococcus: EU_ENC, strep_pn: EU_SPN, strep_bh: EU_SBH, strep_vgs: EU_VGS, haemophilus: EU_HAE, burkholderia: () => ({}),
  };


  /* ---------------------------------------------------------------------------------------------- */
  /* EUCAST Expected Resistant Phenotypes v1.2 (2023-01) and Expected Susceptible Phenotypes v1.1 (2022-03).   */
  /* Column mapping verified against the table images. Drug ids are the app's ids.                             */
  /* ---------------------------------------------------------------------------------------------- */
  const X_AMP = ['AMP', 'AMX'], X_TCY = ['TCY', 'DOX', 'MNO'], X_CZO = ['CZO', 'CEP', 'CFL', 'CFD'], X_CST = ['CST', 'PMB'], X_AG = ['GEN', 'AMK', 'TOB', 'NET'];
  const EU_R_ENT = [ // Table 1: [test(org), ids, label]
    [(o) => o.genus === 'citrobacter' && ['koseri', 'amalonaticus', 'sedlakii', 'farmeri', 'rodentium'].includes(o.species), X_AMP.concat(['TIC']), 'Citrobacter koseri/amalonaticus'],
    [(o) => o.genus === 'citrobacter' && !['koseri', 'amalonaticus', 'sedlakii', 'farmeri', 'rodentium'].includes(o.species), X_AMP.concat(['AMC', 'SAM'], X_CZO, ['FOX']), 'Citrobacter freundii complex'],
    [(o) => o.genus === 'enterobacter', X_AMP.concat(['AMC', 'SAM'], X_CZO, ['FOX']), 'Enterobacter cloacae complex'],
    [(o) => o.genus === 'escherichia' && o.species === 'hermannii', X_AMP.concat(['TIC']), 'Escherichia hermannii'],
    [(o) => o.genus === 'hafnia', X_AMP.concat(['AMC'], X_CST), 'Hafnia alvei'],
    [(o) => o.genus === 'klebsiella' && o.species === 'aerogenes', X_AMP.concat(['AMC', 'SAM'], X_CZO, ['FOX']), 'Klebsiella aerogenes'],
    [(o) => o.genus === 'klebsiella' && o.species !== 'aerogenes', X_AMP.concat(['TIC']), 'Klebsiella pneumoniae complex / K. oxytoca'],
    [(o) => o.genus === 'leclercia', ['FOS'], 'Leclercia adecarboxylata'],
    [(o) => o.genus === 'morganella', X_AMP.concat(['AMC', 'SAM'], X_CZO, X_TCY, X_CST, ['NIT']), 'Morganella morganii'],
    [(o) => o.genus === 'plesiomonas', X_AMP.concat(['AMC', 'SAM']), 'Plesiomonas shigelloides'],
    [(o) => o.genus === 'proteus' && o.species === 'mirabilis', X_TCY.concat(X_CST, ['NIT']), 'Proteus mirabilis'],
    [(o) => o.genus === 'proteus' && o.species !== 'mirabilis', X_AMP.concat(X_CZO, ['CXM', 'CXMA'], X_TCY, X_CST, ['NIT']), 'Proteus penneri/vulgaris'],
    [(o) => o.genus === 'providencia', X_AMP.concat(['AMC', 'SAM'], X_CZO, X_TCY, X_CST, ['NIT']), 'Providencia spp.'],
    [(o) => o.genus === 'raoultella', X_AMP.concat(['TIC']), 'Raoultella spp.'],
    [(o) => o.genus === 'serratia', X_AMP.concat(['AMC', 'SAM'], X_CZO, ['FOX', 'CXM', 'CXMA'], X_CST, ['NIT']), 'Serratia marcescens'],
    [(o) => o.genus === 'yersinia' && o.species === 'enterocolitica', X_AMP.concat(['AMC', 'SAM', 'TIC'], X_CZO, ['FOX']), 'Yersinia enterocolitica'],
    [(o) => o.genus === 'yersinia' && o.species !== 'enterocolitica', X_CST, 'Yersinia pseudotuberculosis'],
    [(o) => o.genus === 'aeromonas' && ['hydrophila', 'caviae'].includes(o.species), X_AMP.concat(['SAM']), 'Aeromonas hydrophila/caviae'],
    [(o) => o.genus === 'aeromonas' && ['veronii', 'jandaei'].includes(o.species), X_AMP.concat(['SAM', 'TIC']), 'Aeromonas veronii/jandaei'],
    [(o) => o.genus === 'aeromonas' && o.species === 'dhakensis', X_AMP.concat(['SAM', 'FOX']), 'Aeromonas dhakensis'],
  ];
  const EU_R_ENT_ALL = 'benzylpenicillin, glycopeptide, lipoglycopeptide, acid fusidic, macrolide (một số ngoại lệ: azithromycin trị thương hàn, erythromycin trị tiêu chảy du khách), lincosamide, streptogramin, rifampicin, oxazolidinone (EUCAST Table 1)';
  const NFX = ['PEN', 'VAN', 'TEC', 'LNZ', 'TED', 'CLI', 'QDA', 'RIF', 'FUS', 'ERY', 'AZM', 'CLR', 'CZO', 'CXM', 'CEP', 'CFL', 'CFD'];
  const EU_R_NF = [ // Table 2 (non-fermenters)
    [(o) => o.genus === 'acinetobacter' && ['baumannii', 'pittii', 'nosocomialis', 'calcoaceticus', 'seifertii'].includes(o.species), X_AMP.concat(['AMC', 'SAM', 'CTX', 'CRO', 'ATM', 'ETP', 'FOS'], X_TCY.slice(0, 1)), 'Acinetobacter baumannii complex (ampicillin-sulbactam có thể ra nhạy do tác dụng của sulbactam; tetracycline/doxycycline kháng ở mức cao hơn minocycline/tigecycline)'],
    [(o) => o.genus === 'achromobacter', X_AMP.concat(['CTX', 'CRO', 'ATM', 'ETP']), 'Achromobacter xylosoxidans'],
    [(o) => o.genus === 'burkholderia' && o.species !== 'pseudomallei', X_AMP.concat(['AMC', 'SAM', 'TIC', 'TCC', 'PIP', 'TZP', 'CTX', 'CRO', 'ATM', 'ETP', 'CIP', 'CHL', 'FOS'], X_AG, X_CST), 'Burkholderia cepacia complex'],
    [(o) => o.genus === 'elizabethkingia', X_AMP.concat(['AMC', 'SAM', 'TIC', 'TCC', 'CTX', 'CRO', 'CAZ', 'FEP', 'ATM', 'ETP', 'IPM', 'MEM']), 'Elizabethkingia'],
    [(o) => o.genus === 'ochrobactrum', X_AMP.concat(['AMC', 'SAM', 'TIC', 'TCC', 'PIP', 'TZP', 'CTX', 'CRO', 'CAZ', 'FEP', 'ATM', 'ETP']), 'Ochrobactrum anthropi'],
    [(o) => o.genus === 'pseudomonas' && o.species === 'aeruginosa', X_AMP.concat(['AMC', 'SAM', 'CTX', 'CRO', 'ETP', 'CHL', 'TCY', 'TGC']), 'Pseudomonas aeruginosa (còn kháng kanamycin, neomycin; trimethoprim)'],
    [(o) => o.genus === 'stenotrophomonas', X_AMP.concat(['AMC', 'SAM', 'TIC', 'PIP', 'TZP', 'CTX', 'CRO', 'ATM', 'ETP', 'IPM', 'MEM', 'FOS', 'TCY'], X_AG), 'Stenotrophomonas maltophilia (SXT thường nhạy nhưng trimethoprim đơn độc kháng; doxycycline/minocycline/tigecycline thay đổi)'],
    [(o) => o.genus === 'chryseobacterium', X_AMP.concat(['AMC', 'SAM', 'TIC', 'TCC', 'CTX', 'CRO', 'ATM', 'ETP', 'IPM', 'MEM'], X_AG, X_CST), 'Chryseobacterium spp.'],
  ];
  const EU_R_GP = [ // Table 4 (gram-positive); AG = low-level resistance only (HLAR still tested)
    [(o) => o.genus === 'staphylococcus' && o.species === 'saprophyticus', ['FUS', 'CAZ', 'FOS'], 'S. saprophyticus (còn kháng novobiocin)'],
    [(o) => o.genus === 'staphylococcus' && ['cohnii', 'xylosus'].includes(o.species), ['CAZ'], 'S. cohnii/xylosus (còn kháng novobiocin)'],
    [(o) => o.genus === 'staphylococcus' && o.species === 'capitis', ['CAZ', 'FOS'], 'S. capitis'],
    [(o) => o.genus === 'staphylococcus', ['CAZ'], 'Tụ cầu (S. aureus và tụ cầu coagulase âm tính khác)'],
    [(o) => o.genus === 'streptococcus', ['FUS', 'CAZ'], 'Streptococcus spp. (aminoglycoside chỉ kháng mức thấp)'],
    [(o) => o.genus === 'enterococcus' && o.species === 'faecalis', ['FUS', 'CAZ', 'CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'FEP', 'ERY', 'AZM', 'CLR', 'CLI', 'QDA', 'SXT'].concat(X_AG), 'E. faecalis'],
    [(o) => o.genus === 'enterococcus' && ['gallinarum', 'casseliflavus', 'flavescens'].includes(o.species), ['FUS', 'CAZ', 'CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'FEP', 'ERY', 'AZM', 'CLR', 'CLI', 'QDA', 'VAN', 'SXT'].concat(X_AG), 'E. gallinarum/E. casseliflavus'],
    [(o) => o.genus === 'enterococcus', ['FUS', 'CAZ', 'CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'FEP', 'ERY', 'AZM', 'CLR', 'SXT', 'CLI'].concat(X_AG), 'E. faecium (clindamycin báo kháng dù xét nghiệm ra gì: Expert Rule 6)'],
    [(o) => o.genus === 'corynebacterium', ['FOS'], 'Corynebacterium spp.'],
    [(o) => o.genus === 'listeria', ['CAZ', 'CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'FEP'], 'Listeria monocytogenes (cephalosporin)'],
  ];
  const EU_R_GP_ALL = 'aztreonam, temocillin, polymyxin B/colistin, nalidixic acid (EUCAST Table 4)';
  // Expected susceptible phenotypes: resistance to these = suspicious (check ID or AST). [group test, ids, label]
  const EU_S_RULES = [
    ['2.1', (o) => o.genus === 'staphylococcus' && ['aureus', 'argenteus', 'schweitzeri'].includes(o.species), ['VAN', 'TEC', 'DAP', 'LNZ', 'TED', 'QDA', 'TGC', 'DAL', 'ORI', 'TLV'], 'S. aureus kháng vancomycin, teicoplanin, daptomycin, linezolid, tedizolid, quinupristin-dalfopristin, tigecycline… hiếm khi xảy ra'],
    ['2.2', (o) => o.genus === 'staphylococcus' && !['aureus', 'argenteus', 'schweitzeri'].includes(o.species), ['VAN', 'DAP', 'TGC'], 'Tụ cầu coagulase âm tính kháng vancomycin, daptomycin, tigecycline… hiếm khi xảy ra (linezolid, tedizolid, quinupristin-dalfopristin: hiếm tùy nước)'],
    ['2.3', (o) => o.genus === 'corynebacterium', ['VAN', 'TEC', 'DAP', 'LNZ', 'TED', 'QDA', 'TGC'], 'Corynebacterium kháng vancomycin, teicoplanin, daptomycin, linezolid… hiếm khi xảy ra'],
    ['2.4', (o) => o.genus === 'streptococcus' && o.species === 'pneumoniae', ['ETP', 'IPM', 'MEM', 'DOR', 'VAN', 'TEC', 'DAP', 'LNZ', 'TED', 'QDA', 'TGC', 'RIF'], 'Phế cầu kháng carbapenem, vancomycin, teicoplanin, linezolid, rifampicin… hiếm khi xảy ra'],
    ['2.5', (o) => o.genus === 'streptococcus' && (['pyogenes', 'agalactiae', 'dysgalactiae', 'equi', 'canis'].includes(o.species)), ['PEN', 'AMP', 'CTX', 'CRO', 'FEP', 'CPT', 'VAN', 'TEC', 'DAP', 'LNZ', 'TED', 'QDA', 'TGC'], 'Liên cầu β-tan huyết nhóm A, B, C, G kháng penicillin, cephalosporin, vancomycin, linezolid… hiếm khi xảy ra'],
    ['2.6', (o) => o.genus === 'enterococcus', ['DAP', 'LNZ', 'TGC'], 'Enterococcus kháng daptomycin, linezolid, tigecycline hiếm khi xảy ra'],
    ['2.7', (o) => o.genus === 'enterococcus' && o.species === 'faecalis', ['AMP'], 'E. faecalis kháng ampicillin hiếm khi xảy ra'],
    ['1.1', (o) => ['escherichia', 'klebsiella', 'enterobacter', 'citrobacter', 'raoultella', 'salmonella', 'shigella', 'hafnia', 'pantoea', 'cronobacter'].includes(o.genus), ['CST', 'PMB'], 'Enterobacterales (trừ Morganellaceae và Serratia marcescens) kháng colistin hiếm khi xảy ra (trừ nước có kháng colistin phổ biến)'],
    ['1.3', (o) => (o.genus === 'pseudomonas' && o.species === 'aeruginosa') || o.genus === 'acinetobacter', ['CST', 'PMB'], 'P. aeruginosa và Acinetobacter kháng colistin hiếm khi xảy ra (trừ nước có kháng colistin phổ biến)'],
    ['1.4', (o) => o.genus === 'haemophilus' && o.species === 'influenzae', ['CTX', 'CRO', 'CAZ', 'FEP', 'ETP', 'IPM', 'MEM', 'CIP', 'LVX', 'MXF'], 'H. influenzae kháng cephalosporin thế hệ 3, carbapenem, fluoroquinolone hiếm khi xảy ra'],
    ['1.5', (o) => o.genus === 'moraxella', ['CTX', 'CRO', 'CAZ', 'CIP', 'LVX', 'MXF'], 'M. catarrhalis kháng cephalosporin thế hệ 3 hoặc fluoroquinolone hiếm khi xảy ra'],
    ['1.6', (o) => o.genus === 'neisseria' && o.species === 'meningitidis', ['CTX', 'CRO', 'CIP', 'LVX'], 'N. meningitidis kháng cephalosporin thế hệ 3 hoặc fluoroquinolone hiếm khi xảy ra'],
    ['1.7', (o) => o.genus === 'neisseria' && o.species === 'gonorrhoeae', ['SPC'], 'N. gonorrhoeae kháng spectinomycin hiếm khi xảy ra'],
    ['3.1', (o) => o.genus === 'bacteroides', ['MTZ'], 'Bacteroides kháng metronidazole hiếm khi xảy ra'],
    ['3.2', (o) => (o.genus === 'clostridioides' || o.genus === 'clostridium') && o.species === 'difficile', ['MTZ', 'VAN', 'FDX'], 'C. difficile kháng metronidazole, vancomycin, fidaxomicin hiếm khi xảy ra'],
  ];
  function euExpectedResistant(group, org) {
    const tab = group === 'enterobacterales' || group === 'salshi' || group === 'aeromonas' ? EU_R_ENT
      : ['pseudomonas', 'acinetobacter', 'stenotrophomonas', 'other_nonent', 'burkholderia', 'bpseudo', 'achromobacter'].includes(group) ? EU_R_NF
      : ['staph_aureus', 'staph_sosa', 'enterococcus', 'strep_pn', 'strep_bh', 'strep_vgs', 'corynebacterium', 'cdiph', 'listeria'].includes(group) ? EU_R_GP : null;
    const hit = tab ? tab.find((r) => r[0](org)) : null;
    let ids = hit ? hit[1].slice() : [];
    const texts = hit ? [`Kháng kỳ vọng (EUCAST Expected Resistant Phenotypes): ${hit[2]}`] : [];
    let all = '';
    if (tab === EU_R_ENT) all = EU_R_ENT_ALL;
    else if (tab === EU_R_NF) { all = 'benzylpenicillin, cephalosporin thế hệ 1–2, glycopeptide, lipoglycopeptide, acid fusidic, macrolide, lincosamide, streptogramin, rifampicin, oxazolidinone (EUCAST Table 2)'; ids = ids.concat(NFX); }
    else if (tab === EU_R_GP) all = EU_R_GP_ALL;
    if (group === 'haemophilus') { ids = ['FUS', 'QDA', 'VAN', 'TEC', 'CLI', 'LNZ']; texts.push('H. influenzae: acid fusidic, streptogramin, glycopeptide, lincosamide, oxazolidinone (EUCAST Table 3)'); }
    if (group === 'moraxella' || group === 'ngon' || group === 'nmen') { ids = ['VAN', 'TEC', 'CLI', 'LNZ']; texts.push('Moraxella/Neisseria: glycopeptide, lincosamide, oxazolidinone, trimethoprim đơn độc (EUCAST Table 3)'); }
    if (group === 'campylobacter') { ids = ['FUS', 'QDA', 'VAN', 'TEC', 'CLI', 'LNZ']; texts.push('Campylobacter: acid fusidic, streptogramin, trimethoprim (và nalidixic acid với C. fetus) (EUCAST Table 3)'); }
    if ((org.genus === 'clostridium' || org.genus === 'clostridioides') && ['ramosum', 'innocuum'].includes(org.species)) { ids = ['VAN']; texts.push('C. ramosum/C. innocuum kháng vancomycin (EUCAST Table 5)'); }
    if (['serratia', 'providencia', 'proteus', 'morganella'].includes(org.genus)) { ids.push('TGC'); texts.push('Tigecycline: báo kháng bất kể kết quả với Serratia, Providencia, Proteus, Morganella (EUCAST Expert Rule 9)'); }
    return { ids, texts, all };
  }

  /* EUCAST dosages used to define breakpoints (Dosages v16.0): standard dosage -> S, high dosage -> I */
  const EU_DOSE = {
    AMP: ['2 g x3 IV', '2 g x4 IV (viêm màng não: 2 g x6 IV)'], SAM: ['(2 g ampicillin + 1 g sulbactam) x3 IV', '(2 g + 1 g) x4 IV'],
    AMX: ['1 g x3–4 IV; uống 0,5 g x3', '2 g x6 IV; uống 0,75–1 g x3'], AMC: ['(1 g + 0,2 g) x3–4 IV', '(2 g + 0,2 g) x3 IV'],
    PIP: ['4 g x4 IV', '4 g x4 IV truyền kéo dài 3 giờ'], TZP: ['(4 g + 0,5 g) x4 IV truyền 30 phút hoặc x3 IV truyền kéo dài 4 giờ', '(4 g + 0,5 g) x4 IV truyền kéo dài 3 giờ'],
    TCC: ['(3 g + 0,1–0,2 g) x4 IV', '(3 g + 0,1 g) x6 IV'], PEN: ['0,6 g (1 MU) x4 IV', '1,2 g (2 MU) x6 IV (viêm màng não: 2,4 g (4 MU) x6 IV)'],
    CZO: ['1 g x3 IV', '2 g x3 IV'], CXM: ['0,75 g x3 IV', '1,5 g x3 IV'], FEP: ['1 g x3 IV hoặc 2 g x2 IV', '2 g x3 IV (nhiễm P. aeruginosa nặng: 2 g x3 truyền kéo dài 4 giờ)'],
    FDC: ['2 g x3 IV truyền 3 giờ', null], CTX: ['1 g x3 IV', '2 g x3 IV (viêm màng não: 2 g x4 IV)'], CPT: ['0,6 g x2 IV truyền 1 giờ', '0,6 g x3 IV truyền 2 giờ'],
    CAZ: ['1 g x3 IV', '2 g x3 IV hoặc 1 g x6 IV'], CZA: ['(2 g + 0,5 g) x3 IV truyền 2 giờ', null], CZT: ['(1 g + 0,5 g) x3 IV truyền 1 giờ (ổ bụng, tiết niệu); (2 g + 1 g) x3 (viêm phổi bệnh viện)', null],
    CRO: ['2 g x1 IV', '2 g x2 IV hoặc 4 g x1 IV (viêm màng não: 2 g x2 hoặc 4 g x1)'],
    DOR: ['0,5 g x3 IV truyền 1 giờ', '1 g x3 IV truyền 1 giờ'], ETP: ['1 g x1 IV truyền 30 phút', null], IPM: ['0,5 g x4 IV truyền 30 phút', '1 g x4 IV truyền 30 phút'],
    IMR: ['(0,5 g imipenem + 0,25 g relebactam) x4 IV truyền 30 phút', null], MEM: ['1 g x3 IV truyền 30 phút', '2 g x3 IV truyền 3 giờ (viêm màng não: 2 g x3 IV)'],
    ATM: ['1 g x3 IV', '2 g x4 IV (P. aeruginosa nặng: 2 g x4 truyền 3 giờ)'],
    CIP: ['0,5 g x2 uống hoặc 0,4 g x2 IV', '0,75 g x2 uống hoặc 0,4 g x3 IV'], LVX: ['0,5 g x1 uống/IV', '0,5 g x2 uống/IV'], MXF: ['0,4 g x1 uống/IV', null],
    AMK: ['25–30 mg/kg x1 IV', null], GEN: ['6–7 mg/kg x1 IV', null], TOB: ['6–7 mg/kg x1 IV', null],
    TEC: ['0,4 g x1 IV (liều thay đổi theo chỉ định)', null], VAN: ['0,5 g x4 hoặc 1 g x2 IV hoặc 2 g x1 truyền liên tục (theo cân nặng, theo dõi nồng độ thuốc)', null],
    AZM: ['0,5 g x1 uống/IV', null], CLR: ['0,25 g x2 uống', null], ERY: ['0,5 g x2–4 uống/IV', null], CLI: ['0,3 g x2 uống hoặc 0,6 g x3 IV', null], QDA: ['7,5 mg/kg x2 IV', null],
    DOX: ['0,1 g x1 uống', null], MNO: ['0,1 g x2 uống', null], TCY: ['0,25 g x4 uống', null], TGC: ['liều nạp 0,1 g, sau đó 50 mg x2 IV', null],
    LNZ: ['0,6 g x2 uống/IV', null], TED: ['0,2 g x1 uống/IV', null], CHL: ['1 g x4 uống/IV', '2 g x4 uống/IV'],
    CST: ['4,5 MU x2 IV, liều nạp 9 MU', null], DAP: ['4 mg/kg x1 IV (6 mg/kg khi kèm nhiễm khuẩn huyết/viêm nội tâm mạc do S. aureus)', null],
    FOS: ['fosfomycin IV 16–18 g/ngày chia 3–4 lần', null], NIT: ['50–100 mg x3–4 uống (chỉ UTI không biến chứng)', null], RIF: ['0,6 g x1 uống/IV', null], FUS: ['0,5 g x2 uống/IV', null],
    SXT: ['(0,16 g + 0,8 g) x2 uống/IV', '(0,24 g + 1,2 g) x2 uống/IV'],
  };

  const EU_TIER_TEXT = (t) => 'EUCAST không chia tier hay cascade. App dùng danh sách ưu tiên (Tier ' + (t === 0 ? 'Other' : t) + ') của CLSI làm quy tắc báo cáo mặc định của bệnh viện; có thể chỉnh trong cài đặt.';

  function euGroup(G, groupKey, org, spec) {
    const fnMap = EUCAST_MAP[groupKey];
    EU_LAST_SKIPPED = []; EU_LAST_NOTE = '';
    const map = fnMap ? fnMap(org, spec) : {};
    const skippedNow = EU_LAST_SKIPPED.slice(); const noteNow = EU_LAST_NOTE;
    const agents = {};
    Object.keys(G.agents).forEach((id) => {
      const base = G.agents[id];
      const e = map[id];
      if (base.hlar) { agents[id] = Object.assign({}, base); return; }
      if (!e || !e.bp) { agents[id] = Object.assign({}, base, { bp: null, euNone: true, fn: [], dose: null, dual: null, bpFor: null, hideIf: base.hideIf }); return; }
      agents[id] = Object.assign({}, base, { bp: e.bp, dual: null, bpFor: null, fn: e.fn || [], euVar: { men: e.men || null, uti: e.uti || null }, bracket: !!e.bp.bracket });
    });
    Object.keys(map).forEach((id) => {
      const e = map[id];
      if (!e || !e.bp || agents[id]) return;
      agents[id] = { tier: G.euAll ? 1 : 0, euOnly: true, bp: e.bp, dose: null, fn: e.fn || [], euVar: { men: e.men || null, uti: e.uti || null }, bracket: !!e.bp.bracket, trig: [] };
    });
    Object.keys(agents).forEach((id) => {
      const d = EU_DOSE[id];
      if (agents[id].bp && d) agents[id].dose = { s: d[0], high: d[1] };
      else if (agents[id].bp) agents[id].dose = null;
    });
    const out = Object.assign({}, G, { agents, standard: 'eucast', tables: 'EUCAST v16.0 Breakpoint Tables', euSkipped: skippedNow, euNote: noteNow, intrinsic: (oo) => euExpectedResistant(groupKey, oo) });
    if (G.euAll) out.order = Object.keys(agents);
    if (groupKey === 'burkholderia') out.noAst = 'EUCAST không có breakpoint cho B. cepacia complex (xem tài liệu hướng dẫn riêng của EUCAST). Không báo S/I/R.';
    return out;
  }

  /* EUCAST ATU (MIC), extracted from the tables: only listed where EUCAST says a warning is needed. */
  const EU_ATU = {
    enterobacterales: { TZP: 16, CIP: 0.5 }, salshi: { TZP: 16, CIP: 0.5 },
    staph_aureus: { CPT: 1 }, haemophilus: { CXM: 2 },
  };
  const CAT_VI_EU = { S: 'Nhạy (liều chuẩn)', I: 'Nhạy, tăng phơi nhiễm', R: 'Kháng', NS: 'Không nhạy', SDD: 'Nhạy phụ thuộc liều' };
  const catLabel = (c, std) => ((std === 'eucast' ? CAT_VI_EU : CAT_VI)[c] || c);

  /* Short comments for the patient (clinician) report. CLSI M100 (Rx comments) allows therapy comments on the patient
     report but says dosage-regimen comments are generally not for individual reports; so only high-value items are kept. */
  function clinicalComments(rep, org, by, quals, spec) {
    const out = [];
    const add = (level, text) => out.push({ level, text });
    const shown = (id) => rep.reported.find((r) => r.id === id);
    const isStaph = org.group === 'staph_aureus' || org.group === 'staph_sosa';
    const ent = org.group === 'enterobacterales';
    // --- alerts
    if (rep.flags.mrs) add('alert', `${org.group === 'staph_aureus' ? 'MRSA' : 'Tụ cầu kháng methicillin (MRS)'}: kháng toàn bộ β-lactam, trừ ceftaroline.`);
    if (by.VAN && org.group === 'staph_aureus') {
      if (by.VAN.cat === 'I') add('alert', 'Vancomycin trung gian (VISA): cần xác nhận tại labo tham chiếu.');
      else if (by.VAN.mic >= 8 || by.VAN.cat === 'R') add('alert', 'Vancomycin MIC ≥8 µg/mL: cần xác nhận tại labo tham chiếu.');
    }
    if (rep.flags.cre) add('alert', rep.flags.carbapenemase ? 'Chủng sinh carbapenemase: nên hội chẩn truyền nhiễm và báo kiểm soát nhiễm khuẩn.' : 'Kháng carbapenem: cần xác định có sinh carbapenemase hay không; nên hội chẩn truyền nhiễm và báo kiểm soát nhiễm khuẩn.');
    else if (['ETP', 'IPM', 'MEM'].some((i) => by[i] && by[i].cat === 'I')) add('warn', 'Carbapenem trung gian: cân nhắc liều tối đa, truyền kéo dài; nên hội chẩn truyền nhiễm.');
    if (rep.flags.crpa) add('alert', rep.flags.carbapenemase ? 'Pseudomonas aeruginosa sinh carbapenemase: nên hội chẩn truyền nhiễm và báo kiểm soát nhiễm khuẩn.' : 'Pseudomonas aeruginosa kháng carbapenem: nên xác định có sinh carbapenemase hay không, hội chẩn truyền nhiễm và báo kiểm soát nhiễm khuẩn.');
    if (rep.flags.crab) add('alert', 'Acinetobacter kháng carbapenem: nên hội chẩn truyền nhiễm và báo kiểm soát nhiễm khuẩn.');
    if (rep.flags.vre) add('alert', 'Enterococcus kháng vancomycin (VRE): báo kiểm soát nhiễm khuẩn, nên hội chẩn truyền nhiễm.');
    if (rep.mapped) add('warn', `Vi khuẩn "${rep.mapped.from}" không có bảng riêng trong CLSI M100: kết quả được ngoại suy theo bảng "${rep.mapped.label}"; cần bác sĩ vi sinh xác nhận.`);
    if (org.group === 'burkholderia') add('info', 'Không làm kháng sinh đồ thường quy cho B. cepacia complex do thiếu phương pháp thử chính xác (CLSI Table 2B-3); MIC của ceftazidime, levofloxacin, meropenem, minocycline, trimethoprim-sulfamethoxazole ở chủng hoang dã cao và có thể vượt mức đạt được bằng liều thường dùng.');
    if (org.group === 'strep_pn' && spec === 'csf' && by.PEN_M && by.PEN_M.cat && by.PEN_M.cat !== 'S') add('alert', 'S. pneumoniae từ dịch não tủy không nhạy penicillin theo ngưỡng viêm màng não: nên hội chẩn truyền nhiễm.');
    if (rep.flags.carbapenemase) {
      if (by.FEP && by.FEP.deduced) add('warn', 'Cefepime báo KHÁNG vì chủng sinh carbapenemase (dù MIC trong vùng nhạy).');
      if (['CTX', 'CRO', 'CAZ'].some((i) => by[i] && by[i].cat === 'S')) add('warn', 'Chưa đủ bằng chứng lâm sàng và xét nghiệm để kết luận cephalosporin có hiệu quả với chủng sinh carbapenemase dù MIC trong vùng nhạy (CLSI).');
    }
    (rep.euRules || []).forEach((r) => add(r.level, r.text));
    if (ent && rep.standard !== 'eucast' && AMPC_GENERA(org) && ['CTX', 'CRO', 'CAZ'].some((i) => { const r = shown(i); return r && r.cat === 'S'; })) add('warn', 'Cephalosporin thế hệ 3 có thể mất tác dụng trong lúc điều trị (AmpC cảm ứng); cefepime là lựa chọn thay thế.');
    if (org.group === 'strep_vgs' && ((by.PEN && by.PEN.cat === 'I') || (by.AMP && by.AMP.cat === 'I'))) add('warn', 'Penicillin/ampicillin trung gian: có thể cần phối hợp aminoglycoside (nhất là viêm nội tâm mạc).');
    const cli = shown('CLI');
    if (cli && cli.icr) add('warn', 'Clindamycin: kháng cảm ứng (D-test dương) – báo kháng.');
    // --- SDD / I meaning (CLSI definitions)
    rep.reported.filter((r) => r.cat === 'SDD' && r.dose && r.def.dose && r.def.dose.s).forEach((r) => add('info', `${r.name} – SDD: tiêu chí nhạy dựa trên liều ${r.def.dose.s}; tiêu chí SDD dựa trên chế độ liều có phơi nhiễm thuốc cao hơn (liều cao hơn, dùng thường xuyên hơn, hoặc cả hai), tham khảo: ${r.dose.text}.`));
    if (rep.standard !== 'eucast' && rep.reported.some((r) => r.cat === 'I')) add('info', 'I (trung gian): vùng đệm; thuốc có thể còn hiệu quả ở vị trí thuốc tập trung (vd. nước tiểu) hoặc khi dùng liều cao hơn, đáp ứng có thể thấp hơn so với nhạy.');
    // --- Rx (therapy) comments
    if (isStaph && shown('GEN')) add('info', 'Gentamicin chỉ dùng phối hợp với thuốc khác còn hoạt tính.');
    if (shown('CST')) add('info', 'Colistin: hiệu quả lâm sàng hạn chế, nên phối hợp thuốc và hội chẩn truyền nhiễm.');
    if (shown('NIT') || shown('FOS')) add('info', `${shown('NIT') && shown('FOS') ? 'Nitrofurantoin và fosfomycin' : shown('NIT') ? 'Nitrofurantoin' : 'Fosfomycin'}: chỉ dùng cho nhiễm khuẩn đường tiết niệu.`);
    const czo = shown('CZO');
    if (czo && czo.czoUti && czo.cat === 'S') add('info', 'Cefazolin (nước tiểu): chỉ áp dụng cho UTI không biến chứng; nhạy dự đoán nhạy các cephalosporin uống (cephalexin, cefaclor, cefuroxime…).');
    if (ent && ((shown('CTX') && !shown('CRO')) || (shown('CRO') && !shown('CTX')))) add('info', `Cefotaxime và ceftriaxone dùng chung breakpoint: kết quả của thuốc này dự đoán cho thuốc kia (${rep.standard === 'eucast' ? 'EUCAST' : 'CLSI'}).`);
    const order = { alert: 0, warn: 1, info: 2 };
    return out.map((o, i) => ({ o, i })).sort((a, b) => order[a.o.level] - order[b.o.level] || a.i - b.i).map((x) => x.o);
  }

  function buildReport(iso, settingsIn, opts) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, settingsIn || {});
    opts = opts || {};
    const force = new Set(opts.forceShow || []);
    const hide = new Set(opts.forceHide || []);
    const org = classifyOrganism(iso.organism, opts.groupOverride);
    const spec = opts.specimen || guessSpecimen(iso.source);
    const rep = {
      org, spec, settings, group: null,
      reported: [], hidden: [], notes: [], qc: [], checks: [], treatment: { doses: [], emergence: [], general: '', doseNote: '' }, footnotes: [], flags: {}, intrinsicText: [], unsupported: false,
    };
    const standard = settings.standard === 'eucast' ? 'eucast' : 'clsi';
    rep.standard = standard;
    rep.standardLabel = standard === 'eucast' ? EUCAST_EDITION : EDITION;
    let G = GROUPS[org.group];
    if (G && G.clsiAlias && standard === 'clsi') { org.group = G.clsiAlias; G = GROUPS[G.clsiAlias]; }
    const noClsi = !!(G && G.euOnly && standard === 'clsi');
    const noClsiLabel = noClsi ? G.label : '';
    if (noClsi) G = null;
    if (G && standard === 'eucast') G = euGroup(G, org.group, org, spec);
    const TT = (t) => (standard === 'eucast' ? EU_TIER_TEXT(t) : TIER_TEXT[t]);
    if (!G) {
      rep.unsupported = true;
      rep.asIs = org.fungus ? 'fungus' : null;
      rep.needGroup = opts.groupOverride !== 'none' && !org.fungus;
      rep.suggestions = suggestGroups(org);
      rep.euAvailable = noClsi;
      if (noClsi) rep.notes.push({ level: 'warn', text: `CLSI M100 không có bảng cho ${noClsiLabel}, nhưng EUCAST v16.0 có. Đổi "Tiêu chuẩn diễn giải" sang EUCAST ở cột trái để diễn giải chủng này, hoặc chọn nhóm khác / ghi nguyên kết quả Vitek.` });
      else if (org.fungus) rep.notes.push({ level: 'info', text: 'Nấm: ngoài phạm vi bảng vi khuẩn của CLSI M100 và EUCAST. Theo yêu cầu của bệnh viện, kết quả được ghi nguyên như Vitek đã diễn giải; app không lọc, không diễn giải lại và không kiểm tra bất thường.' });
      else rep.notes.push({ level: 'warn', text: rep.needGroup
        ? `Không có bảng CLSI riêng cho "${org.raw || 'vi khuẩn chưa rõ'}" trong app. Hãy chọn nhóm áp dụng ở tab "KTV kiểm tra", hoặc chọn ghi nguyên kết quả Vitek.`
        : 'Đã chọn không áp bảng CLSI: kết quả Vitek nguyên trạng, app không lọc và không kiểm tra bất thường.' });
      // known drugs first, then drugs the app has no name for (e.g. antifungals, metronidazole): nothing may silently disappear
      rep.raw = iso.results.map((r) => ({ id: r.id, name: drugName(r.id), mic: r.micRaw || fmtMic(r.op, r.mic), vitek: r.vitek }))
        .concat((iso.unknown || []).filter((u) => u.rec).map((u, i) => ({ id: 'x' + i, name: u.name, mic: fmtMic(u.rec.op, u.rec.mic), vitek: u.rec.vitek })));
      return rep;
    }
    rep.group = G;

    const quals = iso.quals || {};
    const isEcoli = org.genus === 'escherichia' && org.species === 'coli';

    // --- intrinsic resistance (Appendix B)
    const intrinsicIds = new Set();
    if (org.group === 'enterobacterales' && standard === 'clsi') {
      INTRINSIC_ENT.forEach((r) => { if (r.test(org)) { r.ids.forEach((i) => intrinsicIds.add(i)); rep.intrinsicText.push(r.text); } });
      if (isEcoli) rep.intrinsicText.push('E. coli: không có kháng tự nhiên với β-lactam (Appendix B1).');
      rep.intrinsicAll = INTRINSIC_ALL_ENT_TEXT;
      if (!INTRINSIC_ENT.some((r) => r.test(org)) && !isEcoli) {
        rep.notes.push({ level: 'info', text: `Chưa nạp hàng kháng tự nhiên riêng cho ${org.raw}; hãy đối chiếu Appendix B1.` });
      }
    } else if (G.intrinsic) {
      const x = G.intrinsic(org);
      x.ids.forEach((i) => intrinsicIds.add(i));
      (x.texts || []).forEach((t) => rep.intrinsicText.push(t));
      rep.intrinsicAll = x.all || '';
    }

    // --- classify every numeric result
    const rows = [];
    const mkRow = (id, name, d, r) => {
      if (d && d.tierFn) d = Object.assign({}, d, { tier: d.tierFn(org) });
      if (d && d.bpFor) d = Object.assign({}, d, { bp: d.bpFor(org, spec) });
      if (d && d.euVar) {
        if (spec === 'csf' && d.euVar.men) { d = Object.assign({}, d, { bp: d.euVar.men }); name = `${name} (viêm màng não)`; }
        else if (spec === 'urine' && d.euVar.uti) { d = Object.assign({}, d, { bp: d.euVar.uti, bracket: false, fn: (d.fn || []).filter((k) => !k.startsWith('eu_bracket')) }); }
      }
      const row = { id, name, op: r.op, mic: r.mic, micText: r.micRaw || fmtMic(r.op, r.mic), vitek: r.vitek, flags: r.flags, def: d, cat: null };
      if (d && d.hlar) { row.cat = r.vitek === 'R' ? 'R' : (r.vitek === 'S' ? 'S' : null); row.hlar = true; }
      else if (d && d.bp && r.mic != null) {
        const c = classify(r.mic, r.op, d.bp);
        row.cat = c.cat; row.ambiguous = c.ambiguous || null;
        row.bp = d.bp;
      }
      if (intrinsicIds.has(id)) {
        row.intrinsic = true;
        row.intrinsicWas = row.cat;
        row.cat = 'R';
      }
      return row;
    };
    iso.results.forEach((r) => {
      let def = G.agents[r.id];
      const rowName = drugName(r.id);
      let rowLabel = rowName;
      let czoNotCovered = false, czoUti = false;
      if (r.id === 'CZO' && org.group === 'enterobacterales' && def) {
        const czoSp = isEcoli || (org.genus === 'klebsiella' && org.species === 'pneumoniae') || (org.genus === 'proteus' && org.species === 'mirabilis');
        if (!czoSp) czoNotCovered = true;
        else if (spec === 'urine' && standard === 'clsi') { def = Object.assign({}, def, { bp: { s: 16, r: 32 }, dose: null }); rowLabel = 'Cefazolin (UTI không biến chứng)'; czoUti = true; }
      }
      if (org.group === 'staph_sosa' && org.species === 'lugdunensis' && r.id === 'OXA' && def) def = Object.assign({}, def, { bp: { s: 2, r: 4 } });
      if (def && def.dual) {
        const nonRow = mkRow(r.id, `${rowName} (không viêm màng não)`, Object.assign({}, def, { bp: def.dual.non, dual: null, nonMen: true }), r);
        const menRow = mkRow(r.id + '_M', `${rowName} (viêm màng não)`, Object.assign({}, def, { bp: def.dual.men, dual: null, menRow: true }), r);
        rows.push(nonRow, menRow);
        return;
      }
      if (standard === 'eucast' && r.id === 'CZO' && def && def.bp) rowLabel = 'Cefazolin (nhiễm trùng có nguồn từ đường tiết niệu)';
      const row = mkRow(r.id, rowLabel, def, r);
      row.czoNotCovered = czoNotCovered; row.czoUti = czoUti;
      rows.push(row);
    });
    const by = {}; rows.forEach((r) => (by[r.id] = r));
    const nonS = (id) => by[id] && by[id].cat && NONS(by[id].cat);

    // --- organism-specific mechanisms
    let mrs = false, mssa = false;
    if (org.group === 'staph_aureus' || org.group === 'staph_sosa') {
      const oxaR = by.OXA && by.OXA.cat === 'R';
      const OXA_ONLY = ['pseudintermedius', 'intermedius', 'schleiferi', 'coagulans'].includes(org.species);
      if (OXA_ONLY && org.group === 'staph_sosa') rep.notes.push({ level: 'info', text: `${org.raw}: CLSI Table 2C dùng oxacillin (không dùng cefoxitin) để phát hiện kháng methicillin ở loài này; app bỏ qua cefoxitin screen và dựa vào MIC oxacillin (S ≤0,5, R ≥1).` });
      const screen = OXA_ONLY ? undefined : quals.FOXS;
      const foxMicR = !OXA_ONLY && by.FOX && by.FOX.cat === 'R';
      mrs = !!(screen === 'POS' || oxaR || foxMicR);
      mssa = !mrs && (!!(by.OXA && by.OXA.cat === 'S') || screen === 'NEG');
      if (screen === 'NEG' && oxaR) rep._foxIncons = 'neg';
      if (screen === 'POS' && by.OXA && by.OXA.cat === 'S') rep._foxIncons = 'pos';
      if (mrs && by.OXA && by.OXA.cat !== 'R') { by.OXA.cat = 'R'; by.OXA.deduced = 'Cefoxitin screen dương → báo kháng oxacillin'; }
      if (mrs && !by.OXA && screen === 'POS') {
        const r = { id: 'OXA', name: 'Oxacillin', op: '=', mic: null, micText: 'screen +', vitek: '', def: G.agents.OXA, cat: 'R', deduced: 'Suy ra từ cefoxitin screen dương', bp: G.agents.OXA.bp, noMic: true };
        rows.push(r); by.OXA = r;
      }
      rep.flags.mrs = mrs; rep.flags.mssa = mssa;
      if (mrs) rep.notes.push({ level: 'alert', text: `${org.group === 'staph_aureus' ? 'MRSA' : 'MRS'} (kháng methicillin/oxacillin): kháng toàn bộ penicillin, chất ức chế β-lactamase phối hợp, cephalosporin (trừ ceftaroline) và carbapenem. Không cần thử/báo các β-lactam này.`, fn: 'st_mrs' });
      if (!mrs && !mssa) rep.notes.push({ level: 'warn', text: 'Chưa xác định được MRSA/MSSA (thiếu oxacillin/cefoxitin screen).' });
    }
    if (org.group === 'enterobacterales') {
      const carbaR = ['ETP', 'IPM', 'MEM'].filter((i) => by[i] && by[i].cat === 'R');
      const carbaI = ['ETP', 'IPM', 'MEM'].filter((i) => by[i] && (by[i].cat === 'I'));
      const onlyImpPMP = PMP(org) && carbaR.length === 1 && carbaR[0] === 'IPM';
      if (carbaR.length && !onlyImpPMP) {
        rep.flags.cre = true;
        if (quals.ESBL === 'NEG' && (nonS('CTX') || nonS('CRO') || nonS('CAZ'))) rep.notes.push({ level: 'info', text: 'Vitek báo ESBL ÂM nhưng chủng kháng cephalosporin thế hệ 3 và carbapenem: kiểu hình này không giải thích được bằng ESBL đơn thuần; ESBL ÂM không loại trừ cơ chế khác (carbapenemase, AmpC kèm mất porin…). Đây là nhận định hỗ trợ, không phải quy định của CLSI.' });
      } else if (carbaR.length && onlyImpPMP) {
        rep.notes.push({ level: 'info', text: 'Chỉ kháng imipenem ở Proteus/Providencia/Morganella: không bắt buộc thử carbapenemase (MIC imipenem thường cao hơn do cơ chế khác).', fn: 'ent_imp_pm' });
      }
      if (nonS('CTX') || nonS('CRO')) rep.flags.c3 = true;
      if (quals.ESBL && !rep.flags.cre) rep.notes.push({ level: 'info', text: `Vitek báo ESBL ${quals.ESBL === 'POS' ? 'DƯƠNG' : 'ÂM'}. CLSI không yêu cầu thử ESBL thường quy với breakpoint hiện hành; kết quả này chỉ để tham khảo/kiểm soát nhiễm khuẩn.`, fn: 'ent_ceph' });
      if (AMPC_GENERA(org)) rep.notes.push({ level: 'warn', text: `${org.raw}: nguy cơ kháng cephalosporin thế hệ 3 xuất hiện trong điều trị (AmpC cảm ứng) dù lần đầu báo nhạy.`, fn: 'ent_ampc' });
      if (rep.intrinsicText.length && !isEcoli) rep.notes.push({ level: 'info', text: `Kháng tự nhiên (Appendix B1) của ${org.raw}: ${rep.intrinsicText.join('; ')}. Báo kháng nếu có thử; có thể ghi chú cho thuốc không thử.` });
    }
    if (org.group === 'strep_vgs') {
      const pI = by.PEN && by.PEN.cat === 'I', aI = by.AMP && by.AMP.cat === 'I';
      if (pI || aI) rep.notes.push({ level: 'warn', text: 'Penicillin/ampicillin trung gian: có thể cần phối hợp aminoglycoside để diệt khuẩn (đặc biệt nếu viêm nội tâm mạc).', fn: 'vgs_rx' });
      if (by.PEN && by.PEN.cat === 'R') rep.notes.push({ level: 'warn', text: 'Penicillin kháng ở viridans: cân nhắc cephalosporin thế hệ 3 hoặc vancomycin theo kết quả; hội chẩn truyền nhiễm.' });
    }

    // --- Staph ICR logic
    let cliHold = false;
    if (['staph_aureus', 'staph_sosa', 'strep_bh', 'strep_pn'].includes(org.group) || (standard === 'eucast' && (org.group === 'strep_vgs' || org.group === 'corynebacterium'))) {
      const eryR = by.ERY && by.ERY.cat === 'R';
      if (eryR && by.CLI && (by.CLI.cat === 'S' || by.CLI.cat === 'I')) {
        if (quals.ICR === 'POS') { by.CLI.cat = 'R'; by.CLI.deduced = 'ICR dương tính → báo kháng'; by.CLI.icr = true; }
        else if (quals.ICR === 'NEG') { /* ok */ }
        else { cliHold = true; }
      }
    }

    // --- other organism-specific mechanisms
    if (org.group === 'haemophilus' && by.AMP && quals.BLAC === 'POS' && by.AMP.cat !== 'R') { by.AMP.cat = 'R'; by.AMP.deduced = 'β-lactamase dương → báo kháng ampicillin'; }
    if (org.group === 'pseudomonas' || org.group === 'acinetobacter') {
      const cr = ['IPM', 'MEM', 'DOR', 'ETP'].filter((i) => by[i] && by[i].cat === 'R');
      if (cr.length) { if (org.group === 'pseudomonas') rep.flags.crpa = true; else rep.flags.crab = true; }
      if (org.group === 'pseudomonas' && quals.CARBA === 'POS') rep.flags.carbapenemase = true;
    }
    if (org.group === 'enterococcus' && by.VAN && by.VAN.cat === 'R') rep.flags.vre = true;
    if (G.noAst) rep.notes.push({ level: 'info', text: G.noAst });
    if (G.euNote) rep.notes.push({ level: 'warn', text: G.euNote });
    if (standard === 'eucast' && G.euAll) rep.notes.push({ level: 'info', text: 'EUCAST không quy định danh sách thuốc báo cáo cho nhóm này: app báo mọi thuốc có breakpoint số trong bảng EUCAST (bệnh viện chỉnh theo chính sách riêng). Bảng được trích tự động từ PDF EUCAST; kỹ thuật viên nên đối chiếu với bản gốc.' });
    if (standard === 'eucast' && G.euSkipped && G.euSkipped.length) rep.notes.push({ level: 'info', text: `EUCAST có ${G.euSkipped.length} dòng chưa được áp dụng tự động cho chủng này: ${G.euSkipped.slice(0, 8).join('; ')}${G.euSkipped.length > 8 ? '; …' : ''}.` });
    if (G.note) rep.notes.push({ level: 'info', text: G.note });
    if (org.mapped) rep.mapped = { from: org.raw, group: org.group, label: G.label, remembered: !!opts.mappedRemembered };

    // --- carbapenemase confirmed (mCIM / Carba NP / molecular): cefepime S/SDD must be reported R (Table 2A-1 comment 19)
    if (org.group === 'enterobacterales' && quals.CARBA === 'POS' && standard === 'clsi') {
      rep.flags.carbapenemase = true;
      if (by.FEP && (by.FEP.cat === 'S' || by.FEP.cat === 'SDD')) { by.FEP.cat = 'R'; by.FEP.deduced = 'Có carbapenemase → báo kháng cefepime (Table 2A-1 comment 19)'; by.FEP.vitekDiffers = false; }
    }

    // --- S. aureus penicillin S needs a beta-lactamase test (Table 2C comment 9)
    let penHold = false;
    if (org.group === 'staph_aureus' && by.PEN && by.PEN.cat === 'S' && !mrs) {
      if (quals.BLAC === 'POS') { by.PEN.cat = 'R'; by.PEN.deduced = 'β-lactamase dương → báo kháng penicillin'; }
      else if (quals.BLAC !== 'NEG') penHold = true;
    }


    // --- EUCAST Expert Rules (v3.3 Enterobacterales, Nov 2025 Staphylococcus/Streptococcus/Enterococcus/pneumococcus, v3.2 others)
    if (standard === 'eucast') {
      rep.euApplied = rep.euApplied || [];
      const force = (ids, why) => ids.forEach((i) => { const r = by[i]; if (r && r.cat !== 'R') { rep.euApplied.push(`${r.name}: ${r.cat || 'chưa phân loại'} → R. ${why}`); r.euWas = r.cat; r.cat = 'R'; r.deduced = why; } });
      const setS = (ids, why) => ids.forEach((i) => { const r = by[i]; if (r && r.cat && r.cat !== 'S' && !r.intrinsic) { rep.euApplied.push(`${r.name}: ${r.cat} → S. ${why}`); r.euWas = r.cat; r.cat = 'S'; r.deduced = why; } });
      const euNote = (level, text) => { rep.euRules = rep.euRules || []; rep.euRules.push({ level, text }); };
      const euInfo = (text) => { rep.euApplied.push(text); };
      const g = org.group, sp = org.species, ge = org.genus;
      const catOf2 = (i) => (by[i] ? by[i].cat : null);
      if (g === 'enterobacterales' || g === 'salshi') {
        if ((ge === 'escherichia' && sp === 'coli') || (ge === 'proteus' && sp === 'mirabilis')) { if (catOf2('AMP') === 'R') force(['PIP'], 'EUCAST Expert Rule 1: ampicillin kháng → piperacillin kháng'); else if (catOf2('AMP') === 'S') setS(['PIP'], 'EUCAST Expert Rule 1: ampicillin nhạy → piperacillin nhạy'); }
        if ((ge === 'klebsiella' && sp !== 'aerogenes') || ge === 'raoultella') force(['PIP'], 'EUCAST Expert Rule 2: Klebsiella/Raoultella báo piperacillin kháng bất kể kết quả');
        if (AMPC_GENERA(org) || ge === 'hafnia') euNote('warn', `${org.raw}: nếu nhạy cefotaxime, ceftriaxone, ceftazidime hoặc piperacillin±tazobactam thì nên ghi chú không dùng đơn trị hoặc phối hợp aminoglycoside vì nguy cơ chọn lọc đột biến mất kìm hãm AmpC (chọn cefepime thì nguy cơ này không có hoặc rất thấp) – EUCAST Expert Rule 3.`);
        if (['serratia', 'morganella', 'providencia'].includes(ge)) euNote('info', `${org.raw}: đơn trị cefotaxime, ceftriaxone hoặc ceftazidime ít khi chọn lọc được đột biến kháng (EUCAST Expert Rule 4).`);
        if (AMPC_GENERA(org) || ['serratia', 'morganella', 'hafnia', 'providencia'].includes(ge)) force(['CXM', 'CXMA'], 'EUCAST Expert Rule 5: cefuroxime (và cephalosporin thế hệ 2) báo kháng ở các loài này');
        if (g === 'enterobacterales' && catOf2('CIP') === 'R') force(['LVX', 'MXF', 'OFX'], 'EUCAST Expert Rule 8: ciprofloxacin kháng → mọi fluoroquinolone kháng');
        if (['escherichia', 'klebsiella', 'raoultella'].includes(ge) && ge !== 'klebsiella' || (ge === 'klebsiella' && sp !== 'aerogenes') || ge === 'raoultella') {
          const c3 = ['CTX', 'CRO', 'CAZ', 'FEP'].filter((i) => catOf2(i));
          if (c3.some((i) => catOf2(i) === 'R') && c3.some((i) => catOf2(i) === 'S' || catOf2(i) === 'I') && spec !== 'urine') euNote('warn', 'Kháng một cephalosporin thế hệ 3/4 nhưng nhạy cái khác: báo từng thuốc theo kết quả thử, kèm cảnh báo kết quả điều trị chưa chắc chắn ngoài nhiễm khuẩn tiết niệu (EUCAST Expert Rule 7). Kiểu hình này thường do ESBL.');
        }
        { const c34 = ['CTX', 'CRO', 'CAZ', 'FEP'].some((i) => catOf2(i) === 'R');
          if (['escherichia', 'klebsiella', 'raoultella'].includes(ge) && ge !== 'klebsiella' || (ge === 'klebsiella' && sp !== 'aerogenes') || ge === 'raoultella') {
            if (c34 && ['TZP', 'AMC'].some((i) => catOf2(i) === 'S')) euInfo('Kháng cephalosporin thế hệ 3/4 nhưng nhạy piperacillin-tazobactam hoặc amoxicillin-clavulanate: báo như đã thử (EUCAST Expert Rule 6). Kiểu hình này hay do ESBL; chủng ESBL đôi khi thử nhạy với phối hợp chất ức chế β-lactamase, việc dùng còn tranh luận (cần liều phù hợp).');
          } }
        if (g === 'salshi' || ge === 'salmonella') {
          if (ge === 'salmonella') {
            force(['AMK', 'GEN', 'TOB', 'NET'], 'EUCAST Expert Rule (Salmonella) 2: aminoglycoside báo kháng (không hiệu quả trong nhiễm Salmonella xâm lấn)');
            force(['CXM', 'CXMA', 'CZO', 'FOX'], 'EUCAST Expert Rule (Salmonella) 1: cephalosporin thế hệ 2 báo kháng hoặc không báo');
            if (catOf2('CIP') === 'R') euNote('warn', 'Salmonella ciprofloxacin MIC >0,06: báo kháng ciprofloxacin và cảnh báo không dùng fluoroquinolone khác (EUCAST Expert Rule Salmonella 3).');
          }
        }
      }
      if (g === 'staph_aureus' || g === 'staph_sosa') {
        if (g === 'staph_aureus' && (catOf2('PEN') === 'R' || quals.BLAC === 'POS')) force(['AMP', 'AMX', 'PIP', 'TIC'], 'EUCAST Expert Rule (Staphylococcus) 2: benzylpenicillin kháng hoặc β-lactamase dương → mọi penicillin kháng (trừ isoxazolylpenicillin và phối hợp chất ức chế β-lactamase)');
        if (catOf2('LVX') === 'R' || catOf2('MXF') === 'R') force(['CIP', 'LVX', 'MXF', 'OFX'], 'EUCAST Expert Rule (Staphylococcus) 6: levofloxacin hoặc moxifloxacin kháng → mọi fluoroquinolone kháng');
        if (rep.flags.mrs) force(['PEN', 'AMP', 'AMX', 'AMC', 'SAM', 'TZP', 'PIP', 'TCC', 'OXA', 'CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'CAZ', 'FEP', 'IPM', 'MEM', 'ETP', 'DOR'], 'EUCAST Expert Rule (Staphylococcus) 1: cefoxitin screen dương (MRSA/MRS) → kháng mọi β-lactam, trừ các thuốc có chỉ định riêng cho MRSA (ceftaroline, ceftobiprole phải thử riêng)');
        else if (rep.flags.mssa) euInfo('Cefoxitin screen âm (MSSA/MSS): báo nhạy với mọi β-lactam có tác dụng kháng tụ cầu đã biết (EUCAST Expert Rule Staphylococcus 1).');
        if (catOf2('TCY') === 'S') setS(['DOX', 'MNO', 'TGC'], 'EUCAST Expert Rule (Staphylococcus) 7: tetracycline nhạy → doxycycline, minocycline, tigecycline nhạy');
        else if (catOf2('TCY') === 'R') euInfo('Tetracycline kháng: doxycycline và minocycline báo kháng hoặc báo theo MIC riêng đã thử; tigecycline luôn phải thử và báo riêng (EUCAST Expert Rule Staphylococcus 7).');
        if (catOf2('LNZ') === 'S') setS(['TED'], 'EUCAST Expert Rule (Staphylococcus) 8: linezolid nhạy → tedizolid nhạy');
        if (catOf2('ERY') === 'S' && catOf2('CLI') === 'R') euNote('info', 'Erythromycin nhạy nhưng clindamycin kháng: hiếm, có thể do enzyme bất hoạt lincosamide (linA/lnuA); báo như đã thử (EUCAST Expert Rule Staphylococcus 4).');
      }
      if (g === 'strep_pn' || g === 'strep_bh' || g === 'strep_vgs') {
        if (catOf2('LVX') === 'R' || catOf2('MXF') === 'R') force(['LVX', 'MXF'], 'EUCAST Expert Rule (Streptococcus) 4: kháng một fluoroquinolone → báo kháng mọi fluoroquinolone');
        if (g === 'strep_bh' && catOf2('PEN') === 'R') rep.euBhPenR = true;
        if (g === 'strep_bh' && catOf2('PEN') === 'S') setS(['AMP', 'AMX', 'CTX', 'CRO', 'FEP', 'CPT', 'MEM', 'IPM', 'ETP'], 'EUCAST Expert Rule (Streptococcus) 1: nhạy benzylpenicillin → nhạy aminopenicillin, cephalosporin, carbapenem');
        if (g === 'strep_vgs' && by.PEN && by.PEN.mic != null && (by.PEN.op === '<=' || by.PEN.op === '=') && by.PEN.mic <= 0.25) setS(['AMP', 'AMX', 'CTX', 'CRO', 'FEP', 'CXM', 'ETP', 'IPM', 'MEM'], 'EUCAST Expert Rule (Streptococcus) 2: sàng lọc benzylpenicillin âm (MIC ≤0,25) → nhạy mọi β-lactam có chỉ định');
        if (g === 'strep_vgs' && by.PEN && by.PEN.mic != null && by.PEN.mic > 0.25) euInfo('Sàng lọc benzylpenicillin dương (MIC >0,25): không suy ra kết quả β-lactam khác; dùng MIC của từng thuốc hoặc báo kháng (EUCAST Expert Rule Streptococcus 2).');
        if ((g === 'strep_bh' || g === 'strep_pn') && catOf2('ERY') === 'S' && (catOf2('CLI') === 'S')) euInfo('Nhạy cả erythromycin và clindamycin: báo nhạy mọi macrolide và lincosamide (EUCAST Expert Rule 2/3).');
        if (g === 'strep_pn' && catOf2('TCY') === 'S') setS(['DOX', 'MNO'], 'EUCAST Expert Rule (S. pneumoniae) 5: tetracycline nhạy → doxycycline, minocycline nhạy');
        if (g === 'strep_pn' && catOf2('TCY') === 'R') euInfo('Tetracycline kháng: doxycycline, minocycline báo kháng hoặc báo theo MIC riêng đã thử (EUCAST Expert Rule S. pneumoniae 5).');
        if (quals.ICR === 'POS' && (g === 'strep_bh')) euNote('info', 'Liên cầu β-tan huyết kháng clindamycin cảm ứng: clindamycin nhạy khi thử vẫn có thể dùng trong nhiễm trùng da mô mềm nhẹ, và trong phối hợp để giảm tổng hợp độc tố khi cần (vd. viêm cân mạc hoại tử do liên cầu) – EUCAST Expert Rule Streptococcus 3, mục Remarks.');
      }
      if (g === 'enterococcus') {
        if (catOf2('AMP') === 'R') force(['IPM', 'PIP', 'TZP'], 'EUCAST Expert Rule (Enterococcus) 1: ampicillin kháng → ureidopenicillin và imipenem kháng');
        if (ge === 'enterococcus' && sp === 'faecalis' && catOf2('AMP') === 'S') euInfo('E. faecalis nhạy ampicillin: thường nhạy amoxicillin (±clavulanate) và "nhạy, tăng phơi nhiễm" với piperacillin (±tazobactam); vì một số chủng kháng piperacillin dù nhạy ampicillin nên EUCAST khuyến cáo thử thuốc cần báo (Expert Rule Enterococcus 1).');
        if (catOf2('GENHL') === 'S') euInfo('Enterococcus không kháng gentamicin mức cao: báo gentamicin còn hiệp đồng với thuốc tác động thành tế bào (EUCAST Expert Rule Enterococcus 2).');
        if (catOf2('STRHL') === 'S') euInfo('Enterococcus không kháng streptomycin mức cao: báo streptomycin còn hiệp đồng (EUCAST Expert Rule Enterococcus 3).');
        if (catOf2('GENHL') === 'R') euNote('warn', 'Enterococcus kháng gentamicin mức cao: phối hợp gentamicin và các aminoglycoside khác (trừ streptomycin) với β-lactam không còn hiệp đồng; nên thử streptomycin mức cao (EUCAST Expert Rule Enterococcus 2).');
        if (catOf2('STRHL') === 'R') euNote('warn', 'Enterococcus kháng streptomycin mức cao: phối hợp streptomycin với β-lactam không còn hiệp đồng (EUCAST Expert Rule Enterococcus 3).');
        if (catOf2('VAN') === 'R' && (catOf2('TEC') === 'S')) euNote('warn', 'Enterococcus kháng vancomycin nhưng nhạy teicoplanin (vanB): kháng teicoplanin có thể xuất hiện trong lúc điều trị (EUCAST Expert Rule Enterococcus 5).');
      }
      if (g === 'haemophilus') {
        if (catOf2('TCY') === 'S') setS(['DOX', 'MNO'], 'EUCAST Expert Rule (Haemophilus) 3: tetracycline nhạy → doxycycline, minocycline nhạy');
        if (catOf2('TCY') === 'R') euInfo('Tetracycline kháng: doxycycline, minocycline báo kháng hoặc theo MIC riêng đã thử (EUCAST Expert Rule Haemophilus 3).');
      }
      if (ge === 'salmonella' && by.CIP && by.CIP.mic != null && by.CIP.mic <= 0.06 && by.CIP.op !== '>' && by.CIP.op !== '>=') euInfo('Salmonella ciprofloxacin MIC ≤0,06 mg/L: báo nhạy ciprofloxacin (và các fluoroquinolone khác có hiệu quả đã chứng minh trong nhiễm Salmonella xâm lấn) – EUCAST Expert Rule Salmonella 3.');
      if (g === 'campylobacter') {
        if (catOf2('ERY') === 'S') euNote('info', 'Campylobacter nhạy erythromycin: azithromycin và clarithromycin báo nhạy (EUCAST Expert Rule Campylobacter 1).');
        if (catOf2('ERY') === 'R') force(['AZM', 'CLR'], 'EUCAST Expert Rule (Campylobacter) 1: erythromycin kháng → azithromycin, clarithromycin kháng');
      }
      if (g === 'corynebacterium' && catOf2('ERY') === 'R' && (catOf2('CLI') === 'S' || catOf2('CLI') === 'I')) euNote('warn', 'Corynebacterium (trừ C. diphtheriae) kháng erythromycin: clindamycin có thể kháng cảm ứng; báo kháng clindamycin nếu thử cảm ứng dương (EUCAST Expert Rule Corynebacterium 1).');
      if (g === 'strep_pn' || g === 'strep_bh' || g === 'staph_aureus' || g === 'staph_sosa') { /* ICR handled with D-test hold (EUCAST Expert Rules: Staphylococcus 3, Streptococcus 3) */ }
    }

    // --- reporting decisions
    const triggerOK = (def) => {
      const t = def.trig;
      if (t === 'mrs') return mrs;
      if (t === 'mssa') return mssa;
      if (Array.isArray(t)) return t.some((id) => nonS(id));
      return false;
    };
    const addHidden = (row, kind, reason, extra) => {
      const base = HIDE_INFO[kind] || HIDE_INFO.policy; const x = extra || {};
      const tier = row.def ? row.def.tier : null;
      rep.hidden.push({ id: row.id, name: row.name, micText: row.micText, vitek: row.vitek, cat: row.cat, tier, kind, reason, risk: x.risk || base.risk, restore: x.restore || base.restore, need: x.need || '', tierText: tier == null ? '' : TT(tier) });
    };

    rows.forEach((row) => {
      const def = row.def;
      if (!def) {
        if (row.intrinsic) { addHidden(row, 'policy', `Kháng tự nhiên của ${org.raw || 'vi khuẩn này'} (Appendix B): CLSI không báo thường quy; nếu có thử thì báo kháng.`, { restore: 'blocked', risk: 'Kết quả ra nhạy ở thuốc kháng tự nhiên thường do lỗi định danh hoặc lỗi thử nghiệm; báo ra có thể dẫn đến thất bại điều trị.' }); return; }
        if (G.suppress && G.suppress.includes(row.id)) { addHidden(row, 'policy', G.suppressText, { restore: 'blocked', risk: 'Thuốc có thể tỏ ra nhạy in vitro nhưng không hiệu quả lâm sàng; báo nhạy có thể dẫn đến thất bại điều trị.' }); return; }
        if ((G.noBp || []).includes(row.id) || DRUGS[row.id]) addHidden(row, 'nobp', `Không có breakpoint CLSI M100-Ed36 cho ${G.label}; không diễn giải theo CLSI (Vitek có thể dùng tiêu chuẩn khác như FDA/EUCAST).`);
        return;
      }
      if (row.noMic && !def.bp) return;
      if (!row.cat && row.ambiguous && !row.intrinsic && !def.hlar) { addHidden(row, 'qc', `MIC ${row.micText} cắt ngang breakpoint (${row.ambiguous.join('/')}) của ${standard === 'eucast' ? 'EUCAST' : 'CLSI'}, không phân loại chắc chắn được.`, { restore: 'blocked', need: 'Cần MIC chính xác (thử lại bằng thẻ hoặc phương pháp có dải nồng độ phù hợp).', risk: 'Báo S/I/R khi MIC chưa đủ chính xác có thể sai nhóm nhạy/kháng.' }); return; }
      if (def.euNone) { addHidden(row, 'nobp', `EUCAST v16.0 không có breakpoint (ghi "IE", "-" hoặc chỉ nêu trong ghi chú) cho thuốc này ở nhóm "${G.label}"; không diễn giải. Vitek có thể dùng tiêu chuẩn khác.`); return; }
      row.noExport = !!(def.menRow && spec !== 'csf');
      if (def.nonMen && spec === 'csf') { addHidden(row, 'policy', 'Chủng từ dịch não tủy: chỉ báo ngưỡng viêm màng não (Table 2G comments 10, 14).', { restore: 'blocked', risk: 'Ngưỡng không viêm màng não cao hơn nhiều; báo cho dịch não tủy có thể dẫn đến thiếu liều điều trị viêm màng não.' }); return; }
      if (row.czoNotCovered) { addHidden(row, 'policy', 'Breakpoint cefazolin của CLSI chỉ áp dụng cho E. coli, K. pneumoniae và P. mirabilis (Table 1A-1, Table 2A-1 comments 17–18).', { restore: 'blocked', risk: 'Áp breakpoint ngoài loài CLSI đã xác lập sẽ diễn giải sai.' }); return; }
      if (def.tier === 0) {
        const msg = standard === 'eucast' ? 'Có breakpoint EUCAST nhưng thuốc không nằm trong danh sách báo cáo mặc định của app (EUCAST không quy định danh sách này); lấy lại khi cần.'
          : (row.id === 'QDA') ? 'Quinupristin-dalfopristin chỉ báo cho MSSA, không nằm trong Table 1C.'
          : 'Có breakpoint ở Table 2 nhưng không nằm trong Table 1: CLSI không khuyến cáo báo thường quy.';
        if (row.id === 'QDA' && mssa && !hide.has(row.id)) { /* still not in Table 1 */ }
        addHidden(row, 'policy', msg); return;
      }
      if (def.hideIf) { const hx = def.hideIf(org, spec); if (hx) { addHidden(row, hx.kind || 'policy', hx.reason, { restore: hx.restore, risk: hx.risk }); return; } }
      if (def.onlyMSSA && !mssa) { addHidden(row, 'policy', 'Chỉ báo cho MSSA (Table 2C).', { risk: 'Dữ liệu chỉ xác lập cho MSSA; báo cho MRSA dễ gây hiểu nhầm là còn dùng được.' }); return; }
      if (def.onlyEcoli && !isEcoli) { addHidden(row, 'policy', 'Fosfomycin chỉ báo cho E. coli (Table 1A-1 fn f).', { restore: 'blocked', risk: 'Breakpoint fosfomycin của CLSI chỉ có cho E. coli ở đường tiết niệu.' }); return; }
      // specimen rules
      if (def.urine === 'only' && spec !== 'urine') { addHidden(row, 'specimen', spec === 'unknown' ? 'Kháng sinh chỉ báo cho mẫu nước tiểu; bệnh phẩm chưa xác định nên đang ẩn.' : 'Kháng sinh chỉ báo cho mẫu nước tiểu (Table 1).', { risk: 'Thuốc chỉ đạt nồng độ hữu hiệu ở nước tiểu, không đạt ở máu hoặc mô. Báo cho mẫu khác nước tiểu có thể bị dùng điều trị nhiễm khuẩn huyết hoặc nhiễm trùng mô, dẫn đến thất bại điều trị.' }); return; }
      if (def.urine === 'not' && spec === 'urine') { addHidden(row, 'specimen', 'Không báo thường quy cho chủng phân lập từ đường tiết niệu (Table 1).', { risk: 'CLSI không báo thường quy thuốc này cho nước tiểu; báo ra dễ khiến chọn thuốc không phù hợp cho nhiễm khuẩn tiết niệu.' }); return; }
      if (def.notLRT && spec === 'lrt') { addHidden(row, 'specimen', 'Không báo thường quy cho mẫu đường hô hấp dưới (daptomycin).', { risk: 'Daptomycin bị chất surfactant ở phổi bất hoạt: xét nghiệm có thể ra "nhạy" nhưng điều trị viêm phổi thất bại.' }); return; }
      if (row.id === 'CLI' && cliHold) { addHidden(row, 'qc', 'Erythromycin kháng và clindamycin nhạy/trung gian: phải có kết quả test ICR (D-test/BMD) trước khi báo clindamycin (Table 2C comment 23).', { need: 'Nhập kết quả D-test ở mục "Việc cần làm".', risk: 'Nếu bỏ sót kháng clindamycin cảm ứng, bệnh nhân dùng clindamycin có thể thất bại điều trị dù báo "nhạy".' }); return; }
      if (row.id === 'PEN' && penHold) { addHidden(row, 'qc', 'S. aureus MIC penicillin ≤0,12: CLSI yêu cầu test β-lactamase (zone-edge) trước khi báo nhạy (Table 2C comment 9; Table 3G).', { need: 'Nhập kết quả test β-lactamase ở mục "Việc cần làm".', risk: 'MIC không phát hiện được β-lactamase cảm ứng; báo nhạy có thể dẫn đến thất bại điều trị bằng penicillin.' }); return; }
      if (row.id === 'PEN' && mrs && !force.has('PEN')) { addHidden(row, 'policy', 'MRS: CLSI cho phép báo penicillin là kháng hoặc không báo; đã gộp vào nhận xét MRSA.', { risk: 'Không có nguy cơ lâm sàng đáng kể nếu báo là KHÁNG; chỉ làm dài bảng.' }); return; }
      if (hide.has(row.id)) { addHidden(row, 'manual', 'Đã ẩn thủ công.'); return; }

      // tier logic
      let show = false, why = '';
      if (def.tier === 1) show = true;
      else if (force.has(row.id)) { show = true; why = 'manual'; }
      else if (def.tier === 2) {
        if (settings.tier2 === 'always') { show = true; why = 'always'; }
        else if (settings.tier2 === 'cascade' && triggerOK(def)) { show = true; why = 'cascade'; }
        else if (row.cat === 'R') { show = true; why = 'rAlways'; }
        else addHidden(row, 'cascade', settings.tier2 === 'hide' ? 'Tier 2: đang ẩn theo cài đặt.' : 'Tier 2: chỉ báo theo cascade của BV; chưa đủ điều kiện kích hoạt.');
      } else if (def.tier === 3) {
        if (settings.mdro && triggerOK(def)) { show = true; why = 'cascade'; }
        else if (row.cat === 'R') { show = true; why = 'rAlways'; }
        else addHidden(row, 'tier3', settings.mdro ? 'Tier 3: chưa đủ điều kiện cascade.' : 'Tier 3: chỉ thử/báo ở BV phục vụ bệnh nhân nguy cơ MDRO cao, theo cascade.');
      } else if (def.tier === 4) {
        if (settings.tier4) { show = true; why = 'request'; }
        else addHidden(row, 'tier4', 'Tier 4: chỉ báo khi bác sĩ lâm sàng yêu cầu (khi các thuốc ở tier khác không phù hợp).');
      }
      if (!show) { rep._skipped = rep._skipped || []; return; }
      const nsTrig = Array.isArray(def.trig) ? def.trig.filter((id) => nonS(id)).map(drugName) : [];
      const tw = why === 'cascade' ? `Mở theo cascade vì ${def.trig === 'mrs' ? 'chủng là MRS/MRSA' : def.trig === 'mssa' ? 'chủng là MSSA' : nsTrig.join(', ') + ' không nhạy'}.`
        : why === 'rAlways' ? 'Kết quả KHÁNG của thuốc Tier 2–3 luôn được báo theo CLSI, kể cả khi chưa đủ điều kiện cascade.'
        : why === 'always' ? 'Đang báo thường quy theo cài đặt của bệnh viện.'
        : why === 'manual' ? 'Kỹ thuật viên thêm thủ công.'
        : why === 'request' ? 'Báo theo yêu cầu của bác sĩ lâm sàng.'
        : def.tier === 1 ? 'Báo thường quy.' : '';
      rep.reported.push({ ...row, tier: def.tier, why, tierText: TT(def.tier), tierWhy: tw });
    });

    // order reported by group order
    const ord = (id) => { const k = G.order.indexOf(id); return k < 0 ? 999 : k; };
    rep.reported.sort((a, b) => a.tier - b.tier || ord(a.id) - ord(b.id));
    rep.hidden.sort((a, b) => (a.tier || 9) - (b.tier || 9) || ord(a.id) - ord(b.id));

    // --- Vitek vs CLSI discrepancies (all rows, reported or not)
    rows.forEach((row) => {
      if (!row.cat && row.ambiguous) {
        rep.qc.push({ level: 'warn', text: `${row.name} ${row.micText}: giá trị MIC cắt ngang breakpoint (${row.ambiguous.join('/')}), không phân loại chắc chắn; cần MIC chính xác.` });
        return;
      }
      if (!row.cat || !row.vitek || row.intrinsic || row.noMic) return;
      if (!['S', 'I', 'R'].includes(row.vitek)) return;
      const c = row.cat;
      if (c !== row.vitek && !(row.vitek === 'I' && c === 'SDD')) {
        const hard = (c === 'S' && row.vitek === 'R') || (c === 'R' && row.vitek === 'S');
        rep.qc.push({ level: hard ? 'warn' : 'info', text: `${row.name} ${row.micText}: Vitek diễn giải ${row.vitek}, CLSI M100-Ed36 diễn giải ${c}. Báo cáo dùng kết quả CLSI.` });
        row.vitekDiffers = true;
      } else if (row.vitek === 'I' && c === 'SDD') {
        rep.qc.push({ level: 'info', text: `${row.name} ${row.micText}: Vitek ghi I, CLSI phân loại SDD (nhạy phụ thuộc liều).` });
      }
    });
    if (by.CTX && by.CRO && by.CTX.cat && by.CRO.cat && by.CTX.cat !== by.CRO.cat) rep.qc.push({ level: 'info', text: 'Cefotaxime và ceftriaxone cho kết quả khác loại (breakpoint giống nhau): cân nhắc thử lại.' });
    if (org.group === 'enterobacterales') {
      const cs = ['ETP', 'IPM', 'MEM'].filter((i) => by[i] && by[i].cat);
      if (cs.some((i) => by[i].cat === 'S') && cs.some((i) => by[i].cat === 'R') && !PMP(org)) rep.qc.push({ level: 'warn', text: 'Carbapenem cho kết quả S lẫn R trong cùng chủng: kiểm tra lại và thử carbapenemase.' });
    }
    if (iso.unknown && iso.unknown.length) rep.qc.push({ level: 'info', text: `Dòng chưa nhận diện từ PDF: ${iso.unknown.map((u) => `${u.name} (${u.raw})`).join('; ')}.` });

    // --- footnotes assembled from reported agents (+ notes)
    const used = [];
    const useFn = (k) => { if (FN[k] && !used.includes(k)) used.push(k); };
    rep.reported.forEach((r) => {
      const keys = [];
      (r.def.fn || []).forEach((k0) => {
        let k = k0;
        if (k.endsWith('?')) {
          k = k.slice(0, -1);
          if (k === 'ent_ampc' && !AMPC_GENERA(org)) return;
          if (k === 'ent_tzp_sdd' && r.cat !== 'SDD') return;
          if (k === 'ent_imp_pm' && !PMP(org)) return;
          if (k === 'st_pen_s' && r.cat !== 'S') return;
          if (k === 'vgs_rx' && !(r.cat === 'I')) return;
          if (k === 'sal_fq' && !(r.cat === 'I' || r.cat === 'R')) return;
          if (k === 'eu_bracket' && !r.def.bracket) return;
          if (k === 'enc_lnz' && org.species !== 'faecalis') return;
          if (k === 'sbh_gbs' && org.species !== 'agalactiae') return;
        }
        if (k === 'st_cli' && !(by.ERY && by.ERY.cat === 'R' && r.cat !== 'R')) return;
        keys.push(k);
      });
      if (standard === 'clsi') {
        if (r.icr) keys.push('st_cli_ind');
        if (r.id === 'OXA' && mrs) keys.unshift('st_mrs');
        if (r.id === 'PEN' && mrs) keys.push('st_pen_r');
      }
      if (standard === 'eucast' && r.bp && r.bp.noS && !keys.includes('eu_offscale')) keys.push('eu_offscale');
      r.fnKeys = keys;
      keys.forEach(useFn);
    });
    rep.notes.forEach((n) => { if (n.fn) useFn(n.fn); });
    // dose
    let anyDose = false;
    rep.reported.forEach((r) => {
      const d = r.def.dose;
      r.dose = null;
      if (!d) return;
      if (r.cat === 'S' && d.s) r.dose = { kind: 'S', text: d.s };
      else if (r.cat === 'SDD' && d.sdd) r.dose = { kind: 'SDD', text: d.sdd };
      else if (standard === 'eucast' && r.cat === 'I' && d.high) r.dose = { kind: 'I', text: d.high };
      else if (standard !== 'eucast' && r.cat === 'I' && (r.id === 'ETP' || r.id === 'IPM' || r.id === 'MEM')) r.dose = { kind: 'I', text: `${d.s} (mức I: cân nhắc liều tối đa, truyền kéo dài; hội chẩn truyền nhiễm)` };
      if (r.dose) anyDose = true;
    });
    if (standard === 'eucast' && rep.reported.some((r) => r.cat === 'I')) useFn('eu_I');
    if (anyDose) useFn(standard === 'eucast' ? 'eu_dose' : 'dose_general');
    const ordered = used.filter((k) => k !== 'dose_general' && k !== 'eu_dose').concat(used.includes('dose_general') ? ['dose_general'] : []).concat(used.includes('eu_dose') ? ['eu_dose'] : []);
    rep.footnotes = ordered.map((k, i) => ({ n: i + 1, key: k, text: FN[k][0], ref: FN[k][1] }));
    const nOf = (k) => { const f = rep.footnotes.find((x) => x.key === k); return f ? f.n : null; };
    rep.reported.forEach((r) => { r.fnNums = (r.fnKeys || []).map(nOf).filter(Boolean); if (r.dose) r.fnNums.push(nOf(standard === 'eucast' ? 'eu_dose' : 'dose_general')); r.fnNums = [...new Set(r.fnNums)].sort((a, b) => a - b); });
    rep.notes.forEach((n) => { if (n.fn) n.fnNum = nOf(n.fn); });
    rep.rows = rows.map((r) => ({ id: r.id, name: r.name, micText: r.micText, cat: r.cat, intrinsic: !!r.intrinsic }));
    if (standard === 'eucast') rep.notes.push({ level: 'info', text: 'Đang diễn giải theo EUCAST v16.0. Phần kiểm tra bất thường (Appendix A, Appendix B kháng tự nhiên) vẫn dùng dữ liệu CLSI vì chưa nạp EUCAST Expert Rules và Expected Resistant Phenotypes.' });
    rep.supp = standard === 'eucast' ? suppEuFor(org.group) : suppFor(org.group);
    rep.quals = quals;
    rep.cliHold = cliHold;
    rep.clinical = clinicalComments(rep, org, by, quals, spec);
    rep.checks = buildChecks(rep, org, by, quals, mrs, intrinsicIds, cliHold, penHold, standard);
    rep.treatment = treatmentInfo(rep, org, by);
    if (standard === 'eucast') {
      const at = EU_ATU[org.group] || {};
      rep.reported.forEach((r) => { if (at[r.id] != null && r.mic === at[r.id] && r.op === '=') r.atu = at[r.id]; });
      rep.reported.filter((r) => r.atu != null).forEach((r) => rep.checks.push({ id: 'atu:' + r.id, sev: 'review', block: false, drugs: [r.id],
        title: `${r.name}: MIC ${r.micText} nằm trong vùng bất định kỹ thuật (ATU) của EUCAST`,
        why: 'EUCAST đặt ATU cho tổ hợp thuốc–vi khuẩn mà kết quả có thể không chắc chắn do lỗi kỹ thuật. Có thể hạ mức (S→I, I→R, S→R) kèm ghi chú nếu còn thuốc thay thế và giữ chủng để thử lại; hoặc báo kèm giải thích về độ không chắc chắn. Không báo S khi chưa xác nhận.',
        ref: 'EUCAST v16.0, trang "How to handle technical uncertainty" (tr. 14)', action: 'Lặp lại thử nghiệm hoặc dùng phương pháp khác; nếu vẫn trong ATU thì hạ mức hoặc ghi chú trên phiếu.' }));
      rep.reported.filter((r) => r.atu != null).forEach((r) => rep.clinical.push({ level: 'warn', text: `${r.name}: MIC ${r.micText} nằm trong vùng bất định kỹ thuật (ATU) của EUCAST; kết quả có thể không chắc chắn.` }));
    }
    return rep;
  }

  /* ------------------------------------------------------------------ */
  /* 8. Plain-text / CSV exports                                          */
  /* ------------------------------------------------------------------ */
  function compareStandards(iso, settingsIn, opts) {
    const a = buildReport(iso, Object.assign({}, settingsIn, { standard: 'clsi' }), opts);
    const b = buildReport(iso, Object.assign({}, settingsIn, { standard: 'eucast' }), opts);
    if (a.unsupported || b.unsupported) return [];
    const ids = [];
    a.rows.concat(b.rows).forEach((r) => { if (!ids.includes(r.id)) ids.push(r.id); });
    const sa = {}, sb = {};
    a.rows.forEach((r) => (sa[r.id] = r)); b.rows.forEach((r) => (sb[r.id] = r));
    const R_ = (c) => c === 'R';
    const out = [];
    ids.forEach((id) => {
      const x = sa[id], y = sb[id];
      const ca = x && x.cat, cb = y && y.cat;
      if (!ca && !cb) return;
      let diff = null;
      if (ca && cb) {
        if (R_(ca) !== R_(cb)) diff = 'major';
        else if ((ca === 'S') !== (cb === 'S') && !R_(ca)) diff = 'minor';
      } else diff = 'one';
      out.push({ id, name: (x || y).name, micText: (x || y).micText, clsi: ca || null, eucast: cb || null, diff });
    });
    return out;
  }
  function specLabel(v) { const s = SPECIMENS.find((x) => x.v === v); return s ? s.t : v; }

  function reportToText(iso, rep, opts) {
    const showMic = !(opts && opts.showMic === false);
    const L = [];
    L.push('BỆNH VIỆN ĐA KHOA LÃNH BINH THĂNG');
    L.push('KẾT QUẢ KHÁNG SINH ĐỒ');
    L.push(`Bệnh nhân: ${iso.patientName || '-'}   Mã BN: ${iso.patientId || '-'}`);
    L.push(`Vi khuẩn: ${iso.organism || '-'}   Bệnh phẩm: ${specLabel(rep.spec)}`);
    L.push('');
    if (rep.unsupported) { L.push('(Chưa có quy tắc CLSI cho vi khuẩn này – kết quả Vitek nguyên trạng)'); (rep.raw || []).forEach((r) => L.push([r.name, r.mic, r.vitek].join('\t'))); return L.join('\n'); }
    L.push((showMic ? ['Kháng sinh', 'MIC (µg/mL)', 'Kết quả'] : ['Kháng sinh', 'Kết quả']).join('\t'));
    rep.reported.forEach((r) => { const fm = r.fnNums && r.fnNums.length && !(opts && opts.showFn === false) ? ' [' + r.fnNums.join(',') + ']' : ''; L.push((showMic ? [r.name + fm, r.micText, r.cat] : [r.name + fm, r.cat]).join('\t')); });
    if (rep.clinical && rep.clinical.length) { L.push(''); L.push('Lưu ý:'); rep.clinical.forEach((n) => L.push(`- ${n.text}`)); }
    if (!(opts && opts.showFn === false) && rep.footnotes && rep.footnotes.length) { L.push(''); L.push('Chú thích CLSI:'); rep.footnotes.forEach((f) => L.push(`${f.n}. ${f.text} (${f.ref})`)); }
    L.push('');
    L.push((rep.standard === 'eucast' ? 'S = nhạy (liều chuẩn); I = nhạy, tăng phơi nhiễm; R = kháng. Diễn giải theo ' : 'S = nhạy; I = trung gian; SDD = nhạy phụ thuộc liều; R = kháng; NS = không nhạy. Diễn giải theo ') + (rep.standardLabel || EDITION) + '.');
    return L.join('\n');
  }

  function reportToCsv(iso, rep) {
    const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const head = ['patient_id', 'lab_id', 'organism', 'specimen', 'agent', 'mic', 'clsi_category', 'vitek_interp', 'tier', 'reported', 'reason'];
    const rows = [head];
    const base = [iso.patientId, iso.labId, iso.organism, specLabel(rep.spec)];
    rep.reported.forEach((r) => rows.push([...base, r.name, r.micText, r.cat, r.vitek, r.tier, 'yes', r.intrinsic ? 'intrinsic resistance' : r.why || '']));
    rep.hidden.forEach((h) => rows.push([...base, h.name, h.micText, h.cat || '', h.vitek, h.tier == null ? '' : h.tier, 'no', h.reason]));
    return '\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  }

  const api = { COVERAGE, compareStandards, catLabel, EUCAST_EDITION, suggestGroups, GROUP_LIST, TIER_TEXT, HIDE_INFO, EDITION, DRUGS, GROUPS, FN, CAT_VI, SPECIMENS, DEFAULT_SETTINGS, parseVitekText, classifyOrganism, classify, catOf, bpText, buildReport, reportToText, reportToCsv, guessSpecimen, specLabel, drugName, fmtMic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ASTEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
