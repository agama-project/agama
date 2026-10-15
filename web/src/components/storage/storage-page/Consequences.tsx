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
import SheetOpener from "~/components/storage/shared/SheetOpener";
import StorageAlert from "~/components/storage/shared/StorageAlert";
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
 * What the current storage configuration will do to the disks: a sentence with
 * the number of actions needed as the title, and links to the final layout and
 * to the full list of actions.
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
    <StorageAlert
      variant="custom"
      title={<Summary count={counted.length} />}
      actions={
        <>
          <SheetOpener subject="result" tab="layout" variant="button">
            {/* TRANSLATORS: opens a panel showing how the disks will look after
                installation. */}
            {_("View resulting layout")}
          </SheetOpener>
          <SheetOpener subject="result" tab="actions" variant="button">
            {/* TRANSLATORS: opens a panel listing the steps the installer will
                take on the disks. */}
            {_("Check actions")}
          </SheetOpener>
        </>
      }
    />
  );
}
