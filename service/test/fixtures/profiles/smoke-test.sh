#!/bin/bash
# A smoke test: does not fail and leaves a message in the journal
# Runs for 10s to test asyc execution
DATE=$(date)
# interpolation avoids line splitting in journalctl
echo "Smoke test of installation via script, running at ${DATE}"
for i in `seq 5`; do
  echo Sleep $i of 5
  sleep 2
done
