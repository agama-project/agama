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

/**
 * This module defines the InstallerL10nOptions component, which allows users to
 * configure installer localization settings, with the option to copy them, when
 * applicable, to the product's localization settings.
 *
 * It supports multiple UI variants (language-only, keyboard-only, or both), and
 * manages both form and dialog state. To avoid scattering complex conditional
 * logic throughout the main component, the implementation is split into several
 * small internal components.
 */

import React, { useReducer } from "react";
import { useHref, useLocation } from "react-router";
import { Button, ButtonProps, Flex, FlexProps, Form } from "@patternfly/react-core";
import { formOptions } from "@tanstack/react-form";
import Popup from "~/components/core/Popup";
import Text from "~/components/core/Text";
import VisualTooltip from "~/components/core/VisualTooltip";
import Icon from "~/components/layout/Icon";
import { mergeFormDefaults, useAppForm, withForm } from "~/hooks/form";
import { useInstallerL10n } from "~/context/installerL10n";
import { localConnection } from "~/utils";
import { _ } from "~/i18n";

import type { TranslatedString } from "~/i18n";
import supportedLanguages from "~/languages.json";
import { ROOT, L10N } from "~/routes/paths";
import { useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useStatus } from "~/hooks/model/status";
import { patchConfig } from "~/api";
import type { Keymap, Locale } from "~/model/system/l10n";

/**
 * Settings the user can change in the dialog.
 */
type FormFields = {
  /** The language code */
  language: string;
  /** The keymap code */
  keymap: string;
  /** Whether to use these settings for the product localization settings too */
  reuseSettings: boolean;
};

/**
 * Fallbacks for the settings. The language and the keymap in use replace them
 * when the component builds its form, since both are only known at runtime.
 */
const defaultValues: FormFields = { language: "", keymap: "", reuseSettings: true };

/** Shared options, giving every piece of the dialog the same field types. */
const defaultOptions = formOptions({ defaultValues });

/**
 * Submits the settings instead of letting the browser handle the form.
 */
const submitHandler =
  (form: { handleSubmit: () => void }) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit();
  };

/**
 * Language selector for the installer interface. Each option shows the language
 * name, with its code below; both are searchable.
 *
 * Each option states its own language, so it is read aloud with the right
 * pronunciation instead of the one currently in use.
 */
const LanguageField = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    const options = Object.keys(supportedLanguages)
      .sort()
      .map((id) => ({
        value: id,
        label: supportedLanguages[id],
        description: (
          <Text textStyle={["fontSizeXs", "textColorDisabled", "fontFamilyMonospace"]}>{id}</Text>
        ),
        filterText: `${supportedLanguages[id]} ${id}`,
        lang: id,
      }));

    return (
      <form.AppField name="language">
        {(field) => (
          <field.SearchableSelectField
            // TRANSLATORS: label for the installer interface language selector
            label={_("Language")}
            // TRANSLATORS: hint for the language filter input
            placeholder={_("Filter by language, territory or locale code")}
            // TRANSLATORS: shown when no language matches the filter
            noResultsText={_("None of the locales match the filter.")}
            options={options}
          />
        )}
      </form.AppField>
    );
  },
});

/**
 * Keyboard layout selector for the installer interface. Each option shows the
 * layout description, with the keymap code below; both are searchable.
 *
 * Not available in remote installations.
 */
const KeyboardField = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    const keymaps = useSystem()?.l10n?.keymaps ?? [];

    if (!localConnection()) {
      return (
        <form.AppField name="keymap">
          {(field) => (
            <field.ReadOnlyField
              // TRANSLATORS: label for the installer interface keyboard layout selector
              label={_("Keyboard layout")}
              text={_("Cannot be changed in remote installation")}
            />
          )}
        </form.AppField>
      );
    }

    const options = keymaps.map((keymap) => ({
      value: keymap.id,
      label: keymap.description,
      description: (
        <Text textStyle={["fontSizeXs", "textColorDisabled", "fontFamilyMonospace"]}>
          {keymap.id}
        </Text>
      ),
      filterText: `${keymap.description} ${keymap.id}`,
    }));

    return (
      <form.AppField name="keymap">
        {(field) => (
          <field.SearchableSelectField
            // TRANSLATORS: label for the installer interface keyboard layout selector
            label={_("Keyboard layout")}
            // TRANSLATORS: hint for the keyboard filter input
            placeholder={_("Filter by description or keymap code")}
            // TRANSLATORS: shown when no keyboard layout matches the filter
            noResultsText={_("None of the keymaps match the filter.")}
            options={options}
          />
        )}
      </form.AppField>
    );
  },
});

