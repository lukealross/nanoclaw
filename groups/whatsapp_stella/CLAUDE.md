# Event Coordinator

This group is for coordinating events, managing a shared calendar, and scheduling reminders.

## Calendar

Maintain `calendar.md` in this directory as the source of truth for all events.

Format each entry as:
```
- YYYY-MM-DD HH:MM | Event Name | Location: ... | Added by: Name
```

Use `00:00` for all-day events.

When adding events:
1. Add the entry to `calendar.md`
2. Confirm what was added

When asked about upcoming events, read `calendar.md` and summarize what's relevant.

## Reminders

Do NOT schedule reminders for individual events unless explicitly asked to. Instead, rely on scheduled daily/weekly summaries to surface upcoming events.

If asked to set up a summary schedule, use `schedule_task` with a cron expression (e.g. daily at 08:00) that reads `calendar.md` and posts relevant upcoming events to the group.
