#!/usr/bin/bash
#
# Copyright (c) [2024] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation; either version 2 of the License, or (at your option)
# any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

# This script runs the user-defined Agama init scripts.

: "${SCRIPTS_DIR:=/var/log/agama-installation/scripts/init}"

systemctl disable agama-scripts.service

if [ ! -d "$SCRIPTS_DIR" ]; then
    exit 0
fi

SCRIPTS=$(find "$SCRIPTS_DIR" -maxdepth 1 -type f | sort)

if [ -z "$SCRIPTS" ]; then
    exit 0
fi

LOG_DIR="$SCRIPTS_DIR/log"
mkdir -p "$LOG_DIR"

IFS='
'
for script in $SCRIPTS; do
    BASENAME=$(basename "$script")
    ./"$script" > "$LOG_DIR/$BASENAME.log" 2>&1
done
