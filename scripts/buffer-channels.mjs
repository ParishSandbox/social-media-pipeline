#!/usr/bin/env node
// List the Buffer organizations and channels your API key can see, so you can
// copy the channel IDs into config/pipeline.yml.
//
// Usage: BUFFER_API_KEY=... node scripts/buffer-channels.mjs

import { BufferClient } from './lib/buffer.mjs';

const client = new BufferClient({ apiKey: process.env.BUFFER_API_KEY });
for (const org of await client.organizations()) {
  console.log(`Organization: ${org.name} (${org.id})`);
  for (const ch of await client.channels(org.id)) {
    console.log(`  ${ch.service.padEnd(10)} ${ch.id}  ${ch.displayName ?? ch.name}`);
  }
}
