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
import { Button } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import PlannedChangesPopup from "~/components/storage/storage-page/PlannedChangesPopup";
import { useActions } from "~/hooks/model/proposal/storage";
import { _ } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import type { Storage } from "~/model/proposal";

/** Whether applying the configuration deletes anything. */
function losesData(actions: Storage.Action[]): boolean {
  return actions.some((a) => a.delete && !a.subvol);
}

/**
 * The sentence that sums up the result: what applying the configuration takes.
 *
 * Its subject is the act of applying the configuration, so in translation the
 * verb never has to agree with the count.
 *
 * The count comes from the calculated actions, so it states what will happen
 * rather than what the configuration asked for.
 */
function summaryOf(actions: Storage.Action[]): TranslatedString {
  return losesData(actions)
    ? _("The configuration will be applied during installation with potential data loss")
    : _("The configuration will be applied during installation with no expected data loss");
}

export type ConsequencesProps = {
  /** What the button opening the popup says. "Details…" if not given. */
  label?: React.ReactNode;
  /** The name of the button for assistive technologies, starting with its visible words. */
  "aria-label"?: string;
};

/**
 * A button opening what the current storage configuration will do to the
 * disks: the final layout and the full list of actions, in a popup.
 */
export default function Consequences({
  label,
  "aria-label": ariaLabel,
}: ConsequencesProps): React.ReactNode {
  const actions = useActions();
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button variant="tertiary" size="sm" aria-label={ariaLabel} onClick={() => setIsOpen(true)}>
        {/* TRANSLATORS: opens a popup with the layout the disks will have and
            the actions needed to get there. */}
        {label || _("Details…")}
      </Button>
      {isOpen && (
        <Popup
          isOpen
          // TRANSLATORS: title of the popup with the layout the disks will have
          // and the actions needed to get there. "Planned" because nothing is
          // applied until the installation starts.
          title={_("Planned storage changes")}
          description={summaryOf(actions)}
          variant="large"
          onClose={close}
          actions={<Popup.Close />}
        >
          <PlannedChangesPopup />
        </Popup>
      )}
    </>
  );
}

export { summaryOf, losesData };
