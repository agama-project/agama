#!/bin/bash
# A smoke test: does not fail and leaves a message in the journal
DATE=$(date)
# interpolation avoids line splitting in journalctl
echo "Smoke test of installation via script, running at ${DATE}"
