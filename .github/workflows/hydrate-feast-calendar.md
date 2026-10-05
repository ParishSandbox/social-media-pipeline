---
description: >-
  Drafts Facebook/Instagram posts for upcoming Sundays and high feasts (from
  orthocal.info) about three months ahead and opens a pull request with them.

on:
  schedule: weekly on monday
  workflow_dispatch:

permissions:
  contents: read

engine: copilot

timeout-minutes: 20

network:
  allowed:
    - defaults
    - orthocal.info
    - www.oca.org

tools:
  edit:
  web-fetch:
  bash:
    - "node scripts/validate-posts.mjs:*"
    - "cat"
    - "ls"
    - "jq"
    - "git diff:*"

steps:
  - uses: actions/setup-node@v7
    with:
      node-version: 22
      cache: npm
  - name: Install dependencies
    run: npm ci
  - name: Create skeleton posts from the church calendar
    run: node scripts/hydrate-calendar.mjs --manifest /tmp/gh-aw/agent/feast-calendar.json

safe-outputs:
  create-pull-request:
    title-prefix: "[feast-calendar] "
    labels: [feast-calendar, automation]
    draft: false
---

# Draft feast-day posts for the parish

You are helping the social media team of an Orthodox Christian parish. A
script has already created **draft post files** in `content/posts/` for the
Sundays and great feasts in the next three months. The list of new files is in
`/tmp/gh-aw/agent/feast-calendar.json` (read it with `cat`). If that file lists
no posts, stop and do nothing.

Read `config/pipeline.yml` for the parish name and standard hashtags, and look
at one or two existing posts in `content/posts/` whose status is `approved`,
`scheduled` or `published` to match the team's tone.

## Tools available

The shell is restricted. You can run `cat`, `ls`, `jq`, `git diff`, and
`node scripts/validate-posts.mjs …` only. Python, other `node` commands and
scripts you write yourself are blocked, so don't try them. Edit each post
directly with the **edit** tool, one file at a time. The manifest's `items[].file`
entries are repository-relative paths.

## Instructions

For **each file listed in the manifest** (and no other files):

1. Replace the line `TODO(agent): write the caption for this post.` with a
   caption for Facebook and Instagram:
   - 60–150 words, warm and reverent, written for parishioners and neighbours.
   - Say what is commemorated and why it matters, using only facts from the
     post's `notes` (feasts, saints, readings) or from pages on orthocal.info /
     oca.org that you fetched. **Never invent biographical details, quotes,
     miracles, or service times.** If you are unsure, keep it general.
   - You may quote a short phrase from the appointed Gospel or Epistle only if
     you fetched its text.
   - End with the parish hashtags from `config/pipeline.yml` plus at most three
     relevant hashtags (e.g. `#SaintNicholas`). No emoji other than ☦️ or 🕯️.
2. You may improve the `title` field so it reads naturally (e.g. "Sunday of the
   Fathers of the Seventh Ecumenical Council"). Do not change the file name,
   `publish_at`, `status`, `channels`, `source`, `orthocal_date` or `notes`.
3. Leave `status: draft`. A human approves every post.
4. Do not add images. The team chooses icons themselves (the notes remind them).

When done, run `node scripts/validate-posts.mjs --no-placeholders` followed by
the file names from the manifest, and fix any errors it reports.

Finally, create a pull request containing the new post files. In the
description, list each post (date and title) as a checklist so the team can
track which ones still need an image and review. Mention that merging the PR
only adds drafts — nothing is posted until someone sets a post to **Approved**
in the editor.
