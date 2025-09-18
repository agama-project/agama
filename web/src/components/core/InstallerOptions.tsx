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

/**
 * This module defines the InstallerOptions component, which allows users to
 * configure installer localization settings, with the option to copy them, when
 * applicable, to the product's localization settings.
 *
 * It supports multiple UI variants (language-only, keyboard-only, or both), and
 * manages both form and dialog state. To avoid scattering complex conditional
 * logic throughout the main component, the implementation is split into several
 * small internal components.
 */

import React, { useReducer } from "react";
import { useHref, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  ButtonProps,
  Checkbox,
  Flex,
  FlexProps,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  FormSelectProps,
} from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { Icon } from "~/components/layout";
import { LocaleConfig } from "~/types/l10n";
import { InstallationPhase } from "~/types/status";
import { useInstallerL10n } from "~/context/installerL10n";
import { keymapsQuery, useConfigMutation, useL10n } from "~/queries/l10n";
import { useInstallerStatus } from "~/queries/status";
import { localConnection } from "~/utils";
import { _ } from "~/i18n";
import supportedLanguages from "~/languages.json";
import { PRODUCT, ROOT, L10N } from "~/routes/paths";
import { useProduct } from "~/queries/software";

/**
 * Props for select inputs
 */
type SelectProps = {
  value: string;
  onChange: FormSelectProps["onChange"];
};

/**
 * Renders a dropdown for language selection.
 */
const LangaugeFormInput = ({ value, onChange }: SelectProps) => (
  <FormGroup fieldId="language" label={_("Language")}>
    <FormSelect id="language" name="language" value={value} onChange={onChange}>
      {Object.keys(supportedLanguages)
        .sort()
        .map((id, index) => (
          <FormSelectOption key={index} value={id} label={supportedLanguages[id]} />
        ))}
    </FormSelect>
  </FormGroup>
);

/**
 * Renders a dropdown for keyboard layout selection.
 *
 * Not available in remote installations.
 */
const KeyboardFormInput = ({ value, onChange }: SelectProps) => {
  const { isPending, data: keymaps } = useQuery(keymapsQuery());
  if (isPending) return;

  if (!localConnection()) {
    return (
      <FormGroup label={_("Keyboard layout")}>
        {_("Cannot be changed in remote installation")}
      </FormGroup>
    );
  }

  return (
    <FormGroup fieldId="keymap" label={_("Keyboard layout")}>
      <FormSelect
        id="keymap"
        name="keymap"
        label={_("Keyboard layout")}
        value={value}
        onChange={onChange}
      >
        {keymaps.map((keymap, index) => (
          <FormSelectOption key={index} value={keymap.id} label={keymap.name} />
        ))}
      </FormSelect>
    </FormGroup>
  );
};

/**
 * Represents the form state.
 */
type FormState = {
  /** The language code */
  language: string;
  /** The keymap code */
  keymap: string;
  /** Whether reusing settings for the product feature is availabler or not */
  allowReusingSettings: boolean;
  /** Whether reuse these settings for the product localization settings too */
  reuseSettings: boolean;
};

/**
 * Supported form actions.
 */
type FormAction =
  | { type: "SET_SELECTED_LANGUAGE"; language: string }
  | { type: "SET_SELECTED_KEYMAP"; keymap: string }
  | { type: "TOGGLE_REUSE_SETTINGS" }
  | { type: "RESET"; state: FormState };

/**
 * Reducer for form state updates.
 */
const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "SET_SELECTED_LANGUAGE": {
      return { ...state, language: action.language };
    }

    case "SET_SELECTED_KEYMAP": {
      return { ...state, keymap: action.keymap };
    }

    case "TOGGLE_REUSE_SETTINGS": {
      return { ...state, reuseSettings: !state.reuseSettings };
    }

    case "RESET": {
      return { ...action.state };
    }
  }
};

/**
 * Supported dialog actions.
 */
type DialogAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_BUSY" }
  | { type: "SET_IDLE" };

/**
 * Represents the dialog state
 */
type DialogState = {
  isOpen: boolean;
  isBusy: boolean;
};

/**
 * Reducer for form state updates.
 */
const dialogReducer = (state: DialogState, action: DialogAction): DialogState => {
  switch (action.type) {
    case "OPEN": {
      return { ...state, isOpen: true };
    }

    case "CLOSE": {
      return { isOpen: false, isBusy: false };
    }

    case "SET_BUSY": {
      return { ...state, isBusy: true };
    }

    case "SET_IDLE": {
      return { ...state, isBusy: false };
    }
  }
};

/**
 * Available actions for handling dialog and form events.
 */
