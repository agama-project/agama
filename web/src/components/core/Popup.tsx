/*
 * Copyright (c) [2022-2026] SUSE LLC
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
  /** Whether the dialog is displayed */
  isOpen: boolean;
  /** Extra content to be placed in the header after the title */
  titleAddon?: React.ReactNode;
  /** Buttons for the dialog footer. Without them, no footer is rendered. */
  actions?: React.ReactNode;
  /** Whether it should display a loading indicator instead of the requested content. */
  isLoading?: boolean;
  /** Text displayed when `isLoading` is set to `true` */
  loadingText?: TranslatedString;
} & Omit<ModalProps, "title" | "size" | "ref" | "aria-label" | "isOpen"> &
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
 * The action the dialog suggests, rendered as a "primary"
 * {@link https://www.patternfly.org/components/button PF/Button}.
 *
 * Use at most one per dialog.
 *
 * @example <caption>Simple usage</caption>
 *   <PrimaryAction onClick={doSomething}>Let's go</PrimaryAction>
 *
 * @example <caption>With an icon</caption>
 *   <PrimaryAction onClick={upload}>
 *     <UploadIcon />
 *     <Text>Upload</Text>
 *   </PrimaryAction>
 *
 * @example <caption>Submitting a form rendered in the dialog body</caption>
 *   <PrimaryAction type="submit" form="user-settings">Accept</PrimaryAction>
 */
const PrimaryAction = ({ children, ...actionProps }: ActionProps) => (
  <Button {...actionProps} variant="primary">
    {children}
  </Button>
);

/**
 * A {@link PrimaryAction} labeled "Confirm" unless told otherwise.
 *
 * @example <caption>Using the default text</caption>
 *   <Confirm onClick={confirm} />
 *
 * @example <caption>Using a custom text</caption>
 *   <Confirm onClick={accept}>Accept</Confirm>
 */
const Confirm = ({ children = _("Confirm"), ...actionProps }: ActionProps) => (
  <PrimaryAction {...actionProps}>{children}</PrimaryAction>
);

/**
 * An alternative to the primary action, rendered as a "secondary"
 * {@link https://www.patternfly.org/components/button PF/Button} or, with
 * `asLink`, as a plain link.
 *
 * @example <caption>Simple usage</caption>
 *   <SecondaryAction onClick={cancel}>Cancel</SecondaryAction>
 *
 * @example <caption>With an icon</caption>
 *   <SecondaryAction onClick={dismiss}>
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
 * A {@link SecondaryAction} labeled "Cancel" unless told otherwise.
 *
 * @example <caption>Using the default text</caption>
 *   <Cancel onClick={cancel} />
 *
 * @example <caption>Using a custom text</caption>
 *   <Cancel onClick={dismiss}>Dismiss</Cancel>
 */
const Cancel = ({ children = _("Cancel"), ...actionProps }: SecondaryActionProps) => (
  <SecondaryAction {...actionProps}>{children}</SecondaryAction>
);

/**
 * A side action that leaves the main choice aside, rendered as a "link"
 * {@link https://www.patternfly.org/components/button PF/Button} to keep it
 * visually apart from the primary and secondary ones.
 *
 * @example <caption>Simple usage</caption>
 *   <AncillaryAction onClick={turnUserSettingsOff}>Do not set this</AncillaryAction>
 *
 * @example <caption>With an icon</caption>
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
 * A destructive action, rendered as a "danger"
 * {@link https://www.patternfly.org/components/button PF/Button}.
 *
 * Use it instead of {@link PrimaryAction} when confirming means losing data.
 *
 * @example <caption>Simple usage</caption>
 *   <DangerousAction onClick={format}>Format</DangerousAction>
 */
const DangerousAction = ({ children, ...actionProps }: ActionProps) => (
  <Button {...actionProps} variant="danger">
    {children}
  </Button>
);

/**
 * Agama component for displaying a dialog, built on top of
 * {@link https://www.patternfly.org/components/modal PF/Modal}.
 *
 * Its children are the dialog body; the buttons closing it go in the `actions`
 * prop, which renders them in the footer. Without actions, no footer renders.
 *
 * Every dialog must be named, either by the `title` it renders or, when it
 * renders none, by an `aria-label`.
 *
 * Dialogs come in two flavors, told apart by the `onClose` callback:
 *
 *   - Dismissible: `onClose` given, so the dialog offers a close button and
 *     reacts to the Escape key. Use it when walking away leaves the user where
 *     they were, like a settings or a selection dialog.
 *   - Must-answer: no `onClose`, so the only way out is one of the actions.
 *     Use it when the flow cannot continue until the user decides, like an
 *     installer question.
 *
 * Prefer mounting it only while the dialog is needed, with `isOpen` hardcoded
 * to true, over keeping it mounted and toggling `isOpen`. That way the dialog
 * content, and any effect it runs, exists exactly while the dialog is on
 * screen.
 *
 * Set `isLoading` while the dialog is waiting for the data its body needs. The
 * dialog then shows a progress message in place of the content, which allows
 * opening it right away instead of blocking the interaction that requested it.
 *
 * @example <caption>A must-answer dialog</caption>
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
 * @example <caption>A dismissible dialog using the action shortcuts</caption>
 *   <Popup
 *     title="Users"
 *     isOpen={showUserSettings}
 *     onClose={cancel}
 *     actions={
 *       <>
 *         <Popup.Confirm onClick={updateUserSetting} />
 *         <Popup.Cancel onClick={cancel} />
 *       </>
 *     }
 *   >
 *     <UserSettingsForm />
 *   </Popup>
 *
 * @example <caption>A dialog holding a form, submitted by its primary action</caption>
 *   <Popup
 *     title="Users"
 *     isOpen={showUserSettings}
 *     actions={
 *       <>
 *         <Popup.Confirm type="submit" form="user-settings" />
 *         <Popup.Cancel onClick={cancel} />
 *       </>
 *     }
 *   >
 *     <UserSettingsForm id="user-settings" onSubmit={updateUserSetting} />
 *   </Popup>
 */
const Popup = ({
  title,
  titleAddon,
  titleIconVariant,
  description,
  actions,
  isOpen,
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

export { Popup };
