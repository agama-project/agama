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
import { Connection } from "~/types/network";
import { SwitchEnhanced } from "~/components/core";
import { _ } from "~/i18n";
import { useConfigMutation } from "~/queries/network";
import { useNetworkProposal } from "~/queries/proposal";
import { Config } from "~/types/config";

type InstallationOnlySwitchProps = {
  /** The connection to configure as installation-only or not */
  connection: Connection;
};

/**
 * A switch for setting a network connection as "installation only".
 *
 * Intended to mark connections as transient (used only during
 * OS installation) or persistent (persisted to the installed system)
 *
 */
export default function InstallationOnlySwitch({ connection }: InstallationOnlySwitchProps) {
  const proposal = useNetworkProposal();
  const updatedConnection = new Connection(connection.id, {
    ...connection,
    persistent: !connection.persistent,
  });
  const { mutateAsync: updateConfig } = useConfigMutation();
  const onChange = () => {
    proposal.addOrUpdateConnection(updatedConnection);
    const config: Config = { network: proposal.toApi() };

    updateConfig(config);
  };

  return (
    <SwitchEnhanced
      label={_("Use for installation only")}
      description={_(
        "The connection will be used only during installation and not available in the installed system.",
      )}
      onChange={onChange}
      isChecked={!connection.persistent}
    />
  );
}