/**
 * Supported dialog actions.
 */
type DialogAction = { type: "OPEN" } | { type: "CLOSE" };

/**
 * Represents the dialog state
 */
type DialogState = {
  isOpen: boolean;
};

/**
 * Reducer for dialog state updates.
 */
const dialogReducer = (state: DialogState, action: DialogAction): DialogState => {
  switch (action.type) {
    case "OPEN": {
      return { ...state, isOpen: true };
    }

    case "CLOSE": {
      return { ...state, isOpen: false };
    }
  }
};

/**
 * Props passed to each dialog variant.
 */
type DialogProps = {
  isOpen: boolean;
  /** Whether the settings can also be applied to the product to install. */
  allowReusingSettings: boolean;
  /** Called when the user dismisses the dialog. */
  onCancel: () => void;
};

/**
 * Defines the available installer l10n options modes:
 *   "all": Allow settings both language and keyboard layout.
 *   "language": Allow setting only language.
 *   "keyboard": Allow settings only keyboard layout.
 */
type InstallerL10nOptionsVariants = "all" | "language" | "keyboard";

/**
 * Props passed to each toggle variant.
 */
type ToggleProps = Pick<ButtonProps, "onClick"> & {
  language?: string;
  keymap?: string;
  /**
   * Whether to render the current values (language and keymap) next to the
   * icons. When false, only the icons are shown and the accessible name comes
   * from the button's aria-label.
   */
  showValues?: boolean;
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
  text: TranslatedString;
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

/**
 * Renders the checkbox for applying the chosen settings to the product to
 * install too, with a link to the page where they can be fine tuned.
 */
const ReuseSettingsField = withForm({
  ...defaultOptions,
  props: {} as {
    /** Wording for the checkbox, which depends on the dialog variant. */
    label: TranslatedString;
    /** Called when the user activates the link to the localization page. */
    onLinkClick?: ButtonProps["onClick"];
  },
  render: function Render({ form, label, onLinkClick }) {
    const description = _(
      // TRANSLATORS: Explains where users can find more language and keyboard
      // options for the product to install. The text in square brackets [] is a
      // link to the localization page; keep the brackets.
      "The [language and region] settings for the product may offer more options to choose from.",
    );

    return (
      <form.AppField name="reuseSettings">
        {(field) => (
          <field.CheckboxField
            label={label}
            description={<TextWithLinkToL10n text={description} onClick={onLinkClick} />}
          />
        )}
      </form.AppField>
    );
  },
});

/**
 * Renders the dialog buttons, keeping them unavailable while the settings are
 * being applied.
 *
 * Meant to be placed inside a `Popup.Actions`, which is what puts the buttons
 * in the dialog footer.
 */
const DialogButtons = withForm({
  ...defaultOptions,
  props: {} as {
    /** Called when the user dismisses the dialog. */
    onCancel: () => void;
  },
  render: function Render({ form, onCancel }) {
    return (
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <Popup.Confirm
              form="installer-l10n"
              type="submit"
              autoFocus
              isDisabled={isSubmitting}
              isLoading={isSubmitting}
            >
              {_("Accept")}
            </Popup.Confirm>
            <Popup.Cancel onClick={onCancel} isDisabled={isSubmitting} />
          </>
        )}
      </form.Subscribe>
    );
  },
});

const AllSettingsDialog = withForm({
  ...defaultOptions,
  props: {} as DialogProps,
  render: function Render({ form, isOpen, allowReusingSettings, onCancel }) {
    return (
      <Popup isOpen={isOpen} variant="small" title={_("Language and keyboard")}>
        <Form id="installer-l10n" onSubmit={submitHandler(form)}>
          <LanguageField form={form} />
          <KeyboardField form={form} />
          <ReusableSettings isReuseAllowed={allowReusingSettings}>
            <ReuseSettingsField
              form={form}
              label={_("Use these same settings for the selected product")}
              onLinkClick={onCancel}
            />
          </ReusableSettings>
        </Form>

        <Popup.Actions>
          <DialogButtons form={form} onCancel={onCancel} />
        </Popup.Actions>
      </Popup>
    );
  },
});

