import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COST_COLUMNS, blankState, parseCsv, mergeCosts, validateCost, validateUsage, validateBackup, summarize, simulate } from '../../tools/finance/model.mjs';

const cost = { id: 'bill-1', month: '2026-09', provider: 'Test', category: 'voice', kind: 'variable', amount: 10, currency: 'USD', eur_rate: 0.9, note: '' };
test('CSV handles French numbers, BOM, quoted delimiters and multiline notes', () => {
  const [row] = parseCsv('\uFEFF' + COST_COLUMNS.join(';') + '\r\nx;2026-09;"Test; fournisseur";voice;variable;12,50;USD;0,9;"deux\nlignes"\r\n');
  assert.equal(row.amount, 12.5); assert.equal(row.provider, 'Test; fournisseur'); assert.equal(row.note, 'deux\nlignes');
  assert.equal(parseCsv(COST_COLUMNS.join(',') + '\nx,2026-09,Test,voice,variable,1,EUR,1,"dit ""oui"""')[0].note, 'dit "oui"');
});
test('bad imports fail rather than silently turning unknown costs into zero', () => {
  assert.throws(() => parseCsv('Cost,Currency\n1,USD'), /Format non reconnu/);
  assert.throws(() => parseCsv(COST_COLUMNS.join(';') + '\nx;"2026-09'), /non fermé/);
  for (const amount of ['', '12abc', 'Infinity', null]) assert.throws(() => validateCost({ ...cost, amount }));
  assert.throws(() => validateCost({ ...cost, currency: 'EUR' }), /égal à 1/);
  assert.throws(() => validateCost({ ...cost, month: '2026-13' }), /Mois invalide/);
});
test('imports deduplicate and reject conflicts atomically', () => {
  const initial = [validateCost(cost)];
  const merged = mergeCosts(initial, [cost, cost]);
  assert.equal(merged.skipped, 2); assert.equal(merged.costs.length, 1);
  assert.throws(() => mergeCosts(initial, [{ ...cost, id: 'new' }, { ...cost, amount: 99 }]), /contenu différent/);
  assert.equal(initial.length, 1); assert.equal(initial[0].amount, 10);
});
test('observed totals convert currencies, include credits and isolate months', () => {
  const rows = [cost, { ...cost, id: 'credit', amount: -2 }, { ...cost, id: 'other', month: '2026-08', amount: 900 }];
  const result = summarize(rows, '2026-09', { active: 4 });
  assert.equal(result.total, 7.2); assert.equal(result.perActive, 1.8);
  assert.equal(summarize([], '2026-09', { active: 10 }).total, null);
  assert.equal(summarize(rows, '2026-09', { active: 0 }).perActive, null);
});
test('usage keeps unknown separate from zero and validates subscriber counts', () => {
  assert.equal(validateUsage({ active: '' }).active, null);
  assert.equal(validateUsage({ active: '0' }).active, 0);
  assert.throws(() => validateUsage({ active: 5, paid: 6 }));
  assert.throws(() => validateUsage({ photoScans: 1.5 }));
});
const scenario = { ...blankState().scenario, active: 1000, conversion: 5, monthly: 6, annual: 60, annualShare: 50, vat: 20, commission: 15, fixed: 25, freeCost: 0.05, paidCost: 0.5 };
test('projection accounts for annual monthly recognition, taxes, fees and free users', () => {
  const result = simulate(scenario);
  assert.equal(result.paid, 50); assert.equal(result.free, 950);
  assert.ok(Math.abs(result.netPerPaid - (5.5 / 1.2 * 0.85)) < 1e-10);
  assert.equal(result.expenses, 97.5);
  const equilibrium = simulate({ ...scenario, conversion: result.breakEven });
  assert.ok(Math.abs(equilibrium.result) < 1e-8);
});
test('missing estimates, unprofitable plans and zero revenue are explicit', () => {
  assert.throws(() => simulate(blankState().scenario), /manquante/);
  assert.equal(simulate({ ...scenario, paidCost: 100 }).breakEven, null);
  assert.equal(simulate({ ...scenario, conversion: 0 }).margin, null);
  assert.throws(() => simulate({ ...scenario, active: 0 }));
});
test('backup round trip validates financial records and excludes unknown properties', () => {
  const state = { ...blankState(), costs: [cost], usage: { '2026-09': { active: 10 } }, unexpected: 'ignored' };
  const restored = validateBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.costs[0].amount, 10); assert.equal(restored.unexpected, undefined);
  assert.equal(restored.scenario.fixed, '');
  assert.throws(() => validateBackup({ ...state, costs: [{ ...cost, amount: 'bad' }] }));
});
