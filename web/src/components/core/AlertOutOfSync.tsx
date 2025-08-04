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
import {
  Alert,
  AlertActionCloseButton,
  AlertGroup,
  AlertProps,
  Button,
  Content,
} from "@patternfly/react-core";
import { useInstallerClient } from "~/context/installer";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";
import { locationReload } from "~/utils";

type AlertOutOfSyncProps = Partial<AlertProps> & {
  /**
   * The scope to listen for change events on (e.g., `SoftwareProposal`,
   * `L10nConfig`).
   */
  scope: string;
};

/**
 * Reactive alert shown when the configuration for a given scope has been
 * changed externally.
 *
 * It warns that the interface may be out of sync and recommends reloading
 * before continuing to avoid issues and data loss. Reloading is intentionally
 * left up to the user rather than forced automatically, to prevent confusion
 * caused by unexpected refreshes.
 *
 * It works by listening for "Changed" events on the specified scope:
 *
 * - Displays a toast alert if the event originates from a different client
 *   (based on client ID).
 * - Automatically dismisses the alert if a subsequent event originates from
 *   the current client.
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
    <AlertGroup hasAnimations isToast isLiveRegion aria-live="assertive">
      {active && (
        <Alert
          variant="info"
          title={title}
          actionClose={
            <AlertActionCloseButton
              title={title as string}
              variantLabel={_("Out of sync alert")}
              onClose={() => setActive(false)}
            />
          }
          {...alertProps}
          key={`${scope}-out-of-sync`}
        >
          <Content component="p">
            {_(
              "The configuration has been updated externally. \
Reload the page to get the latest data and avoid issues or data loss.",
            )}
          </Content>
          <Button size="sm" onClick={locationReload}>
            {_("Reload now")}
          </Button>
        </Alert>
      )}
    </AlertGroup>
  );
}
