# First-time setup

This is a one-time job for whoever looks after the parish's GitHub account,
and takes about an hour. Editors never need to do any of it.

## 1. Parish settings

Edit [`config/pipeline.yml`](../config/pipeline.yml):

- `parish.name` and `parish.hashtags`.
- `timezone` (an IANA name such as `America/New_York`). **Also change
  `input_timezone`** in [`site/admin/config.yml`](../site/admin/config.yml) to match.
- `calendar.source`: `gregorian` (New Calendar) or `julian` (Old Calendar).
- `calendar.include_sundays`, `min_feast_level`, `default_post_time` and
  `default_channels`.

If you fork or rename the repository, update `repo`, `site_url` and
`display_url` in `site/admin/config.yml` and `site_url` in `config/pipeline.yml`.

## 2. GitHub Pages

The editor, and the images Buffer downloads, are served from GitHub Pages.

1. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Pages on a private repository needs a paid GitHub plan. On the free plan the
   repository must be public. Either way, files in `site/uploads/` are public.

## 3. Editor sign-in

Editors need a GitHub account with **write** access to this repository
(**Settings → Collaborators and teams**).

> **Sign In with GitHub does not work until you complete option A.** GitHub
> Pages cannot run the OAuth exchange itself, so the button needs a small
> external service. Until then, use **Sign In with Token** (option B).

### Option A (recommended): Sveltia CMS Authenticator

This is a free Cloudflare Worker that handles the GitHub OAuth exchange. Set it
up once, and editors then just click **Sign In with GitHub**.

1. **Deploy the worker.** Create a free [Cloudflare](https://dash.cloudflare.com/sign-up)
   account, then use the **Deploy to Cloudflare Workers** button on
   <https://github.com/sveltia/sveltia-cms-auth>. Copy the worker URL, e.g.
   `https://sveltia-cms-auth.<subdomain>.workers.dev`.
2. **Register a GitHub OAuth app.** Use
   **ParishSandbox → Settings → Developer settings → OAuth Apps → New OAuth App**
   (an org-owned app survives staff changes):
   - Application name: `Parish Social Media Editor`
   - Homepage URL: `https://parishsandbox.github.io/social-media-pipeline/`
   - Authorization callback URL: `<worker URL>/callback`

   Then click **Generate a new client secret**. Copy the Client ID and the secret.
3. **Configure the worker.** In Cloudflare, open the `sveltia-cms-auth` worker,
   go to **Settings → Variables and Secrets**, and add:
   - `GITHUB_CLIENT_ID`: the Client ID
   - `GITHUB_CLIENT_SECRET`: the client secret (type **Secret**)
   - `ALLOWED_DOMAINS`: `parishsandbox.github.io`

   Save and deploy.
4. **Point the editor at it.** In `site/admin/config.yml`, uncomment `base_url`
   under `backend`, set it to the worker URL (no trailing slash), and commit.
   The publish workflow redeploys the site.
5. If the organization restricts third-party OAuth apps
   (**Settings → Third-party access**), approve the app. Otherwise editors will
   sign in successfully but won't see the repository.

### Option B (quick start): personal access token

Each editor creates a
[fine-grained personal access token](https://github.com/settings/personal-access-tokens/new):

- Resource owner: **ParishSandbox**
- Repository access: **Only select repositories → social-media-pipeline**
- Repository permissions: **Contents: Read and write**

Then they click **Sign In with Token** in the editor and paste it. If the
organization requires approval for fine-grained tokens, an org owner must
approve each one (**Settings → Personal access tokens → Pending requests**).

> **Branch protection:** the editor commits directly to `main`. If you protect
> `main` with required reviews, editors cannot save. Use the post statuses for
> review instead.

## 4. Buffer

1. Create a [Buffer](https://buffer.com) account and connect the parish
   **Facebook Page** and **Instagram Business/Creator account**.
2. Create an API key at <https://publish.buffer.com/settings/api>.
3. Add it as a repository secret named **`BUFFER_API_KEY`**
   (**Settings → Secrets and variables → Actions**).
4. Find your channel IDs:

   ```sh
   npm ci
   BUFFER_API_KEY=... npm run buffer:channels
   ```

   Then put them in `buffer.channels` in `config/pipeline.yml`.
5. Free-plan limits are about 10 queued posts per channel and 100 API
   requests per 15 minutes. Posts are only sent to Buffer
   `schedule_window_days` (default 14) before publishing. On a paid plan you can
   raise that.

Until `BUFFER_API_KEY` is set, the publish workflow runs in preview mode and
only logs what it would do.

## 5. Feast-day drafts (agentic workflow)

The weekly [`hydrate-feast-calendar`](../.github/workflows/hydrate-feast-calendar.md)
workflow uses [GitHub Agentic Workflows](https://github.github.com/gh-aw/) with
the Copilot engine.

1. Create the **`COPILOT_GITHUB_TOKEN`** secret. The person creating it needs
   a GitHub Copilot license; the workflow's AI usage counts against it.
   1. Open this
      [pre-filled token page](https://github.com/settings/personal-access-tokens/new?name=COPILOT_GITHUB_TOKEN&description=GitHub+Agentic+Workflows+-+Copilot+engine+authentication&user_copilot_requests=read).
   2. Set **Resource owner** to **your user account**, not the organization.
   3. Leave repository access as **Public repositories** (no repository
      permissions are needed).
   4. Under **Account permissions**, check that **Copilot Requests** is **Read**.
   5. Set an expiration you can remember to renew, then click **Generate token**.
   6. In this repository, go to **Settings → Secrets and variables → Actions →
      New repository secret**. Name it `COPILOT_GITHUB_TOKEN` and paste the
      token. (Or run `gh aw secrets set COPILOT_GITHUB_TOKEN --value "<token>"`.)

   If the organization has centralized Copilot billing, you can skip the token.
   Add `copilot-requests: write` under `permissions:` in
   `.github/workflows/hydrate-feast-calendar.md` and recompile. See the
   [gh-aw authentication docs](https://github.github.com/gh-aw/reference/auth/).
2. Allow GitHub Actions to create pull requests: **Settings → Actions → General
   → Workflow permissions → Allow GitHub Actions to create and approve pull requests**.
3. Create the `feast-calendar` and `automation` labels, or remove them from the
   workflow.
4. Run it once from the **Actions** tab (**Draft feast-day posts → Run workflow**).
   It opens a PR with drafts for the next 90 days. After you merge it, the
   drafts appear in the editor.

After editing the workflow's `.md` file, recompile with
`gh extension install github/gh-aw && gh aw compile` and commit the `.lock.yml`.

## 6. Check it works

1. Open `https://<owner>.github.io/<repo>/admin/` and sign in.
2. Create a test post a few days ahead with an image. Set it to **Approved** and save.
3. Watch **Actions → Publish site & sync Buffer**. The post should appear in
   Buffer and its status should change to **Scheduled** (reload the editor).
4. Edit the caption, save, and check that Buffer updates. Set it to **Canceled**
   and check that it disappears from Buffer.

You can run the publish workflow manually with **dry run** ticked to preview
changes without touching Buffer.
