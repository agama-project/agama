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
import { Alert, AlertProps, Button, ModalProps } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";

export type AlertWithDetailsPopupProps = {
  /** How it is presented, from a neutral report to something needing care. */
  variant: AlertProps["variant"];
  /** The one sentence the reader needs first. */
  title: React.ReactNode;
  /** What the action that opens the details says, worded for this alert. */
  actionLabel: React.ReactNode;
  /**
   * The action's name for assistive technologies, where the visible words are
   * too short to stand on their own. It must start with those visible words,
   * so that someone using speech input can say what they see.
   */
  actionAriaLabel?: string;
  /** The title of the popup, which is also its name. */
  popupTitle: React.ReactNode;
  /** A line under the popup title, where the title alone leaves something to say. */
  popupDescription?: React.ReactNode;
  /** How wide the popup is. Without it, the popup takes the width its details need. */
  popupVariant?: ModalProps["variant"];
  /** Actions offered in the popup besides closing it, such as a way to start over. */
  popupActions?: React.ReactNode;
  /** The details, shown in the popup. */
  children: React.ReactNode;
};

/**
 * An alert that fits in one line: a sentence followed by an action that opens
 * the details in a popup.
 *
 * It keeps a page's report short, so the report can stay at the top of the
 * page without pushing down what it is about. Whoever needs more asks for it,
 * and gets it in a popup, which blocks the page until it is closed. The name
 * says so on purpose: the reader is taken out of the page for a moment, which
 * is different from an alert that expands in place.
 *
 * The action is a button drawn as an inline link, not a link. A link goes to
 * an address, which can be copied, reloaded or opened in another tab. The
 * popup has no address of its own, so the action only does something on this
 * page, which is what a button is for.
 *
 * The popup is a dismissible one: it closes with its Close button and with
 * Escape, and closing it puts the reader back on the action that opened it.
 * It is not kept open when the alert goes away.
 *
 * See https://www.patternfly.org/components/alert and
 * https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 *
 * @example <caption>A report with the full list a click away</caption>
 *   <AlertWithDetailsPopup
 *     variant="custom"
 *     title={_("Applying the configuration below will take 8 actions during installation.")}
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
 *     title={_("No storage layout can be calculated with the current settings.")}
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
 *     title={_("Unable to modify the settings.")}
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
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);

  return (
    <>
      <Alert
        isInline
        variant={variant}
        component="p"
        title={
          <>
            {title}{" "}
            <Button
              variant="link"
              isInline
              aria-label={actionAriaLabel}
              onClick={() => setIsOpen(true)}
            >
              {actionLabel}
            </Button>
          </>
        }
      />
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
