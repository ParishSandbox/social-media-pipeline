import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedFilename, parsePost, serializePost, setFields, slugify, validatePost } from '../scripts/lib/posts.mjs';
import { config, makePost } from './helpers.mjs';

test('parse and serialize round-trip keeps body and fields', () => {
  const text = '---\ntitle: St Thomas\nstatus: draft\npublish_at: 2026-10-06T07:00:00-05:00\n---\n\nHello --- world\n';
  const post = parsePost(text, '2026-10-06-st-thomas.md');
  assert.equal(post.data.title, 'St Thomas');
  assert.equal(post.data.publish_at, '2026-10-06T07:00:00-05:00');
  assert.equal(post.body, 'Hello --- world');
  assert.equal(serializePost(post), text);
});

test('setFields updates and removes keys', () => {
  const post = parsePost('---\ntitle: A\nsync_message: old\n---\n\nBody\n', 'x.md');
  setFields(post, { status: 'scheduled', sync_message: '' });
  assert.equal(post.data.status, 'scheduled');
  assert.equal('sync_message' in post.data, false);
  assert.match(serializePost(post), /status: scheduled/);
});

test('slugify produces file-safe slugs', () => {
  assert.equal(slugify('St Nicholas the Wonderworker, Abp. of Myra'), 'st-nicholas-the-wonderworker-abp-of-myra');
  assert.equal(slugify('Théophany & Blessing'), 'theophany-and-blessing');
  assert.ok(slugify('a'.repeat(30) + ' ' + 'b'.repeat(40)).length <= 60);
});

test('expectedFilename follows the publish date', () => {
  const post = makePost({ title: 'St Thomas', publish_at: '2026-10-06T07:00:00-05:00' });
  assert.equal(expectedFilename(post, config.timezone), '2026-10-06-st-thomas.md');
});

test('draft posts only get warnings for missing caption/image', () => {
  const post = makePost({ title: 'X', status: 'draft', publish_at: '2026-10-11T07:00:00-05:00', channels: ['instagram'] }, '');
  const { errors, warnings } = validatePost(post, config);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /image/.test(w)));
  assert.ok(warnings.some((w) => /caption is empty/.test(w)));
});

test('approved Instagram posts require an image', () => {
  const post = makePost({ title: 'X', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['instagram'] });
  assert.ok(validatePost(post, config).errors.some((e) => /image/.test(e)));
});

test('invalid values are errors', () => {
  const post = makePost({ title: 'X', status: 'posted', publish_at: 'soon', channels: ['tiktok'], link: 'nope' }, 'Hi', 'bad name.md');
  const { errors } = validatePost(post, config);
  assert.equal(errors.length, 5);
});

test('placeholders are errors only when requested', () => {
  const post = makePost({ title: 'X', status: 'draft', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] }, 'TODO(agent): write');
  assert.equal(validatePost(post, config).errors.length, 0);
  assert.equal(validatePost(post, config, { forbidPlaceholders: true }).errors.length, 1);
});
