# Can I commit the art pass and the mobile work?

Decided: 2026-10-31 · Case: c_9b7766fc-51fa-4aa7-8af4-81be5b214cfc

## Question and choice
All work since the slice commit was not committed. The GPT drafts folder is 77 MB. What goes in the commit?

Choice: "Commit all work. Add docs/art/drafts/ to .gitignore. The final art, previews and tools go in the commit (about 7 MB)."

## Why
- The drafts are raw outputs. The final art and the tools that made it are in the commit. A small repo is easier to clone and push.

## Constraints
- `docs/art/drafts/` is in `.gitignore`. Raw GPT outputs stay on this computer only.
- The commit holds the final art (`packages/client/public/`), previews, decision records, plan, tools and code.

## Ruled out
- Commit the drafts too: the repo becomes about 80 MB larger.
- No commit now: work can be lost.

## Open questions
- The repo has no git remote. The human must add one to push.

## Sources
- Case c_9b7766fc-51fa-4aa7-8af4-81be5b214cfc