type Actions = {
  handleLanguageChange: (_, v: string) => void;
  handleKeymapChange: (_, v: string) => void;
  handleCopyToSystemToggle: (_, v: boolean) => void;
  handleSubmitForm: (e: React.FormEvent<HTMLFormElement>) => void;
  handleCancellation: () => void;
};

/**
 * Props passed to each dialog variant.
 */
type DialogProps = {
  state: DialogState;
  formState: FormState;
  actions: Actions;
};

/**
 * Defines the available installer options modes:
 *   "all": Allow settings both language and keyboard layout.
 *   "language": Allow setting only language.
 *   "keyboard": Allow settings only keyboard layout.
 */
type InstallerOptionsVariant = "all" | "language" | "keyboard";

/**
 * Props passed to each toggle variant.
 */
type ToggleProps = Pick<ButtonProps, "onClick"> & {
  language?: string;
  keymap?: string;
};

/**
 * A component that conditionally displays content based on whether settings can
 * be reused.
 *
 * If reuse is allowed, the content (children) is rendered.
 * If reuse is not allowed, a fallback message is displayed instead.
 *
 * This component helps avoid repeating the same condition in each form variant,
 * as the fallback message should remain the same for all of them.
 */
const ReusableSettings = ({ isReuseAllowed, children }) => {
  if (isReuseAllowed) {
    return children;
  } else {
    // TRANSLATORS: This message informs users that they are only changing the
    // interface language and/or keyboard settings here. The term "localization"
    // is the name of a separate page where they can configure the localization
    // settings for the product to install.
    return _(
      "This will affect only the installer interface, not the product to be installed. You can adjust the product’s localization later in the Localization settings page.",
    );
  }
};

type TextWithLinkToL10nProps = {
  /** The text containing a bracketed substring for the link. */
  text: string;
  /**
   * Optional handler triggered when the user activates the link. Useful for
   * performing side effects, such as closing the dialog. Navigation may not occur
   * if the user is already on the L10n page. This callback runs regardless of
   * whether navigation happens.
   */
  onClick?: ButtonProps["onClick"];
};

/**
 * Renders a string with an inline link that navigates to the Localization page.
 *
 * The input `text` must include a substring wrapped in square brackets `[ ]`, which will be replaced
 * by a clickable link. The component splits the text into three parts:
 * - The content before `[link text]`
 * - The content inside the brackets (used as the link text)
 * - The content after the brackets
 *
 * Example input:
 *   "You can configure the langauge for the product to install at [Localization page]."
 *
 * @param {text} props - The text containing a bracketed substring for the link.
 */
const TextWithLinkToL10n = ({ text, onClick }: TextWithLinkToL10nProps) => {
  const href = useHref(L10N.root);
  const [textStart, l10nPageLink, textEnd] = text.split(/[[\]]/);

  return (
    <>
      {textStart}{" "}
      <Button component="a" variant="link" href={href} isInline onClick={onClick}>
        {l10nPageLink}
      </Button>{" "}
      {textEnd}
    </>
  );
};

const AllSettingsDialog = ({ state, formState, actions }: DialogProps) => {
  const checkboxDescription = _(
    // TRANSLATORS: Explains where users can find more language and keymap
    // options for the product to install. Keep the text in square brackets []
    // as it will be replaced with a clickable link.
    "More language and keyboard layout options for the selected product may be available in [Localization] page.",
  );

  return (
    <Popup isOpen={state.isOpen} variant="small" title={_("Language and keyboard")}>
      <Form id="installer-l10n" onSubmit={actions.handleSubmitForm}>
        <LangaugeFormInput value={formState.language} onChange={actions.handleLanguageChange} />
        <KeyboardFormInput value={formState.keymap} onChange={actions.handleKeymapChange} />
        <ReusableSettings isReuseAllowed={formState.allowReusingSettings}>
          <FormGroup fieldId="reuse-settings">
            <Checkbox
              id="reuse-settings"
              label={_("Use these same settings for the selected product")}
              description={
                <TextWithLinkToL10n
                  text={checkboxDescription}
                  onClick={actions.handleCancellation}
                />
              }
              isChecked={formState.reuseSettings}
              onChange={actions.handleCopyToSystemToggle}
            />
          </FormGroup>
        </ReusableSettings>
      </Form>

      <Popup.Actions>
        <Popup.Confirm
          form="installer-l10n"
          type="submit"
          autoFocus
          isDisabled={state.isBusy}
          isLoading={state.isBusy}
        >
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={actions.handleCancellation} isDisabled={state.isBusy} />
      </Popup.Actions>
    </Popup>
  );
};

