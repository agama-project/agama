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
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import type { NoRoomReason } from "~/components/storage/storage-page/queries";

export type DeviceSummaryProps = {
  /** The device the whole configuration is about, as the reader knows it. */
  name: string;
  /** What stopped the installer, of the things this page can see. */
  reason: NoRoomReason;
};

/**
 * What the storage page says about the one device its configuration is about,
 * where the installer could not work out a layout for it.
 *
 * The installer reports the failure and not its cause, so a page that only
 * passes that on leaves the reader with nothing to press. Naming the decision
 * that produced it turns the report into an instruction: not "no layout could
 * be calculated" but "everything on vdd is being kept, so allow the installer
 * to shrink or delete what is there".
 *
 * Each case names the way out as well as the cause, and both ways out are
 * offered on the page: the decision above this line, and the offer under it.
 */
export default function DeviceSummary({ name, reason }: DeviceSummaryProps): React.ReactNode {
  if (reason === "keptContent") {
    return (
      <Alert
        isInline
        variant="danger"
        component="h3"
        title={sprintf(
          // TRANSLATORS: said where the installation does not fit on the only
          // disk it was given. %s is a device name, such as "vdd".
          _("There is not enough room on %s for the new system"),
          name,
        )}
      >
        <Content component="p">
          {sprintf(
            // TRANSLATORS: why the installation does not fit, and what to do
            // about it. %s is a device name, such as "vdd".
            _(
              "Everything on %s is being kept, and what is left over is not enough. Allow the installer to shrink or delete what is there, or install on another device.",
            ),
            name,
          )}
        </Content>
      </Alert>
    );
  }

  return (
    <Alert
      isInline
      variant="danger"
      component="h3"
      title={sprintf(
        // TRANSLATORS: said where the only disk the installation was given has
        // no room on it at all. %s is a device name, such as "vdd".
        _("%s is too small for the new system"),
        name,
      )}
    >
      <Content component="p">
        {/* TRANSLATORS: what to do about a disk with no room on it. */}
        {_("Install on another device, or add one to the plan.")}
      </Content>
    </Alert>
  );
}
