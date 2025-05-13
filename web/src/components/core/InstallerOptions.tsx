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

import React, { useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Checkbox,
  Flex,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  FormSelectProps,
} from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { localConnection } from "~/utils";
import { useInstallerL10n } from "~/context/installerL10n";
import { keymapsQuery, useConfigMutation, useL10n } from "~/queries/l10n";
import { LocaleConfig } from "~/types/l10n";
import { _ } from "~/i18n";
import supportedLanguages from "~/languages.json";

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
  /** Whether reuse these settings for the product localization settings too */
  copyToSystem: boolean;
};
/**
 * Supported form actions.
 */
type FormAction =
  | { type: "SET_SELECTED_LANGUAGE"; language: string }
  | { type: "SET_SELECTED_KEYMAP"; keymap: string }
  | { type: "TOGGLE_COPY_TO_SYSTEM" }
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

    case "TOGGLE_COPY_TO_SYSTEM": {
      return { ...state, copyToSystem: !state.copyToSystem };
    }

    case "RESET": {
      return { ...action.state };
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
  handleCloseDialog: () => void;
};

/**
 * Represents the dialog state
 */
type DialogState = {
  isOpen: boolean;
  isBusy: boolean;
};

/**
 * Props passed to each dialog variant.
 */
type DialogProps = {
  state: DialogState;
  formState: FormState;
  actions: Actions;
};

const AllSettingsDialog = ({ state, formState, actions }: DialogProps) => {
  return (
    <Popup isOpen={state.isOpen} variant="small" title={_("Language and keyboard")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
        <Form id="installer-l10n" onSubmit={actions.handleSubmitForm}>
          <LangaugeFormInput value={formState.language} onChange={actions.handleLanguageChange} />
          <KeyboardFormInput value={formState.keymap} onChange={actions.handleKeymapChange} />
          <FormGroup fieldId="copy-to-system">
            <Checkbox
              id="copy-to-system"
              label={_("Use these same settings for the selected product")}
              description={_(
                "More language and keyboard layout options for the selected product may be available in Localization page.",
              )}
              isChecked={formState.copyToSystem}
              onChange={actions.handleCopyToSystemToggle}
            />
          </FormGroup>
        </Form>
      </Flex>

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
        <Popup.Cancel onClick={actions.handleCloseDialog} isDisabled={state.isBusy} />
      </Popup.Actions>
    </Popup>
  );
};

const LanguageOnlyDialog = ({ state, formState, actions }: DialogProps) => {
  return (
    <Popup isOpen={state.isOpen} variant="small" title={_("Change Language")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
        <Form id="installer-l10n" onSubmit={actions.handleSubmitForm}>
          <LangaugeFormInput value={formState.language} onChange={actions.handleLanguageChange} />
          <FormGroup fieldId="copy-to-system">
            <Checkbox
              id="copy-to-system"
              label={_("Use for the selected product too")}
              description={
                "More languages might be available for the selected product at localization page"
              }
              isChecked={formState.copyToSystem}
              onChange={actions.handleCopyToSystemToggle}
            />
          </FormGroup>
        </Form>
      </Flex>

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
        <Popup.Cancel onClick={actions.handleCloseDialog} isDisabled={state.isBusy} />
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
          <Popup.Confirm onClick={actions.handleCloseDialog}>{_("Accept")}</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    );
  }

  return (
    <Popup isOpen={state.isOpen} variant="small" title={_("Change keyboard")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
        <Form id="installer-l10n" onSubmit={actions.handleSubmitForm}>
          <KeyboardFormInput value={formState.keymap} onChange={actions.handleKeymapChange} />
          <FormGroup fieldId="copy-to-system">
            <Checkbox
              id="copy-to-system"
              label={_("Use for the selected product too")}
              description={
                "More keymap layout might be available for the selected product at localization page"
              }
              isChecked={formState.copyToSystem}
              onChange={actions.handleCopyToSystemToggle}
            />
          </FormGroup>
        </Form>
      </Flex>

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
        <Popup.Cancel onClick={actions.handleCloseDialog} isDisabled={state.isBusy} />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Defines the available dialog modes:
 *   "all": Show both language and keyboard layout options.
 *   "language": Show only language selection.
 *   "keyboard": Show only keyboard layout selection.
 */
type DialogVariants = "all" | "language" | "keyboard";

/**
 * Maps each dialog variant to its corresponding React component.
 */
const dialogs: { [key in DialogVariants]: React.FC<DialogProps> } = {
  all: AllSettingsDialog,
  language: LanguageOnlyDialog,
  keyboard: KeyboardOnlyDialog,
};

/**
 * Props for the main InstallerOptions component.
 */
type InstallerOptionsProps = {
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Determines which dialog variant to render. */
  variant?: DialogVariants;
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
  isOpen = false,
  variant = "all",
  onClose,
}: InstallerOptionsProps) {
  const {
    language: initialLanguage,
    keymap: initialKeymap,
    changeLanguage,
    changeKeymap,
  } = useInstallerL10n();

  const initialState = {
    language: initialLanguage,
    keymap: initialKeymap,
    copyToSystem: true,
  };

  const { mutate: updateSystemL10n } = useConfigMutation();
  const { locales } = useL10n();
  const [isBusy, setIsBusy] = useState(false);
  const [formState, dispatch] = useReducer(formReducer, initialState);
  const dialogState: DialogState = { isOpen, isBusy };

  const copyToSystem = () => {
    // FIXME: export and use languageToLocale from context/installerL10n
    const systemLocale = locales.find((l) => l.id.startsWith(formState.language.replace("-", "_")));
    const systeml10n: Partial<LocaleConfig> = {};
    // FIXME: use a fallback if no system locale was found ?
    if (variant !== "keyboard") systeml10n.locales = [systemLocale?.id];
    if (variant !== "language" && localConnection()) systeml10n.keymap = formState.keymap;

    updateSystemL10n(systeml10n);
  };

  const close = () => {
    formState.copyToSystem && copyToSystem();
    dispatch({ type: "RESET", state: initialState });
    setIsBusy(false);
    typeof onClose === "function" && onClose();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsBusy(true);

    try {
      if (variant !== "language" && localConnection()) {
        await changeKeymap(formState.keymap);
      }

      if (variant !== "keyboard") {
        await changeLanguage(formState.language);
      }
    } catch (e) {
      console.error(e);
      setIsBusy(false);
    } finally {
      close();
    }
  };

  const actions: Actions = {
    handleLanguageChange: (_, v) => dispatch({ type: "SET_SELECTED_LANGUAGE", language: v }),
    handleKeymapChange: (_, v) => dispatch({ type: "SET_SELECTED_KEYMAP", keymap: v }),
    handleCopyToSystemToggle: () => dispatch({ type: "TOGGLE_COPY_TO_SYSTEM" }),
    handleSubmitForm: onSubmit,
    handleCloseDialog: close,
  };

  const Dialog = dialogs[variant];

  return <Dialog state={dialogState} formState={formState} actions={actions} />;
}
