export const CATEGORIES = {
  voice: 'IA · voix', photo: 'IA · photos', ai: 'IA · autres',
  hosting: 'Hébergement', storage: 'Stockage', network: 'Transferts', tools: 'Outils', other: 'Autres',
};
export const COST_COLUMNS = ['id', 'month', 'provider', 'category', 'kind', 'amount', 'currency', 'eur_rate', 'note'];
export const USAGE_FIELDS = ['active', 'paid', 'voiceMinutes', 'photoScans'];
export const DEFAULT_SCENARIO = {
  active: 1000, conversion: 5, monthly: 4.99, annual: 39.99, annualShare: 50,
  vat: 20, commission: 15, fixed: '', freeCost: '', paidCost: '',
};
export function blankState() {
  return { version: 1, costs: [], usage: {}, scenario: { ...DEFAULT_SCENARIO } };
}
export function number(value, label, min = 0, max = 1e12) {
  if (value === null || value === undefined || String(value).trim() === '') throw new Error(`${label} : valeur manquante.`);
  const text = String(value).trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error(`${label} : nombre invalide.`);
  const result = Number(text);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${label} : valeur hors limites (${min} à ${max}).`);
  return result;
}
function label(value, name, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} : texte requis (maximum ${max} caractères).`);
  return value.trim();
}
export function monthKey(value) {
  if (typeof value !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Mois invalide : utiliser AAAA-MM.');
  return value;
}
export function validateCost(row) {
  const category = label(row.category, 'Catégorie');
  if (!Object.hasOwn(CATEGORIES, category)) throw new Error(`Catégorie inconnue : ${category}.`);
  if (!['fixed', 'variable'].includes(row.kind)) throw new Error('Nature : fixed ou variable.');
  if (!['EUR', 'USD', 'GBP'].includes(row.currency)) throw new Error('Devise : EUR, USD ou GBP.');
  const rate = number(row.eur_rate, 'Taux en euros', 0.000001, 10000);
  if (row.currency === 'EUR' && rate !== 1) throw new Error('Le taux EUR doit être égal à 1.');
  return {
    id: label(row.id, 'Référence', 250), month: monthKey(row.month), provider: label(row.provider, 'Fournisseur'),
    category, kind: row.kind, amount: number(row.amount, 'Montant', -1e8, 1e8), currency: row.currency,
    eur_rate: rate, note: typeof row.note === 'string' ? row.note.slice(0, 2000) : '',
  };
}
// CSV RFC-style quoting, UTF-8 BOM, CRLF and French semicolon exports.
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = ''; closed = false;
    } else {
      if (closed || char === '"') throw new Error('CSV invalide : guillemets ou séparateur.');
      cell += char;
    }
  }
  if (quoted) throw new Error('CSV invalide : guillemet non fermé.');
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('Le fichier doit contenir un en-tête et au moins une dépense.');
  const header = rows.shift().map(value => value.trim());
  if (header.length !== COST_COLUMNS.length || COST_COLUMNS.some(key => !header.includes(key))) {
    throw new Error('Format non reconnu. Utilise le modèle CSV Céoù ; les exports fournisseurs bruts et les PDF doivent être reportés dans ce modèle ou saisis manuellement.');
  }
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`Ligne ${index + 2} : nombre de colonnes incorrect.`);
    try { return validateCost(Object.fromEntries(header.map((key, i) => [key, values[i]]))); }
    catch (error) { throw new Error(`Ligne ${index + 2} : ${error.message}`); }
  });
}
export function mergeCosts(existing, incoming) {
  const byId = new Map(existing.map(row => [row.id, row]));
  let added = 0, skipped = 0;
  for (const input of incoming) {
    const row = validateCost(input);
    const previous = byId.get(row.id);
    if (previous) {
      if (JSON.stringify(validateCost(previous)) !== JSON.stringify(row)) throw new Error(`Référence ${row.id} déjà présente avec un contenu différent. Retire l'ancienne ligne avant de la remplacer.`);
      skipped++; continue;
    }
    byId.set(row.id, row); added++;
  }
  return { costs: [...byId.values()], added, skipped };
}
export function validateUsage(raw) {
  const result = {};
  for (const key of USAGE_FIELDS) {
    const value = raw[key];
    result[key] = value === '' || value === null || value === undefined ? null : number(value, key, 0, 1e9);
    if (key !== 'voiceMinutes' && result[key] !== null && !Number.isInteger(result[key])) throw new Error(`${key} : nombre entier requis.`);
  }
  if (result.paid !== null && result.active !== null && result.paid > result.active) throw new Error('Les abonnés actifs ne peuvent pas dépasser le total des utilisateurs actifs.');
  return result;
}
export function summarize(costs, month, usage = {}) {
  const rows = costs.filter(row => row.month === month);
  const groups = {};
  let fixed = 0, variable = 0;
  for (const row of rows) {
    const euros = row.amount * row.eur_rate;
    groups[row.category] = (groups[row.category] ?? 0) + euros;
    if (row.kind === 'fixed') fixed += euros; else variable += euros;
  }
  const total = fixed + variable;
  return { rows, groups, fixed, variable, total: rows.length ? total : null,
    perActive: rows.length && usage.active > 0 ? total / usage.active : null,
  };
}
export function simulate(raw) {
  const p = {};
  for (const key of Object.keys(DEFAULT_SCENARIO)) p[key] = number(raw[key], key, 0, ['conversion', 'annualShare', 'vat', 'commission'].includes(key) ? 100 : 1e9);
  if (!Number.isInteger(p.active) || p.active < 1) throw new Error('Renseigne au moins un utilisateur actif (nombre entier).');
  const annualFraction = p.annualShare / 100;
  const netPerPaid = ((1 - annualFraction) * p.monthly + annualFraction * p.annual / 12) / (1 + p.vat / 100) * (1 - p.commission / 100);
  const paid = p.active * p.conversion / 100, free = p.active - paid;
  const revenue = paid * netPerPaid;
  const expenses = p.fixed + free * p.freeCost + paid * p.paidCost;
  const denominator = netPerPaid - p.paidCost + p.freeCost;
  const breakEvenFraction = denominator > 0 ? (p.fixed / p.active + p.freeCost) / denominator : null;
  return { paid, free, netPerPaid, revenue, expenses, result: revenue - expenses,
    breakEven: breakEvenFraction !== null && breakEvenFraction >= 0 && breakEvenFraction <= 1 ? breakEvenFraction * 100 : null,
    margin: revenue > 0 ? (revenue - expenses) / revenue * 100 : null,
  };
}
export function validateBackup(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.costs) || raw.costs.length > 20000 || !raw.usage || typeof raw.usage !== 'object') throw new Error('Sauvegarde Céoù invalide.');
  const costs = mergeCosts([], raw.costs).costs;
  const usage = Object.fromEntries(Object.entries(raw.usage).map(([month, value]) => [monthKey(month), validateUsage(value)]));
  const scenario = { ...DEFAULT_SCENARIO };
  for (const key of Object.keys(scenario)) {
    const value = raw.scenario?.[key];
    if (value !== undefined) scenario[key] = value === '' ? '' : number(value, key, 0, ['conversion', 'annualShare', 'vat', 'commission'].includes(key) ? 100 : 1e9);
  }
  return { version: 1, costs, usage, scenario };
}
