import { createHash } from 'node:crypto';
import { postAttachments, postImages } from './posts.mjs';
import { parsePublishAt } from './time.mjs';

/** Resolve an uploaded file path ("/uploads/x.jpg") to its public URL. */
export function publicUrl(value, config) {
  if (/^https?:\/\//i.test(value)) return value;
  if (!config.site_url) throw new Error('config: site_url is required to publish uploaded media');
  const pathPart = value.startsWith('/') ? value : `/${value}`;
  return `${config.site_url}${pathPart.split('/').map(encodeURIComponent).join('/')}`;
}

/** Media URLs a channel post depends on (used to check they are reachable). */
export function mediaUrls(post, config) {
  return postImages(post).map((img) => publicUrl(img.image, config));
}

/**
 * Build the Buffer `createPost` input for one channel. The same input (minus
 * channelId, plus id) is used for `editPost`, so a hash of it tells us when a
 * post changed and needs to be re-sent.
 */
export function composeBufferInput(post, channel, config) {
  const { data } = post;
  const dueAt = parsePublishAt(data.publish_at, config.timezone);
  if (!dueAt) throw new Error('publish_at is not a valid date and time');

  const assets = postImages(post).map((img) => {
    const image = { url: publicUrl(img.image, config) };
    if (img.alt) image.metadata = { altText: String(img.alt) };
    return { image };
  });

  const useLinkCard = channel === 'facebook' && data.link && assets.length === 0;
  let text = post.body.trim();
  if (data.link && !useLinkCard) text += `\n\n${data.link}`;
  for (const a of postAttachments(post)) {
    text += `\n\n📎 ${a.label || 'Download'}: ${publicUrl(a.file, config)}`;
  }

  const firstComment = data.first_comment ? String(data.first_comment).trim() : '';
  let metadata;
  if (channel === 'facebook') {
    metadata = { facebook: { type: 'post' } };
    if (firstComment) metadata.facebook.firstComment = firstComment;
    if (useLinkCard) metadata.facebook.linkAttachment = { url: data.link };
  } else if (channel === 'instagram') {
    metadata = { instagram: { type: 'post', shouldShareToFeed: true } };
    if (firstComment) metadata.instagram.firstComment = firstComment;
  } else {
    throw new Error(`unsupported channel "${channel}"`);
  }

  return {
    channelId: config.buffer.channels[channel],
    text,
    assets,
    metadata,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt: dueAt.toISOString(),
  };
}

export function hashInput(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
}

export function toEditInput(id, input) {
  const { channelId, ...rest } = input;
  return { id, ...rest };
}
