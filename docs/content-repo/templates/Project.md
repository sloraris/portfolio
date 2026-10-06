---
publish: false
type: project
description:
date: "{{date:YYYY-MM-DD}}"
status: active
featured: false
weight: 100
stack: []
repo:
demo:
writeup:
cover:
---
# {{title}}

%% Project template. This comment is removed on publish.
publish      false until you are ready, then true, then Commit-and-sync
type         keep exactly "project" (lowercase), or it turns into a post
description  the one-line pitch on the card; blank = first paragraph below
date         used for sorting
status       active | finished | archived (archived sinks to the bottom, muted)
featured     true = home page + top of /projects/
weight       lower sorts first among featured projects (default 100)
stack        tech names, case kept, e.g. [TypeScript, Docker]
repo, demo   full http(s) URLs only
writeup      a published post, e.g. "[[My Post About It]]"
cover        e.g. "[[screenshot.png]]" (image lives in the _attachments folder next to this note)
Same filename as a post? Slugs are shared, so add `slug:` to one of them.
Three or more ## headings gives the page a table of contents. Delete sections you don't need.
%%

One or two sentences on what this is and who it's for.

## Why this exists

The problem, and why you built it instead of using something off the shelf.

## What it does

## How it's built

## What I learned

## What's next
