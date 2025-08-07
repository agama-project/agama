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

import React, { useEffect, useState } from "react";
import { Content } from "@patternfly/react-core";
import { useInstallerClient } from "~/context/installer";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";
import { locationReload } from "~/utils";
import Popup, { PopupProps } from "~/components/core/Popup";

type AlertOutOfSyncProps = Partial<Omit<PopupProps, "title" | "isOpen" | "backdropClassName">> & {
  /**
   * The scope to listen for change events on (e.g., `SoftwareProposal`,
   * `L10nConfig`).
   */
  scope: string;
};

/**
 * Reactive alert shown when the configuration for a given scope has been changed externally.
 *
 * It warns that the interface may be out of sync and forces reloading before continuing to avoid
 * issues and data loss.
 *
 * It works by listening for "Changed" events on the specified scope and displays a popup if the
 * event originates from a different client (based on client ID).
 *
 * @example
 * ```tsx
 * <AlertOutOfSync scope="SoftwareProposal" />
 * ```
 */
export default function AlertOutOfSync({ scope, ...alertProps }: AlertOutOfSyncProps) {
  const client = useInstallerClient();
  const [active, setActive] = useState(false);
  const missingScope = isEmpty(scope);

  useEffect(() => {
    if (missingScope) return;

    return client.onEvent((event) => {
      event.type === `${scope}Changed` && setActive(event.clientId !== client.id);
    });
  });

  if (missingScope) {
    console.error("AlertOutOfSync must receive a value for `scope` prop");
    return;
  }

  const title = _("Configuration out of sync");

  return (
    <Popup
      {...alertProps}
      title={title}
      isOpen={active}
      backdropClassName="agm-backdrop-gray-and-blur"
    >
      <Content component="p">{_("The configuration has been updated externally.")}</Content>
      <Content component="p">
        {_("Reloading is required to get the latest data and avoid issues or data loss.")}
      </Content>
      <Popup.Actions>
        <Popup.Confirm onClick={locationReload}>{_("Reload now")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
