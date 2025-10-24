/*
 * Copyright (c) [2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Alert } from "@patternfly/react-core";
import { useConnections } from "~/queries/network";
import { Connection } from "~/types/network";
import { _ } from "~/i18n";

/**
 * Displays a warning alert when no network connections are set to persist in
 * the installed system.
 */
export default function NoPersistentConnectionsAlert() {
  const connections: Connection[] = useConnections();
  const persistentConnections: number = connections.filter((c) => c.persistent).length;

  if (persistentConnections !== 0) return;

  return (
    <Alert variant="custom" title={_("Installed system may not have network connections")}>
      {_(
        "All network connections managed through this interface are currently set to be \
used only during installation and will not be copied to the installed system",
      )}
    </Alert>
  );
}
