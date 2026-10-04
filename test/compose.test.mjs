import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeBufferInput, hashInput, publicUrl, toEditInput } from '../scripts/lib/compose.mjs';
import { config, makePost } from './helpers.mjs';

const base = { title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00' };

test('publicUrl resolves uploads against site_url', () => {
  assert.equal(publicUrl('/uploads/St Thomas.jpg', config), 'https://example.org/smp/uploads/St%20Thomas.jpg');
  assert.equal(publicUrl('https://cdn.example/x.jpg', config), 'https://cdn.example/x.jpg');
});

test('instagram input carries images, alt text and metadata', () => {
  const post = makePost({ ...base, images: [{ image: '/uploads/icon.jpg', alt: 'Icon of St Thomas' }], link: 'https://youtu.be/abc' });
  const input = composeBufferInput(post, 'instagram', config);
  assert.deepEqual(input, {
    channelId: 'ig-1',
    text: 'Blessed feast!\n\nhttps://youtu.be/abc',
    assets: [{ image: { url: 'https://example.org/smp/uploads/icon.jpg', metadata: { altText: 'Icon of St Thomas' } } }],
    metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt: '2026-10-11T12:00:00.000Z',
  });
});

test('facebook text-only post with a link uses a link card', () => {
  const post = makePost({ ...base, link: 'https://youtu.be/abc', first_comment: 'Join us!' });
  const input = composeBufferInput(post, 'facebook', config);
  assert.equal(input.text, 'Blessed feast!');
  assert.deepEqual(input.metadata, {
    facebook: { type: 'post', firstComment: 'Join us!', linkAttachment: { url: 'https://youtu.be/abc' } },
  });
});

test('attachments are linked in the caption', () => {
  const post = makePost({ ...base, attachments: [{ file: '/uploads/bulletin.pdf', label: 'Bulletin' }] });
  const input = composeBufferInput(post, 'facebook', config);
  assert.equal(input.text, 'Blessed feast!\n\n📎 Bulletin: https://example.org/smp/uploads/bulletin.pdf');
});

test('hash changes with content and edit input drops channelId', () => {
  const a = composeBufferInput(makePost(base), 'facebook', config);
  const b = composeBufferInput(makePost(base, 'Different'), 'facebook', config);
  assert.notEqual(hashInput(a), hashInput(b));
  assert.equal(hashInput(a), hashInput(composeBufferInput(makePost(base), 'facebook', config)));
  const edit = toEditInput('p1', a);
  assert.equal(edit.id, 'p1');
  assert.equal('channelId' in edit, false);
});
