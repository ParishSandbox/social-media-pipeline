#!/usr/bin/env node
// Check every post in content/posts for problems.
//
// Usage: node scripts/validate-posts.mjs [--no-placeholders] [files...]
//   --no-placeholders  treat leftover "TODO(agent)" placeholders as errors

import path from 'node:path';
import { loadConfig, ROOT } from './lib/config.mjs';
import { loadPosts, validatePost } from './lib/posts.mjs';

async function main() {
  const argv = process.argv.slice(2);
  const forbidPlaceholders = argv.includes('--no-placeholders');
  const only = new Set(argv.filter((a) => !a.startsWith('--')).map((f) => path.basename(f)));

  const config = await loadConfig();
  let posts;
  try {
    posts = await loadPosts(ROOT);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  let errorCount = 0;
  for (const post of posts) {
    if (only.size && !only.has(post.file)) continue;
    const { errors, warnings } = validatePost(post, config, { forbidPlaceholders });
    errorCount += errors.length;
    for (const e of errors) console.log(`✗ ${post.file}: ${e}`);
    for (const w of warnings) console.log(`! ${post.file}: ${w}`);
  }
  console.log(`${posts.length} post(s) checked, ${errorCount} error(s).`);
  if (errorCount) process.exitCode = 1;
}

main();
