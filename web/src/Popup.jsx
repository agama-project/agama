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
 * Wrapper component for holding Popup actions
 *
 * Useful and required for placing the components to be used as PF4/Modal actions, usually a
 * Popup.Action or PF4/Button
 *
 * @see Popup examples.
 *
 * @param {React.ReactNode} [props.children] - a collection of Action components
 */
const Actions = ({ children }) => <>{children}</>;

/**
 * A convenient component representing a Popup action
 *
 * Built on top of { @link https://www.patternfly.org/v4/components/button PF4/Button }
 *
 * @see Popup examples.
 *
 * @param {React.ReactNode} props.children - content of the action
 * @param {object} [props] - PF4/Button props, see { @link https://www.patternfly.org/v4/components/button#props }
 */
const Action = ({ children, ...props }) => (
  <Button { ...props }>
    {children}
  </Button>
);

/**
 * A Popup primary action
 *
 * It always set `variant` { @link https://www.patternfly.org/v4/components/button PF4/Button }
 * prop to "primary", no matter what given in `props`.
 *
 * @example
 *   <PrimaryAction onClick={doSomething}>Let's go</PrimaryAction>
 *
 * @example
 *   <PrimaryAction onClick={upload}>
 *     <UploadIcon />
 *     <Text>Upload</Text>
 *   </PrimaryAction>
 *
 * @param {React.ReactNode} props.children - content of the action
 * @param {object} [props] - { @link Action } props
 */
const PrimaryAction = ({ children, ...props }) => (
  <Action { ...props } variant="primary">{ children }</Action>
);

/**
 * Shortcut for the primary "Confirm" action
 *
 * @example
 *   <Confirm onClick={confirm} />
 *
 * @example
 *   <Confirm onClick={accept}>Accept</Confirm>
 *
 * @param {React.ReactNode} [props.children="confirm"] - content of the action
 * @param {object} [props] - { @link Action } props
 */
const Confirm = ({ children = "Confirm", ...props }) => (
  <PrimaryAction key="confirm" { ...props }>{ children }</PrimaryAction>
);

/**
 * A Popup secondary action
 *
 * It always set `variant` { @link https://www.patternfly.org/v4/components/button PF4/Button }
 * prop to "secondary", no matter what given in `props`.
 *
 * @example
 *   <SecondaryAction onClick={cancel}>Cancel</SecondaryAction>
 *
 * @example
 *   <SecondaryAction onClick={upload}>
 *     <DismissIcon />
 *     <Text>Dismiss</Text>
 *   </SecondaryAction>
 *
 * @param {React.ReactNode} props.children - content of the action
 * @param {object} [props] - { @link Action } props
 */
const SecondaryAction = ({ children, ...props }) => (
  <Action { ...props } variant="secondary">{ children }</Action>
);

/**
 * Shortcut for the secondary "Cancel" action
 *
 * @example
 *   <Cancel onClick={cancel} />
 *
 * @example
 *   <Cancel onClick={dissmiss}>Dismiss</Confirm>
 *
 * @param {React.ReactNode} [props.children="Cancel"] - content of the action
 * @param {object} [props] - { @link Action } props
 */
const Cancel = ({ children = "Cancel", ...props }) => (
  <SecondaryAction key="cancel" { ...props }>{ children }</SecondaryAction>
);

/**
 * A Popup tertiary action, rendered as a link
 *
 * It always set `variant` { @link https://www.patternfly.org/v4/components/button PF4/Button } prop
 * to "link", no matter what is given in `props`
 *
 * @example
 *   <TertiaryAction onClick={turnUserSeettingsOff}>Do not set this</TertiaryAction>
 *
 * @example
 *   <TertiaryAction onClick={turnUserSettingsOff}>
 *     <Removeicon />
 *     <Text>Do not set</Text>
 *   </TertiaryAction>
 *
 * @param {React.ReactNode} props.children - content of the action
 * @param {object} [props] - { @link Action } props
 */
const TertiaryAction = ({ children, ...props }) => (
  <Action { ...props } variant="link">{ children }</Action>
);

/**
 * D-Installer component for displaying a popup
 *
 * Built on top of { @link https://www.patternfly.org/v4/components/modal PF4/Modal }, it manipulate
 * the children object for extraction {Actions} from there.
 *
 * @example
 *   <Popup
 *     title="User Settings"
 *     isOpen={showUserSettings}
 *   >
 *     <UserSettingsForm />
 *     <Popup.Actions>
 *       <Popup.PrimaryAction onClick={updateUserSetting}>Confirm</Popup.PrimaryAction>
 *       <Popup.SecondaryAction onClick={cancel}>Cancel</Popup.SecondaryAction>
 *     </Popup.Actions>
 *   </Popup>
 *
 * @example
 *   <Popup
 *     title="User Settings"
 *     isOpen={showUserSettings}
 *   >
 *     <UserSettingsForm />
 *     <Popup.Actions>
 *       <Popup.Confirm onClick={updateUserSetting} />
 *       <Popup.Cancel onClick={cancel} />
 *     </Popup.Actions>
 *   </Popup>
 *
 * @param {object} props - component props
 * @param {boolean} [props.isOpen=false] - whether the popup is displayed or not
 * @param {boolean} [props.showClose=false] - whether the popup should include a "X" action for closing it
 * @param {string} [props.variant="small"] - the popup size, based on Pf4/Modal `variant` prop
 * @param {React.ReactNode} props.children - the popup content and actions
 * @param {object} [pf4ModalProps] - PF4/Modal props, See { @link https://www.patternfly.org/v4/components/modal#props }
 *
 */
const Popup = ({ isOpen = false, showClose = false, variant = "small", children, ...pf4ModalProps }) => {
  const flattenChildren = React.Children.toArray(children);
  const content = flattenChildren.filter(child => child.type !== Actions);
  const actions = flattenChildren.filter(child => child.type === Actions);

  return (
    <Modal
      isOpen={isOpen}
      showClose={showClose}
      variant={variant}
      actions={actions}
      { ...pf4ModalProps }
    >
      { content }
    </Modal>
  );
};

Popup.Actions = Actions;
Popup.PrimaryAction = PrimaryAction;
Popup.Confirm = Confirm;
Popup.SecondaryAction = SecondaryAction;
Popup.Cancel = Cancel;
Popup.TertiaryAction = TertiaryAction;

export default Popup;
