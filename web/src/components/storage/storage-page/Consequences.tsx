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
import { Button, Tooltip } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Popup from "~/components/core/Popup";
import { useDockPanel } from "~/components/layout/SideDock";
import ResultPreview from "~/components/storage/storage-page/ResultPreview";
import Text from "~/components/core/Text";
import { useUnseenChanges } from "~/components/storage/storage-page/use-unseen-changes";
import { useActions } from "~/hooks/model/proposal/storage";
import { sprintf } from "sprintf-js";
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
  /**
   * Fitted into the line of text it follows, rather than at a button's
   * regular size. True if not given.
   */
  isCompact?: boolean;
};

/**
 * A button opening what the current storage configuration will do to the
 * disks: the final layout and the full list of actions, in a popup.
 */
export default function Consequences({
  label,
  "aria-label": ariaLabel,
  isCompact = true,
}: ConsequencesProps): React.ReactNode {
  const actions = useActions();
  const [isOpen, setIsOpen] = React.useState(false);
  const { hasUnseenChanges, markSeen } = useUnseenChanges();
  const dockPanel = useDockPanel();
  const close = () => setIsOpen(false);
  // TRANSLATORS: name and tooltip of a button in the storage result preview
  // popup: closes it and keeps its content in a panel beside the settings.
  const pinLabel = _("Pin beside the page");
  const pin = () => {
    close();
    dockPanel();
  };
  const open = () => {
    markSeen();
    setIsOpen(true);
  };

  /* What changes while the popup is open is seen as it happens. */
  React.useEffect(() => {
    if (isOpen && hasUnseenChanges) markSeen();
  }, [isOpen, hasUnseenChanges, markSeen]);

  /* The dot is only what the eye catches; the name says the same in words,
     after the visible ones, so it still starts with what is on the button. */
  const name =
    ariaLabel && hasUnseenChanges
      ? // TRANSLATORS: name of the "Details" button for screen readers when
        // the planned changes differ from the ones last reviewed. %s is its
        // usual name, such as "Details of the planned storage changes".
        sprintf(_("%s (updated)"), ariaLabel)
      : ariaLabel;

  return (
    <>
      <span className="agm-unseen-dot-anchor">
        <Button
          variant="tertiary"
          size="sm"
          className={isCompact ? "agm-summary__details" : undefined}
          aria-label={name}
          onClick={open}
        >
          {/* TRANSLATORS: opens a popup with the layout the disks will have
              and the actions needed to get there. */}
          {label || _("Details…")}
          {!ariaLabel && hasUnseenChanges && (
            <Text srOnly>
              {
                // TRANSLATORS: hidden hint read after "Details" when the
                // planned storage changes differ from the ones last reviewed.
                _(" (updated)")
              }
            </Text>
          )}
        </Button>
        {hasUnseenChanges && <span className="agm-unseen-dot" aria-hidden />}
      </span>
      {isOpen && (
        <Popup
          isOpen
          // TRANSLATORS: title of the popup with the layout the disks will have
          // and the actions needed to get there. "Preview" because nothing is
          // applied until the installation starts.
          title={_("Storage result preview")}
          description={summaryOf(actions)}
          variant="large"
          onClose={close}
          titleAddon={
            dockPanel && (
              /* Next to the popup's own close button, with the icon the page
                 uses to dock the same content. */
              <Tooltip content={pinLabel} aria="none">
                <Button
                  variant="plain"
                  aria-label={pinLabel}
                  icon={<Icon name="right_panel_open" />}
                  onClick={pin}
                />
              </Tooltip>
            )
          }
          actions={<Popup.Close />}
        >
          <ResultPreview />
        </Popup>
      )}
    </>
  );
}

export { summaryOf, losesData };
