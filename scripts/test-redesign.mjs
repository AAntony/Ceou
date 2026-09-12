import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { rankResults } from '../src/features/search/rank.ts';
import { wordCount } from '../src/lib/text/words.ts';

test('voice commands count whitespace, not the letter s', () => {
  assert.equal(wordCount('où ai je rangé mon vélo'), 6);
  assert.equal(wordCount('mes chaussures'), 2);
  assert.equal(wordCount('  clés\tdu\n garage  '), 3);
  assert.equal(wordCount('  '), 0);
});

const item = (id, name, extra = {}) => ({ id, name, kind: 'objet', habitation_id: 'home-a', habitation_name: 'Maison', piece_id: 'room-a', piece_name: 'Cuisine', parent_label: 'Tiroir', ...extra });

test('empty search lists objects, with natural sorting and no source mutation', () => {
  const source = [item('10', 'Boîte 10'), item('2', 'Boîte 2'), item('room', 'Cuisine', { kind: 'piece' })];
  const before = structuredClone(source);
  assert.deepEqual(rankResults(source, '', null, null).map((entry) => entry.id), ['2', '10']);
  assert.deepEqual(source, before);
});

test('accent-insensitive exact names precede partial matches', () => {
  const source = [item('b', 'Double des clés'), item('a', 'Clés')];
  assert.deepEqual(rankResults(source, 'cles', null, null).map((entry) => entry.id), ['a', 'b']);
});

test('multi-word matches precede partial matches and use the location context', () => {
  const source = [item('a', 'Coussin rouge'), item('b', 'Coussin bleu'), item('c', 'Boîte bleue')];
  assert.equal(rankResults(source, 'un coussin bleu', null, null)[0].id, 'b');
  assert.equal(rankResults(source, 'coussin cuisine', null, null).length, 2);
});

test('identically named rooms remain separate through their IDs', () => {
  const source = [item('a', 'Clés'), item('b', 'Clés', { piece_id: 'room-b', habitation_id: 'home-b' })];
  assert.deepEqual(rankResults(source, 'clés', null, 'room-b').map((entry) => entry.id), ['b']);
  assert.deepEqual(rankResults(source, '', 'home-a', null).map((entry) => entry.id), ['a']);
  assert.equal(rankResults(source, '', 'home-a', 'room-b').length, 0);
});

test('a search can find a room or storage location; unmatched searches stay empty', () => {
  const source = [item('a', 'Placard', { kind: 'emplacement' }), item('b', 'Clés')];
  assert.equal(rankResults(source, 'placard', null, null)[0].kind, 'emplacement');
  assert.equal(rankResults(source, 'zzzx', null, null).length, 0);
});

const css = readFileSync(new URL('../global.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const parse = (text) => Object.fromEntries([...text.matchAll(/--color-([\w-]+):\s*(\d+) (\d+) (\d+);/g)].map((m) => [m[1], m.slice(2).map(Number)]));
const [lightSource, darkSource] = css.split('.dark:root');
const light = parse(lightSource);
const dark = { ...light, ...parse(darkSource) };
const luminance = (rgb) => rgb.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

for (const [mode, colors] of [['light', light], ['dark', dark]]) {
  test(`${mode}: semantic small text and primary button meet 4.5:1`, () => {
    for (const pair of [['ink', 'sand'], ['ink-soft', 'surface'], ['ink-faint', 'surface'], ['coral-dark', 'coral-light'], ['teal-dark', 'teal-light'], ['mustard-dark', 'mustard-light'], ['sky-dark', 'sky-light']]) {
      assert.ok(contrast(colors[pair[0]], colors[pair[1]]) >= 4.5, `${pair.join('/')} fails contrast`);
    }
    assert.ok(contrast([255, 255, 255], colors.coral) >= 4.5);
    assert.ok(contrast([255, 255, 255], [185, 28, 28]) >= 4.5);
  });
}

test('new interface copy is present in both languages', () => {
  const fr = JSON.parse(readFileSync(new URL('../src/lib/i18n/locales/fr.json', import.meta.url), 'utf8')).redesign;
  const en = JSON.parse(readFileSync(new URL('../src/lib/i18n/locales/en.json', import.meta.url), 'utf8')).redesign;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  assert.ok(Object.values(fr).every(Boolean) && Object.values(en).every(Boolean));
});
