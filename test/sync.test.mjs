import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BufferError } from '../scripts/lib/buffer.mjs';
import { syncPosts } from '../scripts/lib/sync.mjs';
import { config, makePost } from './helpers.mjs';

const NOW = new Date('2026-10-04T12:00:00Z');
const image = [{ image: '/uploads/icon.jpg', alt: 'Icon' }];

class FakeBuffer {
  constructor() {
    this.posts = new Map();
    this.calls = [];
    this.next = 1;
  }
  async createPost(input) {
    this.calls.push(['create', input.channelId]);
    const post = { id: `b${this.next++}`, status: 'scheduled', ...input };
    this.posts.set(post.id, post);
    return post;
  }
  async editPost(input) {
    this.calls.push(['edit', input.id]);
    if (!this.posts.has(input.id)) throw new BufferError('missing', { code: 'NOT_FOUND' });
    Object.assign(this.posts.get(input.id), input);
    return this.posts.get(input.id);
  }
  async deletePost(id) {
    this.calls.push(['delete', id]);
    this.posts.delete(id);
    return { id };
  }
  async getPost(id) {
    this.calls.push(['get', id]);
    return this.posts.get(id);
  }
}

const run = (posts, state, client, extra = {}) =>
  syncPosts({ posts, state, config, client, now: NOW, ...extra });

test('approved post inside the window is created on every channel and marked scheduled', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook', 'instagram'], images: image });
  const state = {};
  const client = new FakeBuffer();
  const result = await run([post], state, client);

  assert.deepEqual(client.calls, [['create', 'fb-1'], ['create', 'ig-1']]);
  assert.equal(post.data.status, 'scheduled');
  assert.equal(post.data.sync_message, undefined);
  assert.deepEqual(Object.keys(state.posts['2026-10-11-st-thomas.md']), ['facebook', 'instagram']);
  assert.ok(result.changed.has(post));
});

test('unchanged posts make no API calls; edits are sent with editPost', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] });
  const state = {};
  const client = new FakeBuffer();
  await run([post], state, client);
  client.calls = [];

  await run([post], state, client);
  assert.deepEqual(client.calls, []);

  const edited = makePost({ title: 'St Thomas', status: 'scheduled', publish_at: '2026-10-11T08:00:00-05:00', channels: ['facebook'] }, 'New caption');
  await run([edited], state, client);
  assert.deepEqual(client.calls, [['edit', 'b1']]);
  assert.equal(client.posts.get('b1').text, 'New caption');
  assert.equal(client.posts.get('b1').dueAt, '2026-10-11T13:00:00.000Z');
});

test('approved posts outside the scheduling window wait, with a note', async () => {
  const post = makePost({ title: 'Nativity', status: 'approved', publish_at: '2026-12-25T07:00:00-06:00', channels: ['facebook'] }, 'Christ is born!', '2026-12-25-nativity.md');
  const client = new FakeBuffer();
  await run([post], {}, client);
  assert.deepEqual(client.calls, []);
  assert.equal(post.data.status, 'approved');
  assert.match(post.data.sync_message, /automatically on 2026-12-11/);
});

test('canceling or un-approving a post deletes it from Buffer', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] });
  const state = {};
  const client = new FakeBuffer();
  await run([post], state, client);

  const canceled = makePost({ title: 'St Thomas', status: 'canceled', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] });
  await run([canceled], state, client);
  assert.deepEqual(client.calls.at(-1), ['delete', 'b1']);
  assert.deepEqual(state.posts, {});
});

test('removing a channel or deleting the file removes those Buffer posts', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook', 'instagram'], images: image });
  const state = {};
  const client = new FakeBuffer();
  await run([post], state, client);

  const fbOnly = makePost({ title: 'St Thomas', status: 'scheduled', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'], images: image });
  await run([fbOnly], state, client);
  assert.deepEqual(client.calls.at(-1), ['delete', 'b2']);

  await run([], state, client);
  assert.deepEqual(client.calls.at(-1), ['delete', 'b1']);
  assert.deepEqual(state.posts, {});
});

test('invalid approved posts are not sent and explain why', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['instagram'] });
  const client = new FakeBuffer();
  await run([post], {}, client);
  assert.deepEqual(client.calls, []);
  assert.equal(post.data.status, 'approved');
  assert.match(post.data.sync_message, /Instagram posts need at least one image/);
});

test('posts whose time has passed are flagged instead of created', async () => {
  const post = makePost({ title: 'Old', status: 'approved', publish_at: '2026-10-01T07:00:00-05:00', channels: ['facebook'] }, 'Hi', '2026-10-01-old.md');
  const client = new FakeBuffer();
  await run([post], {}, client);
  assert.deepEqual(client.calls, []);
  assert.match(post.data.sync_message, /already passed/);
});

test('files are renamed to match a changed publish date, keeping Buffer state', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] });
  const state = {};
  const client = new FakeBuffer();
  await run([post], state, client);

  const moved = makePost({ title: 'St Thomas', status: 'scheduled', publish_at: '2026-10-12T07:00:00-05:00', channels: ['facebook'] });
  const result = await run([moved], state, client);
  assert.deepEqual(result.renames.map(({ from, to }) => [from, to]), [['2026-10-11-st-thomas.md', '2026-10-12-st-thomas.md']]);
  assert.ok(state.posts['2026-10-12-st-thomas.md'].facebook);
  assert.deepEqual(client.calls.at(-1), ['edit', 'b1']);
});

test('a post deleted in Buffer is recreated on the next edit', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] });
  const state = {};
  const client = new FakeBuffer();
  await run([post], state, client);
  client.posts.clear();

  const edited = makePost({ title: 'St Thomas', status: 'scheduled', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] }, 'Edited');
  await run([edited], state, client);
  assert.deepEqual(client.calls.slice(-2), [['edit', 'b1'], ['create', 'fb-1']]);
  assert.equal(state.posts['2026-10-11-st-thomas.md'].facebook.id, 'b2');
});

test('sent posts are marked published when checking', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] });
  const state = {};
  const client = new FakeBuffer();
  await run([post], state, client);
  client.posts.get('b1').status = 'sent';
  client.posts.get('b1').externalLink = 'https://facebook.com/p/1';

  await syncPosts({ posts: [post], state, config, client, now: new Date('2026-10-12T00:00:00Z'), checkPublished: true });
  assert.equal(post.data.status, 'published');
  assert.equal(state.posts['2026-10-11-st-thomas.md'].facebook.externalLink, 'https://facebook.com/p/1');
});

test('rate limiting stops the run without touching later posts', async () => {
  const a = makePost({ title: 'A', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] }, 'A', '2026-10-11-a.md');
  const b = makePost({ title: 'B', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'] }, 'B', '2026-10-11-b.md');
  const client = new FakeBuffer();
  client.createPost = async () => {
    throw new BufferError('slow down', { code: 'RATE_LIMIT_EXCEEDED' });
  };
  const result = await run([a, b], {}, client);
  assert.equal(result.halted.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(b.data.sync_message, undefined);
});

test('unreachable media is retried later', async () => {
  const post = makePost({ title: 'St Thomas', status: 'approved', publish_at: '2026-10-11T07:00:00-05:00', channels: ['facebook'], images: image });
  const client = new FakeBuffer();
  await run([post], {}, client, { checkMedia: async (urls) => urls });
  assert.deepEqual(client.calls, []);
  assert.match(post.data.sync_message, /not reachable yet/);
});
