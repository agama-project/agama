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
import { sprintf } from "sprintf-js";
import AlertWithDetailsPopup from "~/components/core/AlertWithDetailsPopup";
import PlannedChangesPopup from "~/components/storage/storage-page/PlannedChangesPopup";
import { useActions } from "~/hooks/model/proposal/storage";
import { _, n_ } from "~/i18n";

/**
 * The sentence that sums up the result: what applying the configuration takes.
 *
 * Its subject is the act of applying the configuration, so in translation the
 * verb never has to agree with the count.
 */
function Summary({ count }: { count: number }) {
  return sprintf(
    n_(
      "Applying the configuration below will take %d action during installation.",
      "Applying the configuration below will take %d actions during installation.",
      count,
    ),
    count,
  );
}

/**
 * What the current storage configuration will do to the disks: one line saying
 * how many actions it takes, and the way to the final layout and the full list
 * of actions.
 *
 * The count comes from the calculated actions, so it states what will happen
 * rather than what the configuration asked for.
 */
export default function Consequences(): React.ReactNode {
  const actions = useActions();

  /* Subvolumes are how one file system is laid out inside itself, so counting
     them tells a reader how the installer works rather than what it will do. */
  const counted = actions.filter((action) => !action.subvol);

  return (
    <AlertWithDetailsPopup
      variant="custom"
      title={<Summary count={counted.length} />}
      // TRANSLATORS: opens a popup with the layout the disks will have after
      // installation and the actions needed to get there.
      actionLabel={_("View changes")}
      // TRANSLATORS: title of the popup with the layout the disks will have and
      // the actions needed to get there. "Planned" because nothing is applied
      // until the installation starts.
      popupTitle={_("Planned storage changes")}
      // TRANSLATORS: says what the popup with the planned storage changes is for.
      popupDescription={_("Result of applying the current storage configuration to the system")}
      popupVariant="large"
    >
      <PlannedChangesPopup />
    </AlertWithDetailsPopup>
  );
}
