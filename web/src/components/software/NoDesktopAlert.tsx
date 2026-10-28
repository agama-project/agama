/*
 * Copyright (c) [2026] SUSE LLC
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
import { Alert, Content } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Interpolate from "~/components/core/Interpolate";
import { useAvailablePatterns } from "~/hooks/model/system/software";
import { SOFTWARE } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Alerts the user that no desktop environment is selected and offers a
 * direct link to the software section so a desktop can be picked without
 * having to cancel the current flow manually.
 *
 * Intended for confirmation dialogs on products that suggest a desktop.
 *
 * Returns `null` when no desktop patterns are available, preventing the alert
 * from suggesting an action that is impossible to complete.
 */
export default function NoDesktopAlert() {
  const { desktops } = useAvailablePatterns();

  if (desktops.length === 0) return null;

  return (
    <Alert
      isInline
      variant="custom"
      // TRANSLATORS: alert title shown in the install confirmation dialog when no desktop is selected.
      title={_("No desktop selected")}
    >
      <Content component="p" isEditorial>
        {/* TRANSLATORS: explains the consequence of installing without a desktop. */}
        {_("The system will boot to a command-line interface.")}
      </Content>
      <Content component="p">
        <Interpolate
          // TRANSLATORS: suggests the action to take if a desktop is wanted.
          // The text inside [] becomes a link that navigates to the software section.
          sentence={_(
            "If that is not intended, cancel and select a desktop in the [software] settings.",
          )}
        >
          {(text) => (
            <Link to={SOFTWARE.root} variant="link" isInline>
              {text}
            </Link>
          )}
        </Interpolate>
      </Content>
    </Alert>
  );
}