const LanguageOnlyDialog = withForm({
  ...defaultOptions,
  props: {} as DialogProps,
  render: function Render({ form, isOpen, allowReusingSettings, onCancel }) {
    return (
      <Popup isOpen={isOpen} variant="small" title={_("Change Language")}>
        <Form id="installer-l10n" onSubmit={submitHandler(form)}>
          <LanguageField form={form} />
          <ReusableSettings isReuseAllowed={allowReusingSettings}>
            <ReuseSettingsField
              form={form}
              label={_("Use for the selected product too")}
              onLinkClick={onCancel}
            />
          </ReusableSettings>
        </Form>

        <Popup.Actions>
          <DialogButtons form={form} onCancel={onCancel} />
        </Popup.Actions>
      </Popup>
    );
  },
});

const KeyboardOnlyDialog = withForm({
  ...defaultOptions,
  props: {} as DialogProps,
  render: function Render({ form, isOpen, allowReusingSettings, onCancel }) {
    if (!localConnection()) {
      return (
        <Popup isOpen={isOpen} variant="small" title={_("Change keyboard")}>
          {_("Cannot be changed in remote installation")}
          <Popup.Actions>
            <Popup.Confirm onClick={onCancel}>{_("Accept")}</Popup.Confirm>
          </Popup.Actions>
        </Popup>
      );
    }

    return (
      <Popup isOpen={isOpen} variant="small" title={_("Change keyboard")}>
        <Form id="installer-l10n" onSubmit={submitHandler(form)}>
          <KeyboardField form={form} />
          <ReusableSettings isReuseAllowed={allowReusingSettings}>
            <ReuseSettingsField
              form={form}
              label={_("Use for the selected product too")}
              onLinkClick={onCancel}
            />
          </ReusableSettings>
        </Form>

        <Popup.Actions>
          <DialogButtons form={form} onCancel={onCancel} />
        </Popup.Actions>
      </Popup>
    );
  },
});

/** Icon representing the language settings. Used in toggle buttons. */
const LanguageIcon = () => <Icon isMiddleAligned name="translate" />;

/** Icon representing the keyboard settings. Used in toggle buttons. */
const KeyboardIcon = () => <Icon isMiddleAligned name="keyboard" />;

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
const LanguageOnlyToggle = ({ onClick, language, showValues }: ToggleProps) => {
  // TRANSLATORS: label for the button that opens the display language settings
  const label = _("Language");
  return (
    <VisualTooltip content={label}>
      <Button onClick={onClick} aria-label={label} aria-haspopup="dialog" variant="plain">
        <CenteredContent>
          <LanguageIcon />
          {showValues && language}
        </CenteredContent>
      </Button>
    </VisualTooltip>
  );
};

/** Toggle button for accessing only keymap settings. */
const KeyboardOnlyToggle = ({ onClick, keymap, showValues }: ToggleProps) => {
  // TRANSLATORS: label for the button that opens the keyboard layout settings
  const label = _("Keyboard");
  return (
    <VisualTooltip content={label}>
      <Button onClick={onClick} aria-label={label} aria-haspopup="dialog" variant="plain">
        <CenteredContent alignItems="alignItemsFlexEnd">
          <KeyboardIcon />
          {showValues && <code>{keymap}</code>}
        </CenteredContent>
      </Button>
    </VisualTooltip>
  );
};

/** Toggle button for accessing both language and keyboard layout settings. */
const AllSettingsToggle = ({ onClick, language, keymap, showValues }: ToggleProps) => {
  if (!localConnection())
    return <LanguageOnlyToggle onClick={onClick} language={language} showValues={showValues} />;

  // TRANSLATORS: label for the button that opens the display language and
  // keyboard layout settings
  const label = _("Language and Keyboard");
  return (
    <VisualTooltip content={label}>
      <Button onClick={onClick} aria-label={label} aria-haspopup="dialog" variant="plain">
        <CenteredContent>
          <LanguageIcon />
          {showValues && language}
          <KeyboardIcon />
          {showValues && <code>{keymap}</code>}
        </CenteredContent>
      </Button>
    </VisualTooltip>
  );
};

