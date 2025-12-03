When running shell commands, remember the quoting rules.

In particular, you may be tempted to say

> git commit -m "Use the `date` command"

to indicate markdown typewriter font, but the shell interprets it
as command execution. Prefer single quotes around messages.