const LanguageOnlyDialog = ({ state, formState, actions }: DialogProps) => {
  const checkboxDescription = _(
    // TRANSLATORS: Explains where users can find more languages options for the
    // product to install. Keep the text in square brackets [] as it will be
    // replaced with a clickable link.
    "More languages might be available for the selected product at [Localization] page",
  );

  return (
    <Popup isOpen={state.isOpen} variant="small" title={_("Change Language")}>
      <Form id="installer-l10n" onSubmit={actions.handleSubmitForm}>
        <LangaugeFormInput value={formState.language} onChange={actions.handleLanguageChange} />
        <ReusableSettings isReuseAllowed={formState.allowReusingSettings}>
          <FormGroup fieldId="reuse-settings">
            <Checkbox
              id="reuse-settings"
              label={_("Use for the selected product too")}
              description={
                <TextWithLinkToL10n
                  text={checkboxDescription}
                  onClick={actions.handleCancellation}
                />
              }
              isChecked={formState.reuseSettings}
              onChange={actions.handleCopyToSystemToggle}
            />
          </FormGroup>
        </ReusableSettings>
      </Form>

      <Popup.Actions>
        <Popup.Confirm
          form="installer-l10n"
          type="submit"
          autoFocus
          isDisabled={state.isBusy}
          isLoading={state.isBusy}
        >
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={actions.handleCancellation} isDisabled={state.isBusy} />
      </Popup.Actions>
    </Popup>
  );
};

const KeyboardOnlyDialog = ({ state, formState, actions }: DialogProps) => {
  if (!localConnection()) {
    return (
      <Popup isOpen={state.isOpen} variant="small" title={_("Change keyboard")}>
        {_("Cannot be changed in remote installation")}
        <Popup.Actions>
          <Popup.Confirm onClick={actions.handleCancellation}>{_("Accept")}</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    );
  }

  const checkboxDescription = _(
    // TRANSLATORS: Explains where users can find more keymap options for the
    // product to install. Keep the text in square brackets [] as it will be
    // replaced with a clickable link.
    "More keymap layout might be available for the selected product at [Localization] page",
  );

  return (
    <Popup isOpen={state.isOpen} variant="small" title={_("Change keyboard")}>
      <Form id="installer-l10n" onSubmit={actions.handleSubmitForm}>
        <KeyboardFormInput value={formState.keymap} onChange={actions.handleKeymapChange} />
        <ReusableSettings isReuseAllowed={formState.allowReusingSettings}>
          <FormGroup fieldId="reuse-settings">
            <Checkbox
              id="reuse-settings"
              label={_("Use for the selected product too")}
              description={
                <TextWithLinkToL10n
                  text={checkboxDescription}
                  onClick={actions.handleCancellation}
                />
              }
              isChecked={formState.reuseSettings}
              onChange={actions.handleCopyToSystemToggle}
            />
          </FormGroup>
        </ReusableSettings>
      </Form>

      <Popup.Actions>
        <Popup.Confirm
          form="installer-l10n"
          type="submit"
          autoFocus
          isDisabled={state.isBusy}
          isLoading={state.isBusy}
        >
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={actions.handleCancellation} isDisabled={state.isBusy} />
      </Popup.Actions>
    </Popup>
  );
};

/** Icon representing the language settings. Used in toggle buttons. */
const LanguageIcon = () => <Icon name="translate" />;

/** Icon representing the keyboard settings. Used in toggle buttons. */
const KeyboardIcon = () => <Icon name="keyboard" />;

/** A layout helper that centers its children with spacing. Used in toggle buttons. */
const CenteredContent = ({
  children,
  alignItems = "alignItemsCenter",
}: React.PropsWithChildren<{ alignItems?: FlexProps["alignItems"]["default"] }>) => (
  <Flex gap={{ default: "gapXs" }} component="span" alignItems={{ default: alignItems }}>
    {children}
  </Flex>
);

/** Toggle button for accessing only language settings. */
const LanguageOnlyToggle = ({ onClick, language }: ToggleProps) => (
  <Button onClick={onClick} aria-label={_("Change display language")} variant="plain">
    <CenteredContent>
      <LanguageIcon /> {language}
    </CenteredContent>
  </Button>
);

/** Toggle button for accessing only keymap settings. */
const KeyboardOnlyToggle = ({ onClick, keymap }: ToggleProps) => (
  <Button onClick={onClick} aria-label={_("Change keyboard layout")} variant="plain">
    <CenteredContent alignItems="alignItemsFlexEnd">
      <KeyboardIcon /> <code>{keymap}</code>
    </CenteredContent>
  </Button>
);

/** Toggle button for accessing both language and keyboard layout settings. */
const AllSettingsToggle = ({ onClick, language, keymap }: ToggleProps) => {
  if (!localConnection()) return <LanguageOnlyToggle onClick={onClick} language={language} />;

  return (
    <Button
      onClick={onClick}
      aria-label={_("Change display language and keyboard layout")}
      variant="plain"
    >
      <CenteredContent>
        <LanguageIcon /> {language} <KeyboardIcon /> <code>{keymap}</code>
      </CenteredContent>
    </Button>
  );
};

