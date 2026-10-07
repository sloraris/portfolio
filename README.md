# sloraris.dev

Personal site, built with [Astro](https://astro.build). The posts are the markdown notes you already write in
Obsidian: there is no second copy to maintain. The site renders them.

## How publishing works

```
Obsidian ──(Obsidian Git: commit & sync)──▶ content repo (private)
                                               │  .github/workflows/notify-site.yml
                                               ▼
                          site repo (this one) ── GitHub Actions ── builds Astro ──▶ GitHub Pages
```

Astro never runs on your machine to publish. It only runs locally when you want to preview.
The build happens on GitHub, checks out **both** repos, and renders every note that has `publish: true`.

To publish a post: set `publish: true` in its properties, then run **Obsidian Git: Commit-and-sync**.
To unpublish: set it to `false` and sync again.

## What kind of page a note becomes

`publish: true` decides *whether* a note is built. The `type` property decides *what* it becomes. The folder a
note lives in never matters.

| `type:`          | Becomes                             | URL                 | Appears in                                                                                         |
| ---------------- | ----------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| *(leave it out)* | A **post**                          | `/posts/<slug>/`    | The posts list, tag pages, the RSS feed, and "Hot off the CPU" on the home page.                   |
| `page`           | A standalone **page** (About, etc.) | `/<slug>/`          | No lists and not the RSS feed. Only `slug: about` has a nav button (always shown); reach others by URL or wikilink. See [The About page](#the-about-page). |
| `project`        | A **project**                       | `/projects/<slug>/` | The projects list, and the home page when `featured: true`. Not the post lists or RSS. The **Projects** nav button is always shown. See [Projects](#projects). |

Things worth knowing:

- `type` is lowercase and exact. Anything other than `page` or `project`, including a typo like `Project`, is
  quietly treated as a post. If a project turns up under Posts, check the spelling.
- A link to another note (`[[wikilink]]` or `.md` link) always resolves to the right URL for that note's type.
- All types share one pool of slugs: two published notes can't have the same one, even if one is a post and
  the other a project. Set `slug:` on one of them.
- Some properties only apply to one type: `tags` to posts, and `status`, `featured`, `weight`, `stack`, `repo`,
  `demo` and `writeup` to projects.

## What you write in Obsidian

Nothing site-specific is required. A note only needs `publish: true` to become a post; everything else, including `type`, is optional.

| You write                                          | The site does                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `publish: true`                                    | Publishes the note. Without it, the note never touches the build output.                        |
| `title:` (optional)                                | Otherwise the leading `# Heading`, otherwise the filename. A matching leading `#` is not repeated. |
| `date:` or `created:` (optional)                   | Otherwise the date the file first appeared in git. Add one if the note is older than the repo.  |
| `description:` (optional)                          | Otherwise the first paragraph.                                                                  |
| `tags:` (optional)                                 | Tag badges and `/posts/tag/<tag>/` pages (posts only).                                          |
| `cover:` (optional)                                | Card/hero image, e.g. `cover: "[[my-image.png]]"`.                                              |
| `slug:` (optional)                                 | The last part of the URL (see the table above), default is the filename.                        |
| `type:` (optional)                                 | `page` or `project`. Leave it out for a post. See [What kind of page a note becomes](#what-kind-of-page-a-note-becomes). |
| `%% outline or private notes %%`                   | Removed. Inline or multi-line. This is where your outline can live in the same file.            |
| `[[Another Note]]`, `[[Note\|alias]]`, `[[Note#H]]` | A link if that note is published, plain text if not (never a dead link).                        |
| `![[image.png\|describe it\|300]]`                 | Image from the `_attachments` folder next to the note. Middle part is the alt text.             |
| `![](https://youtu.be/ID)` or `youtube.com/watch`  | Privacy-friendly YouTube embed (supports `&t=1m30s`).                                           |
| `> [!tip] Title`, `> [!warning]- folded`           | Styled callouts with an icon; `+` / `-` makes them collapsible. See [Callouts](#callouts).      |
| `==highlight==`                                    | Highlighted text.                                                                               |

Table of contents and estimated read time are generated automatically. A ToC appears once a post or project has three or more `##`/`###` headings. Standalone pages (About, etc.) never get one; to change that, see the comment in `src/pages/[slug].astro`.

Wikilinks, embeds and comments inside code blocks are left exactly as written.

## Callouts

Write them the way Obsidian does: a blockquote whose first line is `[!type]`, optionally followed by a title.

```md
> [!tip] Remember
> Anything indented under the quote is the body, and can hold lists, code and links.

> [!warning]- Folded by default
> Click the title to open it.

> [!note]+ Open by default, but foldable
> `-` after the type starts it folded and `+` starts it open. With neither, it can't be folded.
```

With no title the type name is used ("Tip"). Titles are plain text only. Each type has the same icon as in Obsidian
and a color from the site's palette. Aliases look identical to the type they belong to:

| Type (and aliases)                    | Icon          | Color  |
| ------------------------------------- | ------------- | ------ |
| `note`                                | pencil        | cyan   |
| `info`                                | info          | cyan   |
| `todo`                                | circled check | cyan   |
| `abstract`, `summary`, `tldr`         | clipboard     | violet |
| `example`                             | list          | violet |
| `tip`, `hint`                         | flame         | green  |
| `important`                           | flame         | orange |
| `success`, `check`, `done`            | check         | green  |
| `question`, `help`, `faq`             | circled ?     | cyan   |
| `warning`, `caution`, `attention`     | triangle      | orange |
| `failure`, `fail`, `missing`          | x             | red    |
| `danger`, `error`                     | lightning     | red    |
| `bug`                                 | bug           | red    |
| `quote`, `cite`                       | quote marks   | gray   |

Any other type (`[!anything]`) still renders, as a note: cyan with the pencil, titled with the type name.

The icons are [Lucide](https://lucide.dev) shapes drawn in CSS (`src/styles/global.css`, under "Obsidian callouts"),
so there is nothing to install. To add a type, give it a `--callout-icon` and a `--c` color there.

## One-time setup

About 15 minutes. The site repo is `sloraris/portfolio` (this one); the content repo is a new private repo that
holds your notes. Below it is called `your-user/your-content-repo`; the name doesn't matter.

1. **Site repo → Settings → Pages → Source: *GitHub Actions*.** It is most likely already set, because the old
   Hugo workflow deployed the same way. The custom domain (`sloraris.dev`) lives on the same page and stays as is.
   `.github/workflows/deploy.yml` replaces the old Hugo workflow.
2. **Content repo.** Create a private repo and put your notes in it: the whole vault, or just the folder that holds
   the posts. Only notes with `publish: true` are rendered, but the whole repo is checked out on GitHub's build
   machine, so a smaller repo means less exposure. Then:
   - Install the **Obsidian Git** plugin, point it at the repo (branch `main`), and turn on auto commit-and-sync
     if you want it.
   - Add a `.gitignore` so Obsidian's own state doesn't create noise:
     ```
     .obsidian/workspace*.json
     .obsidian/cache
     .trash/
     .DS_Store
     ```
3. **Two fine-grained tokens** (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
   tokens → Generate new token). Each one is limited to a single repo:

   | Name (suggested)    | Repository access      | Permission (Repository)        | Used for                                    |
   | ------------------- | ---------------------- | ------------------------------ | ------------------------------------------- |
   | `site-read-content` | only the **content** repo | **Contents: Read-only**      | the build reads your notes                  |
   | `content-ping-site` | only the **site** repo    | **Contents: Read and write** | the content repo tells the site to rebuild  |

   (GitHub requires *write* to send a dispatch event, which is why the second token has more power. It can only
   touch the site repo, which is public anyway.)
4. **Site repo → Settings → Secrets and variables → Actions**
   - Variables tab: `CONTENT_REPO` = `your-user/your-content-repo`
   - Secrets tab: `CONTENT_REPO_TOKEN` = the `site-read-content` token
5. **Content repo**: copy `docs/content-repo/notify-site.yml` from this repo to `.github/workflows/notify-site.yml`
   in the content repo (do it on github.com or from a terminal: Obsidian doesn't show dot-folders). Then in
   **Settings → Secrets and variables → Actions**:
   - Variables tab: `SITE_REPO` = `sloraris/portfolio`
   - Secrets tab: `SITE_DISPATCH_TOKEN` = the `content-ping-site` token
6. **Try it.** Site repo → Actions → *Build and deploy* → *Run workflow*. When that is green, set `publish: true` on
   a note, run *Commit-and-sync*, and watch *Notify site* run in the content repo and then *Build and deploy* in
   the site repo (about a minute or two).
7. Fine-grained tokens expire (1 year max). Put a reminder in your calendar; an expired token shows up as the
   failures listed below.

### When something goes wrong

| What you see                                                        | Why                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| *Build* fails first with "Content repo not configured"              | `CONTENT_REPO` (variable) or `CONTENT_REPO_TOKEN` (secret) is missing in the **site** repo.           |
| *Build* fails at "Check out the content repo" ("Repository not found") | Wrong `CONTENT_REPO` name, or the token expired / isn't granted that repo / doesn't have Contents: Read. |
| *Notify site* fails with 401, 403 or 404                            | `SITE_DISPATCH_TOKEN` expired or has the wrong repo or permission, or `SITE_REPO` is misspelled.      |
| *Notify site* is green but the site never rebuilds                  | The dispatch only reaches a workflow file on the site repo's default branch (`main`). Merge the workflow there first. |
| The site rebuilt but the note isn't there                           | Check `publish: true` and that `type:` is spelled exactly (see above).                                |
| Nothing at all happens after a sync                                 | Obsidian Git didn't push (check its status bar), or only `.obsidian/` files changed.                  |

## Local development

```sh
pnpm install
CONTENT_DIR=../path/to/your-content-repo pnpm dev
pnpm test
CONTENT_DIR=../path/to/your-content-repo pnpm build
```

`CONTENT_DIR` is the folder the notes are read from. Set it inline like above; if it isn't set, the default is
`./content` inside this repo, which is git-ignored so a dev vault kept there is never committed.
`pnpm dev` watches the vault: save a note in Obsidian and the page updates.
`test/fixtures/vault` is a small fake vault that exercises every feature above.

## Things worth knowing

- **A missing content directory fails the build** on purpose, so a broken checkout can never deploy an empty site.
- **Unpublished notes are never read into the output.** Attachments are only copied if a *published* note uses them,
  and anything outside the vault folder is refused.
- **CI logs may be public**, so in CI the build warnings do not name unpublished notes.
- Two published notes with the same slug fail the build; set `slug:` on one of them.
- Images are copied as-is (no resizing yet).
- Callout titles support plain text only (no bold/links inside the title line).

## Layout

- **Wide screens (1280px+)**: the content, centered, with a floating pill nav at the top. At the very top and
  bottom of a page, and while hovered, the pill is fully expanded (Home / Posts / Projects, logo, social icons,
  About). While you scroll it folds down to `3 dots / logo / avatar`; hover it to expand again (on a touch screen,
  tap the 3 dots; it folds away again on the next scroll or a tap elsewhere).
- **Table of contents pill** (posts and projects with three or more headings): a second pill that floats beside the
  article, a gap (`--toc-gap`) past the right edge of the text column, or at the window's right margin
  (`--rail-edge`) when the window is too narrow for that. Vertically it follows the nav pill: it sits just under it
  while the nav is expanded (on wide windows the expanded nav is wider than the text column, so they would otherwise
  collide), slides up onto the nav's row while the nav is folded (scrolling), and slides back down when the nav
  expands again (`--toc-top`, `--nav-h` in `src/styles/global.css`; `mobileMenu.js` sets `body[data-nav-collapsed]`
  for it). At the top of
  the page it is open and shows the full list. Once you scroll it collapses into a slim bar: one tick per heading
  (passed ones tinted, the one you are reading lit) plus a reading-progress percentage. If there are more headings
  than fit, the bar becomes a window of ticks that slides along as you read, fading out at the edges where more
  are hidden. Hover it, or Tab into it, to open it again. Click the bar to **pin** it open (it then stays open
  while scrolling); click again to unpin.
- A very long table of contents scrolls inside its pill.
- **Smaller screens**: the nav becomes a pill at the bottom edge, in thumb reach. The menu button on the right
  opens it upward into a panel (Home / Posts / Projects, About, social links). On pages with a table of contents the
  empty middle of the bar holds a ToC button showing the reading progress (the same tick bar and percentage as the
  desktop pill). Tap it and the pill grows upward into the list of headings, scrolled to the section you are reading.
  Tap the button again, tap a heading (it jumps there and the list closes), tap outside the pill, or press Escape to
  put it away. The menu and the ToC are never open together. The author box (avatar, bio, social links) sits at the
  end of every post, page and project, at every screen size.

## The About page

Write it in Obsidian like everything else: a note with

```yaml
publish: true
type: page
slug: about
```

It appears at `/about/`. The **About** button in the nav (and "About me" in the author box) is always there: until
you publish such a note, `/about/` shows a short placeholder built from the bio in `src/config.ts`, and the note
replaces it as soon as it is published. A starter draft is in `docs/content-repo/templates/About.md`. Other pages work the same way with a different `slug` (`posts`, `projects`, `media` and
`404` are reserved).

## Projects

A project is a note like any other, with `type: project` added. It lives at `/projects/<slug>/`, is listed at
`/projects/`, and stays out of the post lists, tag pages and RSS feed. The folder it sits in does not matter.
The **Projects** button is always in the nav (with no projects yet, `/projects/` says so), and featured projects
show on the home page.

```yaml
publish: true
type: project
description: One-line pitch shown on the card   # otherwise the first paragraph
status: active            # active | finished | archived (default active); archived sinks to the bottom, muted
featured: true            # default false: shows on the home page and sorts first
weight: 10                # lower sorts first among featured projects (default 100)
stack: [TypeScript, Docker]
repo: https://github.com/you/thing
demo: https://thing.example.com
writeup: "[[My Post About It]]"   # link to a published note
cover: "[[screenshot.png]]"
```

Everything except `publish` and `type` is optional. `title`, `date`, `description` and `cover` work exactly as for
posts. `repo` and `demo` must be `http(s)` URLs, and `writeup` only links to a published note (otherwise it is
ignored with a warning). Slugs are shared with posts, so a project and a post with the same filename need an
explicit `slug:` on one of them.

## Where your images go

Everything lives in `public/` and is referenced by URL path in `src/config.ts`.

| File                          | Setting / behavior                                                           |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `public/avatar.webp`          | `author.avatar: '/avatar.webp'`. Square, 256px (it is shown as a circle, 32-64px wide, so this covers high-density screens). Keep the full-size original outside `public/`, e.g. `source-assets/`. |
| `public/logo.svg`             | `logo: '/logo.svg'`. The `[sloraris]` wordmark in the nav (displayed 40px tall). |
| `public/logo-square.svg`      | The square mark. Not referenced by the site itself; kept for reuse.          |
| `public/favicon.svg`          | Browsers prefer it. Currently the square mark.                               |
| `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png` | Picked up automatically (`.ico`). |
| `public/apple-touch-icon.png` | 180x180. Picked up automatically if the file exists.                         |
| `public/android-chrome-*.png`, `site.webmanifest` | Home-screen icons; the manifest is linked automatically. |
| `public/cosmic-hero.webp`     | `heroImage` for the home page hero (already set). It is `cosmic.jpg` pre-blurred and shrunk to 1920px wide (26 KB instead of 674 KB), so the browser does not have to blur it live. The hero shows the image as it is, so blur or shrink a replacement before using it. |
| `heroQuotes` in `src/config.ts` | The one-liners that scramble into each other on the hero's first line, in random order (the first is shown without JavaScript; one entry = no animation). Click or tap the line for the next one. Keep them to about 27 characters so they fit one line on a phone. |

The logo and favicons from the old site are already in place. Until you set the avatar and hero image, the site shows a gradient avatar placeholder and a CSS starfield.

## Making it yours

- Colors, radii: the `daisyui/theme` block at the top of `src/styles/global.css`. Bright violet (`glow`), soft violet
  (`soft`) and peach (links you have already visited) are `@theme static` tokens right under it. Orange is reserved
  for links, highlights and the important / warning callouts, so it draws the eye when it appears. The link colors
  (`--link-rest`, `--link-hover`, `--link-press`, `--link-visited`) sit in `:root` further down.
- Reading experience in articles (`.post-prose` in `global.css`): h2 headings get a gradient `>`,
  `---` renders as a row of three stars, code blocks get a header bar with the
  language and a Copy button (`src/lib/codeBlocks.js`; the language comes from a Shiki transformer in
  `src/lib/vault/render.mjs`), and tables are framed and scroll sideways on narrow screens. All of it is plain CSS
  or a small script, so readers without JavaScript still get styled code and tables, just without the header bar.
- Name, bio, links: `src/config.ts`.
- Fonts (Exo 2, Ubuntu, Ubuntu Mono) are self-hosted, nothing loads from Google.
- No analytics are included (the old site's Google tag was deliberately not carried over).
