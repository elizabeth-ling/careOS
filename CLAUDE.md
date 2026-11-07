# CLAUDE.md

Instructions for LLM agents working in this repository.

## Git

- **Never commit or push.** This includes amending, rebasing, squashing, merging, and equivalents in other VCS tools. The user does all of these themselves.
- Read-only git commands such as `git status`, `git diff`, and `git log` are fine.
- Do not open pull requests unless asked.
- Other agents may be working in this repository. Do not modify, discard, or revert changes you did not make.

## Telling the user what to commit

When a piece of work is ready, end your response with a commit suggestion:

- List the files or hunks that belong in each commit.
- Give a commit message ready to use, explaining what changed and why. Keep it succinct.
- Do not include AI attribution, such as `Co-Authored-By` trailers or "Generated with" lines.
- Split unrelated changes into separate commits, by hunk (`git add -p`) if they share a file.
- Keep tests in the same commit as the behavior they verify.
- Put generated output, docs-only edits, and mechanical cleanup in their own commits when each commit still makes sense alone.
- If a change clearly belongs with an unpushed local commit, suggest amending it rather than adding a small fixup commit.
- Flag anything that should not be committed, such as secrets or stray files.