/**
 * Maps each dialog variant to its corresponding React component.
 */
const dialogs: { [key in InstallerL10nOptionsVariants]: typeof AllSettingsDialog } = {
  all: AllSettingsDialog,
  language: LanguageOnlyDialog,
  keyboard: KeyboardOnlyDialog,
};

/**
 * Maps each toggle variant to its corresponding React component.
 */
const toggles: { [key in InstallerL10nOptionsVariants]: React.FC<ToggleProps> } = {
  all: AllSettingsToggle,
  language: LanguageOnlyToggle,
  keyboard: KeyboardOnlyToggle,
};

/**
 * Props for the main InstallerL10nOptions component.
 */
export type InstallerL10nOptionsProps = {
  /** Determines which dialog variant to render. */
  variant?: InstallerL10nOptionsVariants;
  /**
   * Optional render function for a custom button or UI element that opens the
   * dialog. If not provided, a default toggle button will be rendered based on
   * the selected variant.
   */
  toggle?: (props: ToggleProps) => JSX.Element;
  /**
   * Whether the toggle should display the current values next to the icons.
   * Defaults to false (icon-only) to save space in crowded headers.
   */
  showValues?: boolean;
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
export default function InstallerL10nOptions({
  variant = "all",
  showValues = false,
  toggle,
  onClose,
}: InstallerL10nOptionsProps) {
  const location = useLocation();
  const locales = useSystem()?.l10n?.locales ?? [];
  const { language, keymap, changeL10n } = useInstallerL10n();
  const { stage } = useStatus();
  const selectedProduct = useProductInfo();
  const allowReusingSettings = !!selectedProduct;
  const [dialogState, dispatchDialogAction] = useReducer(dialogReducer, { isOpen: false });

  /**
   * Copies selected localization settings to the product to install settings,
   **/
  const reuseSettings = (values: FormFields) => {
    // FIXME: export and use languageToLocale from context/installerL10n
    const systemLocale = locales.find((l) => l.id.startsWith(values.language.replace("-", "_")));
    const systemL10n: { locale?: Locale["id"]; keymap?: Keymap["id"] } = {};
    // FIXME: use a fallback if no system locale was found ?
    if (variant !== "keyboard") systemL10n.locale = systemLocale?.id;
    if (variant !== "language" && localConnection()) systemL10n.keymap = values.keymap;

    patchConfig({ l10n: systemL10n });
  };

  const close = () => {
    dispatchDialogAction({ type: "CLOSE" });
    typeof onClose === "function" && onClose();
  };

  const applySettings = async (values: FormFields) => {
    try {
      const l10nOptions: { language?: string; keymap?: string } = {};

      if (variant !== "keyboard") {
        l10nOptions.language = values.language;
      }

      if (variant !== "language" && localConnection()) {
        l10nOptions.keymap = values.keymap;
      }

      await changeL10n(l10nOptions);

      allowReusingSettings && values.reuseSettings && reuseSettings(values);
    } catch (e) {
      console.error(e);
    } finally {
      close();
    }
  };

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, { language, keymap }),
    onSubmit: ({ value }) => applySettings(value),
  });

  // Skip rendering if any of the following conditions are met
  const skip =
    (variant === "keyboard" && !localConnection()) ||
    stage === "installing" ||
    // FIXME: below condition could be a problem for a question appearing while
    // product progress
    [ROOT.login, ROOT.installationProgress, ROOT.installationFinished].includes(location.pathname);

  if (skip) return;

  const Toggle = toggle ?? toggles[variant];
  const Dialog = dialogs[variant];

  return (
    <>
      <Toggle
        showValues={showValues}
        language={supportedLanguages[language]}
        keymap={keymap}
        onClick={() => {
          // Start from the settings currently in use, no matter what a previous
          // visit to the dialog left behind.
          form.reset({ language, keymap, reuseSettings: true });
          dispatchDialogAction({ type: "OPEN" });
        }}
      />
      <Dialog
        form={form}
        isOpen={dialogState.isOpen}
        allowReusingSettings={allowReusingSettings}
        onCancel={close}
      />
    </>
  );
}
