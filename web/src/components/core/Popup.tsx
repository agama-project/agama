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

import React, { useId } from "react";
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
import { AnnouncerTarget } from "~/context/announcer";
import { _, TranslatedString } from "~/i18n";

/** Props for an action, which always picks its own PF/Button variant */
type ActionProps = React.PropsWithChildren<Omit<ButtonProps, "variant">>;
/** Props for an action that can also be rendered as a link */
type SecondaryActionProps = ActionProps & {
  /** Whether to render the action as a link instead of an outlined button */
  asLink?: boolean;
};
type PopupBaseProps = {
  /** Extra content to be placed in the header after the title */
  titleAddon?: React.ReactNode;
  /** Buttons for the dialog footer. Without them, no footer is rendered. */
  actions?: React.ReactNode;
  /** Whether it should display a loading indicator instead of the requested content. */
  isLoading?: boolean;
  /** Text displayed when `isLoading` is set to `true` */
  loadingText?: TranslatedString;
} & Omit<ModalProps, "title" | "size" | "ref" | "aria-label"> &
  Pick<ModalHeaderProps, "description" | "titleIconVariant">;

/**
 * A dialog named by its visible title.
 */
type TitledPopupProps = PopupBaseProps & {
  /** The dialog title, rendered in the header and used as the dialog name */
  title: ModalHeaderProps["title"];
  "aria-label"?: never;
};

/**
 * A dialog with no visible title, named by an invisible label instead.
 */
type LabeledPopupProps = PopupBaseProps & {
  title?: never;
  /** The dialog name, for dialogs rendering no title */
  "aria-label": string;
};

/**
 * Every dialog must be named. Either it renders a `title`, which becomes its
 * name, or it provides an `aria-label`.
 */
export type PopupProps = TitledPopupProps | LabeledPopupProps;

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
const PrimaryAction = ({ children, ...actionProps }: ActionProps) => (
  <Button {...actionProps} variant="primary">
    {children}
  </Button>
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
const Confirm = ({ children = _("Confirm"), ...actionProps }: ActionProps) => (
  <PrimaryAction {...actionProps}>{children}</PrimaryAction>
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
const SecondaryAction = ({ children, asLink, ...actionProps }: SecondaryActionProps) => (
  <Button {...actionProps} variant={asLink ? "link" : "secondary"}>
    {children}
  </Button>
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
const Cancel = ({ children = _("Cancel"), ...actionProps }: SecondaryActionProps) => (
  <SecondaryAction {...actionProps}>{children}</SecondaryAction>
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
const AncillaryAction = ({ children, ...actionsProps }: ActionProps) => (
  <Button {...actionsProps} variant="link">
    {children}
  </Button>
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
const DangerousAction = ({ children, ...actionProps }: ActionProps) => (
  <Button {...actionProps} variant="danger">
    {children}
  </Button>
);

/**
 * Agama component for displaying a popup
 *
 * Built on top of {@link https://www.patternfly.org/components/modal PF/Modal}.
 * Its children are the dialog body; footer buttons go in the `actions` prop.
 *
 * @example <caption>Usage example</caption>
 *   <Popup
 *     title="Users"
 *     isOpen={showUserSettings}
 *     actions={
 *       <>
 *         <Popup.PrimaryAction onClick={updateUserSetting}>Confirm</Popup.PrimaryAction>
 *         <Popup.SecondaryAction onClick={cancel}>Cancel</Popup.SecondaryAction>
 *         <Popup.AncillaryAction onClick={turnUserSettingsOff}>
 *           Do not set a user
 *         </Popup.AncillaryAction>
 *       </>
 *     }
 *   >
 *     <UserSettingsForm />
 *   </Popup>
 *
 * @example <caption>Usage example using shortcuts actions</caption>
 *   <Popup
 *     title="Users"
 *     isOpen={showUserSettings}
 *     actions={
 *       <>
 *         <Popup.Confirm onClick={updateUserSetting} />
 *         <Popup.Cancel onClick={cancel} />
 *       </>
 *     }
 *   >
 *     <UserSettingsForm />
 *   </Popup>
 */
const Popup = ({
  title,
  titleAddon,
  titleIconVariant,
  description,
  actions,
  isOpen = false,
  isLoading = false,
  // TRANSLATORS: progress message
  loadingText = _("Loading data..."),
  children,
  ...props
}: PopupProps) => {
  const titleId = useId();
  const contentId = useId();

  return (
    <Modal
      {...props}
      width={props.variant ? undefined : "auto"}
      isOpen={isOpen}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={contentId}
    >
      <AnnouncerTarget />
      {title && (
        <ModalHeader
          labelId={titleId}
          title={title}
          description={description}
          titleIconVariant={titleIconVariant}
          help={titleAddon}
        />
      )}
      <ModalBody id={contentId}>{isLoading ? <Loading text={loadingText} /> : children}</ModalBody>
      {actions && <ModalFooter>{actions}</ModalFooter>}
    </Modal>
  );
};

Popup.PrimaryAction = PrimaryAction;
Popup.DangerousAction = DangerousAction;
Popup.Confirm = Confirm;
Popup.SecondaryAction = SecondaryAction;
Popup.Cancel = Cancel;
Popup.AncillaryAction = AncillaryAction;

export default Popup;
