#! /bin/bash

# This helper script creates the "osc" configuration file with OBS credentials

CONFIG_FILE="$HOME/.config/osc/oscrc"

# do not overwrite the existing config accidentally
if [ -e "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE already exists"
  exit 1
fi

TEMPLATE=$(dirname "${BASH_SOURCE[0]}")/oscrc.template
mkdir -p $(dirname "$CONFIG_FILE")
sed -e "s/@OBS_USER@/$OBS_USER/g" -e "s/@OBS_PASSWORD@/$OBS_PASSWORD/g" "$TEMPLATE" > "$CONFIG_FILE"
