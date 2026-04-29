Commit the current work on the Make It Liveable project. Follow these steps exactly:

0. **Definition of Done check** — before committing, verify:
   - CLAUDE.md is accurate (test count, globals, mechanics, constants)
   - README.md reflects any player-facing rule or mechanic changes
   - Skill files in .claude/commands/ are updated if their grep targets changed
   - New pure logic is in src/ with tests if it can be unit-tested

1. Run `npm test`. If any suite fails, report the failures and STOP — do not commit.
2. Run `git status` and `git diff --stat` to see what has changed.
3. Stage only the files relevant to the current task (prefer specific file names over `git add -A`).
4. Commit using Conventional Commits format with the message provided in $ARGUMENTS (e.g. `feat: add landing page`). If no message is provided, draft one based on the staged diff.
5. Always append this trailer on a new line at the end of the commit message:

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

6. Use a HEREDOC to pass the message so formatting is preserved.
7. Report the resulting commit hash and summary.

Never use --no-verify, never amend a published commit, never push unless explicitly asked.
