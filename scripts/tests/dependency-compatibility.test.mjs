import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

test('Metro loads image files through its full Android asset pipeline', async () => {
  const { getAssetData } = require('metro/private/Assets');
  const placeholder = await getAssetData(
    fileURLToPath(new URL('../../assets/placeholder_objet.png', import.meta.url)),
    'assets/placeholder_objet.png', [], 'android', '/assets',
  );
  assert.equal(placeholder.width, 400);
  assert.equal(placeholder.height, 300);
  assert.equal(placeholder.__packager_asset, true);
  const routerAsset = await getAssetData(
    fileURLToPath(new URL('../../node_modules/expo-router/assets/pkg.png', import.meta.url)),
    'node_modules/expo-router/assets/pkg.png', [], 'android', '/assets',
  );
  assert.ok(routerAsset.width > 0 && routerAsset.height > 0);
});

test('Metro can still read asset dimensions through its default CommonJS import', () => {
  const metroRequire = createRequire(require.resolve('metro/package.json'));
  const module = metroRequire('image-size');
  const imageSize = module.__esModule ? module.default : module;
  const dimensions = imageSize(readFileSync(new URL('../../assets/placeholder_objet.png', import.meta.url)));
  assert.equal(dimensions.width, 400); assert.equal(dimensions.height, 300);
});

test('Xcode project IDs keep their expected 24-character format', () => {
  const project = require('xcode').project('test.pbxproj');
  project.hash = { project: { objects: {} } };
  const first = project.generateUuid(), second = project.generateUuid();
  assert.match(first, /^[A-F0-9]{24}$/); assert.notEqual(first, second);
});

test('router query strings retain accents, emoji, repeated values and literal plus signs', () => {
  const query = require('query-string');
  const values = { name: 'Céoù 🏡', next: '/plan/a?room=2', code: 'a+b/c=', filter: ['a', 'b'] };
  assert.deepEqual({ ...query.parse(query.stringify(values)) }, values);
  assert.equal(query.parse('name=C%C3%A9o%C3%B9+test').name, 'Céoù test');
});

test('long malformed URL components terminate instead of recursively amplifying work', { timeout: 2000 }, () => {
  const query = require('query-string');
  const invalid = '%FF'.repeat(5000);
  assert.equal(query.parse('q=' + invalid).q, invalid);
});
