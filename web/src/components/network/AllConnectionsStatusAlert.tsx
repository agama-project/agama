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
import { Alert, Button, Content } from "@patternfly/react-core";
import { _ } from "~/i18n";

// TODO: find a better name and add the onClick action
const MakeTransient = () => {
  return (
    <Button variant="control" size="sm">
      {_("Set all for installation only")}
    </Button>
  );
};

// TODO: find a better name and add the onClick action
const MakePermament = () => {
  return (
    <Button variant="control" size="sm">
      {_("Set all to be available in the installed system")}
    </Button>
  );
};

type AllConnectionsStatusAlertProp = {
  /**
   * Indicates the overall state of the connections' persistence configuration:
   *   - "full-transient": All connections are set for temporary use during installation only.
   *   - "full-persistent": All connections are configured to be available in the installed system too.
   *   - "mixed": A mix of persistent and transient connections is present.
   */
  mode: "full-transient" | "full-persistent" | "mixed";

  /** The total number of defined network connections. */
  connections: number;
};

/**
 * Displays a contextual alert to inform users about the full transient, full
 * persistence or mixed status of defined network connections.
 *
 * Depending on the provided mode, the alert will:
 * - Show a warning if no connections will be available in the installed system ("full-transient" mode).
 * - Show a custom alert if all connections will be available ("full-persistent" mode).
 * - Show a custom alert if the connections are mixed between the two ("mixed" mode).
 *
 * This alert includes optional actions to change all connection configurations
 * in bulk — either to be saved in the installed system or to be used only
 * during installation.
 *
 * The alert is hidden when there is only one connection and the mode is not
 * "full-transient", to avoid showing an unnecessary bulk action prompt.
 *
 */
export default function AllConnectionsStatusAlert({
  mode,
  connections,
}: AllConnectionsStatusAlertProp) {
  // If there is only one connection and not in mode "all transient" let's not
  // bother users with the warning with a kind of useless "bulk" action in such
  // a context.
  if (mode !== "full-transient" && connections === 1) return;

  const titles = {
    "full-transient": _("No connections will be available in the installed system"),
    "full-persistent": _("All connections will be available in the installed system"),
    mixed: _("Some connections will be available in the installed system."),
  };

  const descriptions = {
    "full-transient": _(
      "All connections are currently set for installation only and will not be available in the installed system.",
    ),
    "full-persistent": _("All defined connections will be available in the installed system."),
    mixed: _(
      "Some connections will be available in the installed system, and others will be used only during installation.",
    ),
  };

  return (
    <Alert
      title={titles[mode]}
      variant={mode === "full-transient" ? "warning" : "custom"}
      isPlain={mode !== "full-transient"}
      actionLinks={[
        ["full-transient", "mixed"].includes(mode) && <MakePermament key="permanent" />,
        ["full-persistent", "mixed"].includes(mode) && <MakeTransient key="transient" />,
      ]}
    >
      <Content>
        <Content component="p">{descriptions[mode]}</Content>
        <Content>
          {mode === "mixed"
            ? _(
                "You can adjust them individually or apply the change to all using one of the actions below.",
              )
            : _(
                "You can adjust them individually or apply the change to all using the action below.",
              )}
        </Content>
      </Content>
    </Alert>
  );
}