/**
 * Maps each dialog variant to its corresponding React component.
 */
const dialogs: { [key in InstallerOptionsVariant]: React.FC<DialogProps> } = {
  all: AllSettingsDialog,
  language: LanguageOnlyDialog,
  keyboard: KeyboardOnlyDialog,
};

/**
 * Maps each toggle variant to its corresponding React component.
 */
const toggles: { [key in InstallerOptionsVariant]: React.FC<ToggleProps> } = {
  all: AllSettingsToggle,
  language: LanguageOnlyToggle,
  keyboard: KeyboardOnlyToggle,
};

/**
 * Props for the main InstallerOptions component.
 */
export type InstallerOptionsProps = {
  /** Determines which dialog variant to render. */
  variant?: InstallerOptionsVariant;
  /**
   * Optional render function for a custom button or UI element that opens the
   * dialog. If not provided, a default toggle button will be rendered based on
   * the selected variant.
   */
  toggle?: (props: ToggleProps) => JSX.Element;
  /** Optional callback when the dialog is closed. */
  onClose?: () => void;
};

/**
 * Dialog for setting language and keyboard layout.
 *
 * It supports different through its "variant" prop: language-only,
 * keyboard-only, or both.
 *
 */
export default function InstallerOptions({
  variant = "all",
  toggle,
  onClose,
}: InstallerOptionsProps) {
  const location = useLocation();
  const { locales } = useL10n();
  const { mutate: updateSystemL10n } = useConfigMutation();
  const { language, keymap, changeLanguage, changeKeymap } = useInstallerL10n();
  const { phase } = useInstallerStatus({ suspense: true });
  const { selectedProduct } = useProduct({ suspense: true });
  const initialFormState = {
    language,
    keymap,
    allowReusingSettings: !!selectedProduct,
    reuseSettings: true,
  };
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const [dialogState, dispatchDialogAction] = useReducer(dialogReducer, {
    isOpen: false,
    isBusy: false,
  });

  // Skip rendering if any of the following conditions are met
  const skip =
    (variant === "keyboard" && !localConnection()) ||
    phase === InstallationPhase.Install ||
    // FIXME: below condition could be a problem for a question appearing while
    // product progress
    [ROOT.login, ROOT.installationProgress, ROOT.installationFinished, PRODUCT.progress].includes(
      location.pathname,
    );

  if (skip) return;

  /**
   * Copies selected localization settings to the product to install settings,
   **/
  const reuseSettings = () => {
    // FIXME: export and use languageToLocale from context/installerL10n
    const systemLocale = locales.find((l) => l.id.startsWith(formState.language.replace("-", "_")));
    const systemL10n: Partial<LocaleConfig> = {};
    // FIXME: use a fallback if no system locale was found ?
    if (variant !== "keyboard") systemL10n.locales = [systemLocale?.id];
    if (variant !== "language" && localConnection()) systemL10n.keymap = formState.keymap;

    updateSystemL10n(systemL10n);
  };

  const close = () => {
    dispatchDialogAction({ type: "CLOSE" });
    typeof onClose === "function" && onClose();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dispatchDialogAction({ type: "SET_BUSY" });

    try {
      if (variant !== "language" && localConnection()) {
        await changeKeymap(formState.keymap);
      }

      if (variant !== "keyboard") {
        await changeLanguage(formState.language);
      }

      formState.allowReusingSettings && formState.reuseSettings && reuseSettings();
    } catch (e) {
      console.error(e);
      dispatchDialogAction({ type: "SET_IDLE" });
    } finally {
      close();
    }
  };

  const actions: Actions = {
    handleLanguageChange: (_, v) => dispatch({ type: "SET_SELECTED_LANGUAGE", language: v }),
    handleKeymapChange: (_, v) => dispatch({ type: "SET_SELECTED_KEYMAP", keymap: v }),
    handleCopyToSystemToggle: () => dispatch({ type: "TOGGLE_REUSE_SETTINGS" }),
    handleSubmitForm: onSubmit,
    handleCancellation: () => {
      dispatch({ type: "RESET", state: initialFormState });
      close();
    },
  };

  const Toggle = toggle ?? toggles[variant];
  const Dialog = dialogs[variant];

  return (
    <>
      <Toggle
        language={supportedLanguages[language]}
        keymap={keymap}
        onClick={() => dispatchDialogAction({ type: "OPEN" })}
      />
      <Dialog state={dialogState} formState={formState} actions={actions} />
    </>
  );
}
