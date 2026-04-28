Commit the current work on the City Unblocked project. Follow these steps exactly:

1. Run `node run-tests.js`. If any suite fails, report the failures and STOP — do not commit.
2. Run `git status` and `git diff --stat` to see what has changed.
3. Stage only the files relevant to the current task (prefer specific file names over `git add -A`).
4. Commit using Conventional Commits format with the message provided in $ARGUMENTS (e.g. `feat: add landing page`). If no message is provided, draft one based on the staged diff.
5. Always append this trailer on a new line at the end of the commit message:

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

6. Use a HEREDOC to pass the message so formatting is preserved.
7. Report the resulting commit hash and summary.

Never use --no-verify, never amend a published commit, never push unless explicitly asked.
