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

// @ts-check

import React from "react";
import { Button, Modal } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { partition } from "~/utils";

/**
 * @typedef {import("@patternfly/react-core").ModalProps} ModalProps
 * @typedef {import("@patternfly/react-core").ButtonProps} ButtonProps
 * @typedef {Omit<ButtonProps, 'variant'>} ButtonWithoutVariantProps
 */

/**
 * Wrapper component for holding Popup actions
 *
 * Useful and required for placing the components to be used as PF/Modal actions, usually a
 * Popup.Action or PF/Button
 *
 * @see Popup examples.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] - a collection of Action components
 */
const Actions = ({ children }) => <>{children}</>;

/**
 * A convenient component representing a Popup action
 *
 * Built on top of {@link https://www.patternfly.org/components/button PF/Button}
 *
 * @param {ButtonProps} props
 */
const Action = ({ children, ...buttonProps }) => (
  <Button { ...buttonProps }>
    {children}
  </Button>
);

/**
 * A Popup primary action
 *
 * It always set `variant` {@link https://www.patternfly.org/components/button PF/Button}
 * prop to "primary", no matter what given in `props`.
 *
 * @example <caption>Simple usage</caption>
 *   <PrimaryAction onClick={doSomething}>Let's go</PrimaryAction>
 *
 * @example <caption>Advanced usage</caption>
 *   <PrimaryAction onClick={upload}>
 *     <UploadIcon />
 *     <Text>Upload</Text>
 *   </PrimaryAction>
 *
 * @param {ButtonWithoutVariantProps} props
 */
const PrimaryAction = ({ children, ...actionProps }) => (
  <Action { ...actionProps } variant="primary">{ children }</Action>
);

/**
 * Shortcut for the primary "Confirm" action
 *
 * @example <caption>Using it with the default text</caption>
 *   <Confirm onClick={confirm} />
 *
 * @example <caption>Using it with a custom text</caption>
 *   <Confirm onClick={accept}>Accept</Confirm>
 *
 * @param {ButtonWithoutVariantProps} props
 */
const Confirm = ({ children = _("Confirm"), ...actionProps }) => (
  <PrimaryAction key="confirm" { ...actionProps }>{ children }</PrimaryAction>
);

/**
 * A Popup secondary action
 *
 * It always set `variant` {@link https://www.patternfly.org/components/button PF/Button}
 * prop to "secondary", no matter what given in `props`.
 *
 * @example <caption>Simple usage</caption>
 *   <SecondaryAction onClick={cancel}>Cancel</SecondaryAction>
 *
 * @example <caption>Advanced usage</caption>
 *   <SecondaryAction onClick={upload}>
 *     <DismissIcon />
 *     <Text>Dismiss</Text>
 *   </SecondaryAction>
 *
 * @param {ButtonWithoutVariantProps} props
 */
const SecondaryAction = ({ children, ...actionProps }) => (
  <Action { ...actionProps } variant="secondary">{ children }</Action>
);

/**
 * Shortcut for the secondary "Cancel" action
 *
 * @example <caption>Using it with the default text</caption>
 *   <Cancel onClick={cancel} />
 *
 * @example <caption>Using it with a custom text</caption>
 *   <Cancel onClick={dismiss}>Dismiss</Confirm>
 *
 * @param {ButtonWithoutVariantProps} props
 */
const Cancel = ({ children = _("Cancel"), ...actionProps }) => (
  <SecondaryAction key="cancel" { ...actionProps }>{ children }</SecondaryAction>
);

/**
 * A Popup additional action, rendered as a link
 *
 * It always set `variant` {@link https://www.patternfly.org/components/button PF/Button} prop
 * to "link", no matter what is given in `props`
 *
 * @example <caption>Simple usage</caption>
 *   <AncillaryAction onClick={turnUserSettingsOff}>Do not set this</AncillaryAction>
 *
 * @example <caption>Advanced usage</caption>
 *   <AncillaryAction onClick={turnUserSettingsOff}>
 *     <RemoveIcon />
 *     <Text>Do not set</Text>
 *   </AncillaryAction>
 *
 * @param {ButtonWithoutVariantProps} props
 */
const AncillaryAction = ({ children, ...actionsProps }) => (
  <Action { ...actionsProps } variant="link">{ children }</Action>
);

/**
 * Agama component for displaying a popup
 *
 * Built on top of {@link https://www.patternfly.org/components/modal PF/Modal}, it
 * manipulates the children object for extracting {Actions}.
 *
 * @example <caption>Usage example</caption>
 *   <Popup
 *     title="Users"
 *     isOpen={showUserSettings}
 *   >
 *     <UserSettingsForm />
 *     <Popup.Actions>
 *       <Popup.PrimaryAction key="confirm" onClick={updateUserSetting}>Confirm</Popup.PrimaryAction>
 *       <Popup.SecondaryAction key="cancel" onClick={cancel}>Cancel</Popup.SecondaryAction>
 *       <Popup.AncillaryAction key="unset" onClick={turnUserSettingsOff}>
 *         Do not set a user
 *       </Popup.AncillaryAction>
 *     </Popup.Actions>
 *   </Popup>
 *
 * @example <caption>Usage example using shortcuts actions</caption>
 *   <Popup
 *     title="Users"
 *     isOpen={showUserSettings}
 *   >
 *     <UserSettingsForm />
 *     <Popup.Actions>
 *       <Popup.Confirm onClick={updateUserSetting} />
 *       <Popup.Cancel onClick={cancel} />
 *       <Popup.AncillaryAction key="unset" onClick={turnUserSettingsOff}>
 *         Do not set a user
 *       </Popup.AncillaryAction>
 *     </Popup.Actions>
 *   </Popup>
 *
 * @typedef {object} PopupBaseProps
 * @property {"auto" | "small" | "medium" | "large"} [blockSize="auto"] - The block/height size for the dialog. Default is "auto".
 * @property {"auto" | "small" | "medium" | "large"} [inlineSize="medium"] - The inline/width size for the dialog. Default is "medium".
 * @typedef {Omit<ModalProps, "variant" | "size"> & PopupBaseProps} PopupProps
 *
 * @param {PopupProps} props
 */
const Popup = ({
  isOpen = false,
  showClose = false,
  inlineSize = "medium",
  blockSize = "auto",
  className = "",
  children,
  ...props
}) => {
  const [actions, content] = partition(React.Children.toArray(children), child => child.type === Actions);

  return (
    /** @ts-ignore */
    <Modal
      {...props}
      isOpen={isOpen}
      showClose={showClose}
      actions={actions}
      className={`${className} block-size-${blockSize} inline-size-${inlineSize}`.trim()}
    >
      {content}
    </Modal>
  );
};

Popup.Actions = Actions;
Popup.PrimaryAction = PrimaryAction;
Popup.Confirm = Confirm;
Popup.SecondaryAction = SecondaryAction;
Popup.Cancel = Cancel;
Popup.AncillaryAction = AncillaryAction;

export default Popup;
