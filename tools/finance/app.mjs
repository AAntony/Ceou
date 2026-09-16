import { CATEGORIES, COST_COLUMNS, USAGE_FIELDS, blankState, monthKey, parseCsv, validateCost, validateUsage, validateBackup, mergeCosts, summarize, simulate } from './model.mjs';

const $ = selector => document.querySelector(selector);
const storageKey = 'ceou-finance-v1';
const money = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
const count = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const monthLabel = month => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const empty = (title, message) => `<div class="empty"><span class="empty-mark" aria-hidden="true">◌</span><strong>${escape(title)}</strong>${escape(message)}</div>`;
const pair = (name, value) => `<div><dt>${escape(name)}</dt><dd>${escape(value)}</dd></div>`;
let state = blankState();
let storageBlocked = false;
function status(message, isError = false) { $('#status').textContent = message; $('#status').classList.toggle('error', isError); }
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) state = validateBackup(JSON.parse(saved));
} catch {
  storageBlocked = true;
  status('Le stockage local est indisponible ou sa sauvegarde est invalide. Les données existantes ne seront pas écrasées. Tu peux travailler puis télécharger une sauvegarde.', true);
}
function persist(next) {
  if (storageBlocked) throw new Error('Stockage indisponible : télécharge une sauvegarde de la session avec le bouton en haut.');
  try { localStorage.setItem(storageKey, JSON.stringify(next)); }
  catch { throw new Error('Enregistrement impossible : stockage local plein ou désactivé. Télécharge une sauvegarde avant de fermer.'); }
}
function save(next, message) {
  try { persist(next); state = next; status(message); }
  catch (error) { state = next; status(`${error.message} La modification reste seulement en mémoire.`, true); }
}
const now = new Date();
$('#month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
$('#category').innerHTML = Object.entries(CATEGORIES).map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
function fillForm(form, data) {
  for (const [name, value] of Object.entries(data)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value ?? '';
}
function formData(form) { return Object.fromEntries(new FormData(form)); }
function renderUsageForm() {
  const data = state.usage[$('#month').value] ?? {};
  fillForm($('#usage-form'), Object.fromEntries(USAGE_FIELDS.map(key => [key, data[key] ?? ''])));
}
function renderObserved() {
  const month = $('#month').value;
  if (!month) return;
  const usage = state.usage[month] ?? {};
  const summary = summarize(state.costs, month, usage);
  $('#total').textContent = money(summary.total);
  $('#per-user').textContent = money(summary.perActive);
  $('#active-count').textContent = count(usage.active);
  $('#paid-count').textContent = usage.paid == null ? 'Abonnés actifs non renseignés' : `${count(usage.paid)} abonnés actifs renseignés`;
  const aiRows = summary.rows.filter(row => ['voice', 'photo', 'ai'].includes(row.category));
  $('#ai-total').textContent = aiRows.length ? money(aiRows.reduce((sum, row) => sum + row.amount * row.eur_rate, 0)) : '—';
  $('#coverage').textContent = summary.rows.length
    ? `${monthLabel(month)} · ${summary.rows.length} poste(s) renseigné(s). Total partiel tant que toutes les factures et répartitions ne sont pas saisies. Aucun rapprochement automatique.`
    : `${monthLabel(month)} · En attente de tes premières données. Aucune dépense n’a encore été saisie ; cela ne signifie pas que le service est gratuit.`;
  const groups = Object.entries(summary.groups).sort((a, b) => b[1] - a[1]);
  const maximum = Math.max(1, ...groups.map(([, value]) => Math.abs(value)));
  $('#breakdown').innerHTML = groups.length ? groups.map(([key, value]) => `<div class="bar-row"><div class="bar-label"><span>${CATEGORIES[key]}</span><strong class="${value < 0 ? 'negative' : ''}">${money(value)}</strong></div><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.abs(value) / maximum * 100}%"></div></div></div>`).join('') : empty('Tes premiers chiffres arrivent ici.', 'Ajoute une facture pour voir la répartition du budget.');
  $('#observations').innerHTML = pair('Charges fixes renseignées', summary.rows.some(row => row.kind === 'fixed') ? money(summary.fixed) : '—')
    + pair('Charges variables renseignées', summary.rows.some(row => row.kind === 'variable') ? money(summary.variable) : '—')
    + pair('Minutes vocales déclarées', count(usage.voiceMinutes)) + pair('Analyses photo', count(usage.photoScans));
  const months = [...new Set(state.costs.map(row => row.month))].sort().reverse();
  $('#history').innerHTML = months.length ? `<table><thead><tr><th>Mois</th><th>Dépenses HT</th><th>Actifs renseignés</th><th>Coût / actif</th></tr></thead><tbody>${months.map(key => {
    const record = summarize(state.costs, key, state.usage[key]);
    return `<tr><td>${escape(monthLabel(key))}</td><td>${money(record.total)}</td><td>${count(state.usage[key]?.active)}</td><td>${money(record.perActive)}</td></tr>`;
  }).join('')}</tbody></table>` : empty('Pas encore d’historique.', 'Chaque mois renseigné restera disponible ici.');
  $('#ledger').innerHTML = summary.rows.length ? `<table><thead><tr><th>Fournisseur / référence</th><th>Poste</th><th>Montant d’origine</th><th>Euros HT</th><th>Action</th></tr></thead><tbody>${summary.rows.map(row => `<tr><td>${escape(row.provider)}<small>${escape(row.id)}</small><small>${escape(row.note)}</small></td><td>${CATEGORIES[row.category]}<small>${row.kind === 'fixed' ? 'Fixe' : 'Variable'}</small></td><td>${count(row.amount)} ${row.currency}<small>Taux EUR : ${count(row.eur_rate)}</small></td><td class="money">${money(row.amount * row.eur_rate)}</td><td><button class="delete" data-remove="${escape(row.id)}" aria-label="Retirer ${escape(row.id)}">Retirer</button></td></tr>`).join('')}</tbody></table>` : empty('Le journal est vide pour ce mois.', 'Les dépenses saisies ou importées apparaîtront ici.');
}
function renderScenario() {
  const raw = formData($('#scenario-form'));
  try {
    const result = simulate(raw);
    $('#scenario-result').textContent = money(result.result);
    $('#scenario-note').textContent = result.result >= 0 ? 'Solde positif dans ce scénario, avant les dépenses non renseignées.' : 'Ce scénario ne couvre pas les coûts renseignés.';
    $('#scenario-details').innerHTML = pair('Abonnés projetés (moyenne)', count(result.paid)) + pair('Recette nette / abonné / mois', money(result.netPerPaid)) + pair('Recettes nettes projetées', money(result.revenue)) + pair('Coûts projetés', money(result.expenses)) + pair('Conversion à l’équilibre', result.breakEven === null ? 'Inatteignable avec ces hypothèses' : `${count(result.breakEven)} %`) + pair('Solde / recettes nettes', result.margin === null ? '—' : `${count(result.margin)} %`);
    $('#sensitivity').innerHTML = `<table><thead><tr><th>Conversion</th><th>Abonnés</th><th>Solde / mois</th></tr></thead><tbody>${[2, 5, 10].map(conversion => {
      const r = simulate({ ...raw, conversion });
      return `<tr><td>${conversion} %</td><td>${count(r.paid)}</td><td class="money ${r.result < 0 ? 'negative' : 'positive'}">${money(r.result)}</td></tr>`;
    }).join('')}</tbody></table>`;
  } catch {
    $('#scenario-result').textContent = '—';
    $('#scenario-note').textContent = 'Complète les champs avec des valeurs valides. Les coûts inconnus ne sont pas remplacés par zéro.';
    $('#scenario-details').innerHTML = '';
    $('#sensitivity').innerHTML = empty('À toi de poser les hypothèses.', 'Le seuil de rentabilité apparaîtra après saisie des coûts.');
  }
}
function showPage(page) {
  if (!['overview', 'costs', 'simulation', 'guide'].includes(page)) return;
  document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
  document.querySelectorAll('nav [data-page]').forEach(button => {
    if (button.dataset.page === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  const heading = $(`#${page} h1`); heading.tabIndex = -1; heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
$('#month').addEventListener('change', () => { renderUsageForm(); renderObserved(); });
$('#usage-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const usage = validateUsage(formData(event.currentTarget));
    const month = monthKey($('#month').value);
    save({ ...state, usage: { ...state.usage, [month]: usage } }, 'Usages enregistrés pour le mois sélectionné.'); renderObserved();
  } catch (error) { status(error.message, true); }
});
$('#cost-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const row = validateCost({ ...formData(event.currentTarget), month: $('#month').value });
    const result = mergeCosts(state.costs, [row]);
    save({ ...state, costs: result.costs }, result.added ? 'Dépense ajoutée.' : 'Cette référence est déjà présente : aucun doublon ajouté.');
    event.currentTarget.reset(); renderObserved();
  } catch (error) { status(error.message, true); }
});
$('#cost-form [name="currency"]').addEventListener('change', event => {
  $('#cost-form [name="eur_rate"]').value = event.target.value === 'EUR' ? '1' : '';
});
$('#ledger').addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button || !window.confirm(`Retirer la dépense « ${button.dataset.remove} » du tableau de bord ?`)) return;
  save({ ...state, costs: state.costs.filter(row => row.id !== button.dataset.remove) }, 'Dépense retirée.'); renderObserved();
});
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#backup').addEventListener('click', () => download(`ceou-finances-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), 'application/json'));
$('#template').addEventListener('click', () => download('modele-depenses-ceou.csv', '\uFEFF' + COST_COLUMNS.join(';') + '\r\n', 'text/csv;charset=utf-8'));
async function readUpload(input) {
  const file = input.files?.[0];
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error('Fichier trop volumineux : maximum 5 Mo.');
  return file.text();
}
$('#csv').addEventListener('change', async event => {
  const input = event.currentTarget;
  try {
    const text = await readUpload(input); if (text === null) return;
    const rows = parseCsv(text);
    if (rows.length + state.costs.length > 20000) throw new Error('Maximum 20 000 lignes.');
    const result = mergeCosts(state.costs, rows);
    if (!window.confirm(`Importer ${result.added} dépense(s) sur ${new Set(rows.map(row => row.month)).size} mois ? ${result.skipped} doublon(s) seront ignorés. Vérifie que ces lignes ne reprennent pas une facture déjà saisie sous une autre référence.`)) return;
    save({ ...state, costs: result.costs }, `${result.added} dépense(s) importée(s), ${result.skipped} doublon(s) ignoré(s).`); renderObserved();
  } catch (error) { status(error.message, true); }
  finally { input.value = ''; }
});
$('#restore').addEventListener('change', async event => {
  const input = event.currentTarget;
  try {
    const text = await readUpload(input); if (text === null) return;
    const next = validateBackup(JSON.parse(text));
    if (!window.confirm(`Remplacer toutes les données locales par cette sauvegarde (${next.costs.length} dépenses) ? Télécharge d’abord une sauvegarde si nécessaire.`)) return;
    save(next, 'Sauvegarde restaurée.'); renderUsageForm(); fillForm($('#scenario-form'), state.scenario); renderObserved(); renderScenario();
  } catch (error) { status(error.message, true); }
  finally { input.value = ''; }
});
$('#scenario-form').addEventListener('input', renderScenario);
$('#scenario-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const scenario = formData(event.currentTarget); simulate(scenario);
    save({ ...state, scenario }, 'Hypothèses enregistrées. Elles ne modifient pas les dépenses observées.'); renderScenario();
  } catch (error) { status(error.message, true); }
});
fillForm($('#scenario-form'), state.scenario); renderUsageForm(); renderObserved(); renderScenario();
