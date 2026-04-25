---
description: Stage all changes and create a commit with a clear message based on actual file changes
allowed-tools: Bash(git:*)
---

# Create Commit

## Steps

1. Check the current git status: `git status --short` to see what files have changed
2. Get the actual changes in the working directory: `git diff` (for unstaged changes) and `git diff --cached` (for staged changes)
3. Review the actual file changes to understand what was modified:
   - Read the diff output to identify the key changes
   - Focus on understanding what files changed and what the nature of the changes are
   - Group changes by area/feature if multiple files were modified
4. Stage all changes: `git add -A` (or `git add .` if you prefer)
5. Verify what will be committed: `git status` to confirm all intended files are staged
6. Create a commit with a clear and simple message:
   - Use conventional commit format: `type: brief description`
   - Types: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, etc.
   - Keep the message concise (50-72 characters for the subject line)
   - Base the message on the actual changes you observed in the diff, not assumptions
   - Example: `git commit -m "feat: add user authentication endpoint"`
   - If more context is needed, use a multi-line message:
     ```
     git commit -m "feat: add user authentication endpoint

     - Add POST /auth/login endpoint
     - Implement JWT token generation
     - Add password validation middleware"
     ```
7. Show the commit that was created: `git log -1 --stat` to confirm the commit
