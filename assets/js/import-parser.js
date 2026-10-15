(function (g) {
  'use strict';

  const CFG = g.TF_CONFIG || {};
  const MAX_BYTES = (CFG.MAX_UPLOAD_MB || 10) * 1024 * 1024;
  const MAX_QUESTIONS = CFG.MAX_QUESTIONS || 2000;
  const MAX_ROWS = 6000;
  const MAX_OPTIONS = 10;
  const EXTS = ['xlsx', 'xls', 'csv', 'docx', 'txt'];

  class ImportError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'ImportError';
      this.code = code || 'IMPORT';
    }
  }

  const ext = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
  const formatSize = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB');

  function cell(v) {
    if (v === null || v === undefined) return '';
    let s = String(v).replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n');
    s = s
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return s;
  }

  async function sniff(file) {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05);
    const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
    const hasNul = head.includes(0) && !(head[0] === 0xff && head[1] === 0xfe) && !(head[0] === 0xfe && head[1] === 0xff);
    return { isZip, isOle, hasNul };
  }

  async function validateFile(file) {
    if (!file) throw new ImportError('Fayl tanlanmagan.', 'NO_FILE');
    const e = ext(file.name);
    if (!EXTS.includes(e)) throw new ImportError(`“.${e || '?'}” formati qo‘llab-quvvatlanmaydi. Ruxsat etilgan: ${EXTS.map((x) => '.' + x).join(', ')}.`, 'BAD_EXT');
    if (file.size === 0) throw new ImportError('Fayl bo‘sh.', 'EMPTY');
    if (file.size > MAX_BYTES) throw new ImportError(`Fayl hajmi (${formatSize(file.size)}) ruxsat etilgan ${formatSize(MAX_BYTES)} dan katta.`, 'TOO_BIG');
    const s = await sniff(file);
    if ((e === 'xlsx' || e === 'docx') && !s.isZip) throw new ImportError(`Fayl haqiqiy .${e} emas (kontent formati mos kelmadi). Fayl shikastlangan yoki kengaytmasi o‘zgartirilgan.`, 'BAD_CONTENT');
    if (e === 'xls' && !s.isOle && !s.isZip) throw new ImportError('Fayl haqiqiy .xls emas (kontent formati mos kelmadi).', 'BAD_CONTENT');
    if ((e === 'csv' || e === 'txt') && (s.isZip || s.isOle || s.hasNul)) throw new ImportError(`Bu fayl matnli .${e} emas, ikkilik fayl ko‘rinadi. To‘g‘ri formatni tanlang.`, 'BAD_CONTENT');
    return e;
  }

  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 25);
    if (!lines.length) return ',';
    for (const d of ['\t', ';', '|', ',']) {
      if (lines.filter((l) => l.includes(d)).length / lines.length >= 0.6) return d;
    }
    return ',';
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else inQ = false;
        } else field += ch;
      } else if (ch === '"' && field === '') inQ = true;
      else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        if (rows.length > MAX_ROWS) throw new ImportError(`Fayl juda ko‘p qatorga ega (${MAX_ROWS} dan ortiq).`, 'TOO_MANY_ROWS');
      } else field += ch;
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  async function decodeText(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let enc = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) enc = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) enc = 'utf-16be';
    try {
      return { text: new TextDecoder(enc, { fatal: true }).decode(buf).replace(/^\uFEFF/, ''), warning: null };
    } catch (e) {
      return { text: new TextDecoder('windows-1251').decode(buf), warning: 'Fayl UTF-8 emas — windows-1251 kodirovkasi sifatida o‘qildi. Matnni tekshiring.' };
    }
  }

  function textSources(text, label) {
    const clean = text.replace(/^\uFEFF/, '');
    const rows = parseDelimited(clean, detectDelimiter(clean)).map((r) => r.map(cell));
    return [{ id: 's0', label, rows: rows.filter((r) => r.some(Boolean)) }];
  }

  function parseWorkbook(buffer) {
    if (typeof XLSX === 'undefined') throw new ImportError('Excel kutubxonasi (SheetJS) yuklanmadi. Internet aloqasini tekshiring.', 'LIB');
    let wb;
    try {
      wb = XLSX.read(buffer, { type: 'array', sheetRows: MAX_ROWS + 1 });
    } catch (e) {
      throw new ImportError('Excel faylini o‘qib bo‘lmadi. Fayl shikastlangan bo‘lishi mumkin.', 'CORRUPT');
    }
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) throw new ImportError('Faylda varaqlar topilmadi.', 'EMPTY');
    const out = [];
    wb.SheetNames.forEach((name, i) => {
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false, raw: false });
      if (raw.length > MAX_ROWS) throw new ImportError(`“${name}” varag‘ida ${MAX_ROWS} dan ortiq qator bor.`, 'TOO_MANY_ROWS');
      const rows = raw.map((r) => r.map(cell)).filter((r) => r.some(Boolean));
      if (rows.length) out.push({ id: 's' + i, label: name, rows });
    });
    return out;
  }

  async function parseDocx(buffer) {
    if (typeof mammoth === 'undefined') throw new ImportError('Word kutubxonasi (Mammoth) yuklanmadi. Internet aloqasini tekshiring.', 'LIB');
    let html;
    try {
      html = (await mammoth.convertToHtml({ arrayBuffer: buffer })).value;
    } catch (e) {
      throw new ImportError('DOCX faylini o‘qib bo‘lmadi. Fayl shikastlangan yoki haqiqiy Word hujjati emas.', 'CORRUPT');
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));
    const sources = [];
    tables.forEach((t, i) => {
      const rows = Array.from(t.querySelectorAll('tr'))
        .map((tr) =>
          Array.from(tr.children)
            .filter((c) => /^t[dh]$/i.test(c.tagName))
            .map((c) => {
              const paras = Array.from(c.querySelectorAll('p')).map((p) => cell(p.textContent)).filter(Boolean);
              return paras.length ? paras.join('\n') : cell(c.textContent);
            })
        )
        .filter((r) => r.some(Boolean));
      if (rows.length > MAX_ROWS) throw new ImportError(`Jadvalda ${MAX_ROWS} dan ortiq qator bor.`, 'TOO_MANY_ROWS');
      if (rows.length) sources.push({ id: 't' + i, label: `Jadval ${i + 1}`, rows });
    });
    if (sources.length) return { sources, warning: null };
    let raw = '';
    try {
      raw = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
    } catch (e) {
      raw = '';
    }
    if (raw.trim()) {
      const alt = textSources(raw, 'Matn (ajratuvchi bo‘yicha)');
      const rows = alt[0].rows;
      const wide = rows.filter((r) => r.filter(Boolean).length >= 3).length;
      if (rows.length && wide / rows.length >= 0.6) {
        return { sources: alt, warning: 'DOCX faylida jadval topilmadi. Matn ajratuvchi belgilar bo‘yicha taxminan ajratildi — natijani diqqat bilan tekshiring.' };
      }
    }
    throw new ImportError('DOCX faylidan savollar tuzilmasi aniqlanmadi. Savollarni jadval ko‘rinishida (Savol | To‘g‘ri javob | Xato javoblar) joylashtiring yoki .xlsx/.csv shablonidan foydalaning.', 'NO_STRUCTURE');
  }

  async function readFile(file) {
    const e = await validateFile(file);
    let sources;
    let warning = null;
    if (e === 'xlsx' || e === 'xls') sources = parseWorkbook(await file.arrayBuffer());
    else if (e === 'docx') {
      const r = await parseDocx(await file.arrayBuffer());
      sources = r.sources;
      warning = r.warning;
    } else {
      const d = await decodeText(file);
      warning = d.warning;
      sources = textSources(d.text, e === 'csv' ? 'CSV' : 'TXT');
    }
    sources = sources.filter((s) => s.rows.length);
    if (!sources.length) throw new ImportError('Faylda ma’lumot topilmadi.', 'EMPTY');
    sources.forEach((s) => {
      s.cols = Math.min(30, Math.max(...s.rows.slice(0, 80).map((r) => r.length)));
    });
    return { format: e, sources, warning };
  }

  function looksLikeHeader(row) {
    const a = (row[0] || '').toLowerCase();
    const b = (row[1] || '').toLowerCase();
    return /^(№|#|t\/r|savol(lar)?|question|questions|вопрос|вопросы)$/.test(a) || /^(to['‘’ʻʼ`]?g['‘’ʻʼ`]?ri( javob)?|correct( answer)?|правильный( ответ)?)$/.test(b);
  }

  function guessMapping(source) {
    const w = [];
    for (let i = 2; i < source.cols; i++) w.push(i);
    return { q: 0, c: Math.min(1, source.cols - 1), w, header: looksLikeHeader(source.rows[0] || []) };
  }

  function norm(s) {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function buildQuestions(sources, mapping) {
    const questions = [];
    const skipped = [];
    const stats = { rows: 0, empty: 0, valid: 0, invalid: 0, duplicates: 0 };
    const seen = new Map();
    const warnings = [];
    let truncated = false;
    sources.forEach((src) => {
      src.rows.forEach((row, idx) => {
        if (idx === 0 && mapping.header) return;
        const at = `${src.label}, ${idx + 1}-qator`;
        if (!row.some(Boolean)) {
          stats.empty++;
          return;
        }
        stats.rows++;
        const question = row[mapping.q] || '';
        const correct = row[mapping.c] || '';
        const reasons = [];
        if (!question) reasons.push('savol matni bo‘sh');
        if (!correct) reasons.push('to‘g‘ri javob bo‘sh');
        const wrong = [];
        const used = new Set([norm(correct)]);
        mapping.w.forEach((ci) => {
          const v = row[ci] || '';
          if (!v) return;
          const k = norm(v);
          if (used.has(k)) return;
          used.add(k);
          wrong.push(v);
        });
        if (!wrong.length && question && correct) reasons.push('xato javoblar yo‘q');
        if (question.length > 2000) reasons.push('savol matni 2000 belgidan uzun');
        if ([correct, ...wrong].some((o) => o.length > 1000)) reasons.push('javob matni 1000 belgidan uzun');
        if (reasons.length) {
          stats.invalid++;
          skipped.push({ at, reason: reasons.join(', ') });
          return;
        }
        if (questions.length >= MAX_QUESTIONS) {
          truncated = true;
          return;
        }
        const options = [{ text: correct, is_correct: true }, ...wrong.slice(0, MAX_OPTIONS - 1).map((t) => ({ text: t, is_correct: false }))];
        if (wrong.length > MAX_OPTIONS - 1) warnings.push(`${at}: faqat dastlabki ${MAX_OPTIONS - 1} ta xato javob olindi.`);
        const key = norm(question);
        const dup = seen.has(key);
        if (dup) stats.duplicates++;
        else seen.set(key, true);
        stats.valid++;
        questions.push({ question, explanation: '', options, duplicate: dup, source: at });
      });
    });
    if (truncated) warnings.push(`Savollar soni ${MAX_QUESTIONS} tadan oshdi — faqat birinchi ${MAX_QUESTIONS} tasi olindi.`);
    return { questions, skipped, stats, warnings };
  }

  g.ImportParser = { readFile, buildQuestions, guessMapping, looksLikeHeader, parseDelimited, detectDelimiter, validateFile, formatSize, ImportError, MAX_QUESTIONS, MAX_BYTES };
})(typeof window !== 'undefined' ? window : globalThis);
