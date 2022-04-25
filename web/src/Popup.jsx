/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { Button, Modal } from "@patternfly/react-core";

/**
 * D-Installer component for displaying a popup
 *
 * Built on top of { @link https://www.patternfly.org/v4/components/modal PF4/Modal }, it displays
 * up to three actions according to given params: "Confirm", "Cancel", and "Do not use". All of them
 * can be tweaked via corresponding params, but at least `onConfirm` callback must be provided
 *
 * @example
 *   <Popup
 *     title="User Settings"
 *     isOpen={showUserSettings}
 *     onConfirm={updateUsersSettings}
 *     onCancel={closeUserSettings}
 *     onUnset={unsetUserSettings}
 *     confirmDisabled={username === ""}
 *     confirmText={currentUser ? "Update" : "Confirm"}
 *     unsetText="Use default settings"
 *   >
 *     <UserSettingsForm />
 *   </Popup>
 *
 * @param {object} props - component props
 * @param {boolean} [props.isOpen=false] - whether the popup is displayed or not
 * @param {boolean} [props.showClose=false] - whether the popup should include a "X" action for closing it
 * @param {string} [props.variant="small"] - the popup size, based on Pf4/Modal variant prop
 * @param {"confirm" | "cancel" | "unset" } [props.autoFocusOn] - force autoFocus to the button with given key
 * @param {function} props.onConfirm - function to be triggered when user clicks on confirm action
 * @param {string} [props.confirmText="Confirm"] - text to be used for the confirm action
 * @param {boolean} [props.confirmDisabled=false] - whether the confirm action should be disabled
 * @param {function} [props.onCancel] - function to be triggered when user clicks on cancel action
 * @param {string} [props.cancelText="Cancel"] - text to be used for the cancel action
 * @param {boolean} [props.cancelDisabled=false] - whether the cancel action should be disabled
 * @param {function} [props.onUnset] - function to be triggered when user clicks on unset action
 * @param {string} [props.unsetText="Do not use"] - text to be used for the unset action
 * @param {boolean} [props.unsetDisabled=true] - whether the unset action should be disabled
 * @param {React.ReactNode} [props.children] - the popup content
 * @param {object} [pf4ModalProps] - PF4/Modal props, @see https://www.patternfly.org/v4/components/modal#props
 *
 */
export default function Popup({
  isOpen = false,
  showClose = false,
  variant = "small",
  autoFocusOn,
  onConfirm,
  confirmText = "Confirm",
  confirmDisabled = false,
  onCancel,
  cancelText = "Cancel",
  cancelDisabled = false,
  onUnset,
  unsetText = "Do not use",
  unsetDisabled = true,
  children,
  ...pf4ModalProps
}) {
  const actions = [
    <Button
      key="confirm"
      variant="primary"
      onClick={onConfirm}
      autoFocus={autoFocusOn === "confirm"}
      isDisabled={confirmDisabled}
    >
      {confirmText}
    </Button>
  ];

  if (onCancel) {
    actions.push(
      <Button
        key="cancel"
        variant="secondary"
        onClick={onCancel}
        isDisabled={cancelDisabled}
        autoFocus={autoFocusOn === "cancel"}
      >
        {cancelText}
      </Button>
    );
  }

  if (onUnset) {
    actions.push(
      <Button
        key="unset"
        variant="link"
        onClick={onUnset}
        isDisabled={unsetDisabled}
        autoFocus={autoFocusOn === "unset"}
      >
        {unsetText}
      </Button>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      showClose={showClose}
      variant={variant}
      actions={actions}
      { ...pf4ModalProps }
    >
      { children }
    </Modal>
  );
}
