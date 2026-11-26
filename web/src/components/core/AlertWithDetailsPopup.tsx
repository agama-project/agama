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

import React, { useState } from "react";
import { Alert, AlertProps, Button, ModalProps } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";

export type AlertWithDetailsPopupProps = {
  /** The alert status. */
  variant: AlertProps["variant"];
  /** The alert sentence, written without a final period. */
  title: React.ReactNode;
  /** The label of the button opening the popup. */
  actionLabel: React.ReactNode;
  /**
   * A longer name for the button, for assistive technologies. It must start
   * with the visible label, so speech input users can say what they see.
   */
  actionAriaLabel?: string;
  /** The popup title, which also names it. */
  popupTitle: React.ReactNode;
  /** An optional line under the popup title. */
  popupDescription?: React.ReactNode;
  /** The popup width. Without it, the popup fits its content. */
  popupVariant?: ModalProps["variant"];
  /** Popup actions besides closing it, such as a way to start over. */
  popupActions?: React.ReactNode;
  /** The details shown in the popup. */
  children: React.ReactNode;
};

/**
 * An inline alert of one sentence, followed by a button opening the details in
 * a popup.
 *
 * It keeps the alert short enough to stay at the top of a page. The action is
 * a button rather than a link, since the popup has no address of its own. The
 * popup closes with its Close button or Escape, and focus goes back to the
 * button.
 *
 * @see https://www.patternfly.org/components/alert
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 *
 * @example <caption>A report with the full list a click away</caption>
 *   <AlertWithDetailsPopup
 *     variant="custom"
 *     title={_("Applying the configuration below will take 8 actions during installation")}
 *     actionLabel={_("View changes")}
 *     popupTitle={_("Planned storage changes")}
 *     popupVariant="large"
 *   >
 *     <PlannedChanges />
 *   </AlertWithDetailsPopup>
 *
 * @example <caption>A short action named in full for assistive technologies</caption>
 *   <AlertWithDetailsPopup
 *     variant="warning"
 *     title={_("No storage layout can be calculated with the current settings")}
 *     actionLabel={_("Show more")}
 *     actionAriaLabel={_("Show more about the storage layout")}
 *     popupTitle={_("Storage layout not calculated")}
 *   >
 *     <WhatDoesNotFit />
 *   </AlertWithDetailsPopup>
 *
 * @example <caption>A popup offering a way out besides closing it</caption>
 *   <AlertWithDetailsPopup
 *     variant="info"
 *     title={_("Unable to modify the settings")}
 *     actionLabel={_("See options")}
 *     popupTitle={_("Unsupported configuration")}
 *     popupActions={
 *       <Popup.SecondaryAction onClick={reset}>
 *         {_("Reset to the default configuration")}
 *       </Popup.SecondaryAction>
 *     }
 *   >
 *     <Options />
 *   </AlertWithDetailsPopup>
 */
export default function AlertWithDetailsPopup({
  variant,
  title,
  actionLabel,
  actionAriaLabel,
  popupTitle,
  popupDescription,
  popupVariant,
  popupActions,
  children,
}: AlertWithDetailsPopupProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const action = (
    <Button
      variant="tertiary"
      size="sm"
      aria-label={actionAriaLabel}
      onClick={() => setIsOpen(true)}
    >
      {actionLabel}
    </Button>
  );

  const titleContent = (
    <>
      {title} {action}
    </>
  );

  return (
    <>
      <Alert isInline variant={variant} title={titleContent} />
      {isOpen && (
        <Popup
          isOpen
          title={popupTitle}
          description={popupDescription}
          variant={popupVariant}
          onClose={close}
          actions={
            <>
              <Popup.Close />
              {popupActions}
            </>
          }
        >
          {children}
        </Popup>
      )}
    </>
  );
}
