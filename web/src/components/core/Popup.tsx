/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { isValidElement, useId } from "react";
import {
  Button,
  ButtonProps,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalHeaderProps,
  ModalProps,
} from "@patternfly/react-core";
import { Loading } from "~/components/layout";
import { fork } from "radashi";
import { _, TranslatedString } from "~/i18n";

type ButtonWithoutVariantProps = Omit<ButtonProps, "variant">;
type PredefinedAction = React.PropsWithChildren<ButtonWithoutVariantProps>;
export type PopupProps = {
  /** The dialog title */
  title?: ModalHeaderProps["title"];
  /** Extra content to be placed in the header after the title */
  titleAddon?: React.ReactNode;
  /** Whether it should display a loading indicator instead of the requested content. */
  isLoading?: boolean;
  /** Text displayed when `isLoading` is set to `true` */
  loadingText?: TranslatedString;
} & Omit<ModalProps, "title" | "size"> &
  Pick<ModalHeaderProps, "description" | "titleIconVariant">;

/**
 * Wrapper component for holding Popup actions
 *
 * Useful and required for placing the components to be used as PF/Modal actions, usually a
 * Popup.Action or PF/Button
 *
 * @see Popup examples.
 */
const Actions = ({ children }: React.PropsWithChildren) => <>{children}</>;

/**
 * A convenient component representing a Popup action
 *
 * Built on top of {@link https://www.patternfly.org/components/button PF/Button}
 *
 */
const Action = ({ children, ...buttonProps }: React.PropsWithChildren<ButtonProps>) => (
  <Button {...buttonProps}>{children}</Button>
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
 */
const PrimaryAction = ({ children, ...actionProps }: PredefinedAction) => (
  <Action {...actionProps} variant="primary">
    {children}
  </Action>
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
 */
const Confirm = ({ children = _("Confirm"), ...actionProps }: PredefinedAction) => (
  <PrimaryAction key="confirm" {...actionProps}>
    {children}
  </PrimaryAction>
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
 */
const SecondaryAction = ({ children, ...actionProps }: PredefinedAction) => (
  <Action {...actionProps} variant="secondary">
    {children}
  </Action>
);

/**
 * Shortcut for the secondary "Cancel" action
 *
 * @example <caption>Using it with the default text</caption>
 *   <Cancel onClick={cancel} />
 *
 * @example <caption>Using it with a custom text</caption>
 *   <Cancel onClick={dismiss}>Dismiss</Confirm>
 */
const Cancel = ({ children = _("Cancel"), ...actionProps }: PredefinedAction) => (
  <SecondaryAction key="cancel" {...actionProps}>
    {children}
  </SecondaryAction>
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
 */
const AncillaryAction = ({ children, ...actionsProps }: PredefinedAction) => (
  <Action {...actionsProps} variant="link">
    {children}
  </Action>
);

/**
 * A Popup action with danger variant
 *
 * It always set `variant` {@link https://www.patternfly.org/components/button PF/Button}
 * prop to "danger", no matter what given in `props`.
 *
 * @example <caption>Simple usage</caption>
 *   <DangerousAction onClick={format}>Format</DangerousAction>
 *
 */
const DangerousAction = ({ children, ...actionProps }: PredefinedAction) => (
  <Action {...actionProps} variant="danger">
    {children}
  </Action>
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
 */
const Popup = ({
  title,
  titleAddon,
  titleIconVariant,
  description,
  isOpen = false,
  isLoading = false,
  // TRANSLATORS: progress message
  loadingText = _("Loading data..."),
  children,
  ...props
}: PopupProps) => {
  const [actions, content] = fork(React.Children.toArray(children), (child) =>
    isValidElement(child) ? child.type === Actions : false,
  );

  const titleId = useId();
  const contentId = useId();

  return (
    /** @ts-ignore */
    <Modal
      {...props}
      width={!props.variant && "auto"}
      isOpen={isOpen}
      aria-labelledby={titleId}
      aria-describedby={contentId}
    >
      {title && (
        <ModalHeader
          labelId={titleId}
          title={title}
          description={description}
          titleIconVariant={titleIconVariant}
          help={titleAddon}
        />
      )}
      <ModalBody id={contentId}>{isLoading ? <Loading text={loadingText} /> : content}</ModalBody>
      <ModalFooter>{actions}</ModalFooter>
    </Modal>
  );
};

Popup.Actions = Actions;
Popup.PrimaryAction = PrimaryAction;
Popup.DangerousAction = DangerousAction;
Popup.Confirm = Confirm;
Popup.SecondaryAction = SecondaryAction;
Popup.Cancel = Cancel;
Popup.AncillaryAction = AncillaryAction;

export default Popup;
