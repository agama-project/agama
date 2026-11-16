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
import { sift } from "radashi";
import { HelperText, HelperTextItem, Stack } from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import FieldsRow from "~/components/form/FieldsRow";
import PasswordAndConfirmationFields from "~/components/form/PasswordAndConfirmationFields";
import PreservedValueField from "~/components/form/PreservedValueField";
import ConfiguredAccounts, {
  ConfiguredSshKeys,
  getRootAuthType,
  hasAccounts,
  hasSshKeys,
  isUserDefined,
} from "~/components/users/ConfiguredAccounts";
import { suggestUsernames } from "~/components/users/utils";
import { withForm } from "~/hooks/form";
import { _ } from "~/i18n";
import { AUTHENTICATION, defaultOptions } from "./fields";

import type { Authentication } from "./fields";
import type { Config } from "~/model/config";

const authenticationOptions = () => [
  {
    value: AUTHENTICATION.LATER,
    // TRANSLATORS: option of how to log in to the installed system, leaving it
    // for later
    label: _("Configure it later"),
    // TRANSLATORS: description of the "Configure it later" authentication option
    description: _("Set it up before installing, with more options such as SSH keys."),
  },
  {
    value: AUTHENTICATION.USER,
    // TRANSLATORS: option of how to log in to the installed system
    label: _("Administrator user"),
    // TRANSLATORS: description of the "Administrator user" authentication option
    description: _("A login account that can run admin commands using sudo"),
  },
  {
    value: AUTHENTICATION.ROOT,
    // TRANSLATORS: option of how to log in to the installed system
    label: _("Root password"),
    // TRANSLATORS: description of the "Root password" authentication option
    description: _("Log in as root with a password"),
  },
];

/** The full name of the administrator user, which suggests usernames once left. */
const FullNameField = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <form.AppField
        name="fullName"
        listeners={{
          onBlur: ({ value }) => form.setFieldValue("usernameSuggestions", suggestUsernames(value)),
        }}
      >
        {(field) => (
          // TRANSLATORS: label of the field for the full name of the user
          <field.TextField label={_("Full name")} />
        )}
      </form.AppField>
    );
  },
});

/** The username of the administrator user, with the names suggested for it. */
const UserNameField = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <form.Subscribe selector={(s) => s.values.usernameSuggestions}>
        {(suggestions) => (
          <form.AppField name="userName">
            {(field) => (
              <field.SuggestionsTextField
                // TRANSLATORS: label of the field for the name to log in with
                label={_("Username")}
                suggestions={suggestions}
              />
            )}
          </form.AppField>
        )}
      </form.Subscribe>
    );
  },
});

type PasswordFieldsProps = {
  /** The field holding the new password. */
  name: "userPassword" | "rootPassword";
  /** The field holding the password typed again. */
  confirmationName: "userPasswordConfirmation" | "rootPasswordConfirmation";
};

/**
 * A password and its confirmation. They leave out the keyboard reminder: the
 * header shows the keyboard in use on this screen.
 */
const PasswordFields = withForm({
  ...defaultOptions,
  props: {} as PasswordFieldsProps,
  render: function Render({ form, name, confirmationName }) {
    return (
      <PasswordAndConfirmationFields>
        {(isRevealed) => (
          <>
            <form.AppField name={name}>
              {(field) => (
                <field.MaskedField
                  // TRANSLATORS: label of the field for the password to log in with
                  label={_("Password")}
                  isRevealed={isRevealed}
                  hideReminders={["keymap"]}
                />
              )}
            </form.AppField>
            <form.AppField name={confirmationName}>
              {(field) => (
                <field.MaskedField
                  // TRANSLATORS: label of the field for typing the password again
                  label={_("Password confirmation")}
                  isRevealed={isRevealed}
                  hideReminders={["keymap", "capslock"]}
                />
              )}
            </form.AppField>
          </>
        )}
      </PasswordAndConfirmationFields>
    );
  },
});

/**
 * The choice of how to log in to the installed system, with what it needs
 * nested below it: the administrator user, or the root password. Each option is a
 * complete setup; anything beyond them, such as SSH keys or both accounts, is
 * left to the authentication page. Leaving it for later keeps its description
 * in view, nested in the same way, telling where and when that happens; the
 * other options explain themselves. Its label can be left to screen readers when a section title
 * above already shows it.
 */
const AuthenticationChoice = withForm({
  ...defaultOptions,
  props: {} as { isLabelVisuallyHidden?: boolean },
  render: function Render({ form, isLabelVisuallyHidden = false }) {
    const options = authenticationOptions();
    const later = options.find((option) => option.value === AUTHENTICATION.LATER);

    return (
      <form.AppField name="authentication">
        {(field) => (
          <field.DropdownField<Authentication | "">
            // TRANSLATORS: label of the field for how to log in to the installed
            // system
            label={_("Authentication")}
            isLabelVisuallyHidden={isLabelVisuallyHidden}
            // TRANSLATORS: shown in the authentication field until an option is
            // picked
            placeholder={_("Select how to authenticate")}
            options={options}
          >
            {(value) => (
              <>
                {value === AUTHENTICATION.LATER && (
                  <FieldNestedContent>
                    <HelperText>
                      <HelperTextItem>{later.description}</HelperTextItem>
                    </HelperText>
                  </FieldNestedContent>
                )}
                {value === AUTHENTICATION.USER && (
                  <FieldNestedContent>
                    <Stack hasGutter>
                      <FieldsRow>
                        <FullNameField form={form} />
                        <UserNameField form={form} />
                      </FieldsRow>
                      <PasswordFields
                        form={form}
                        name="userPassword"
                        confirmationName="userPasswordConfirmation"
                      />
                    </Stack>
                  </FieldNestedContent>
                )}
                {value === AUTHENTICATION.ROOT && (
                  <FieldNestedContent>
                    <PasswordFields
                      form={form}
                      name="rootPassword"
                      confirmationName="rootPasswordConfirmation"
                    />
                  </FieldNestedContent>
                )}
              </>
            )}
          </field.DropdownField>
        )}
      </form.AppField>
    );
  },
});

/** Names of the accounts the config sets to log in with: the user and root. */
const accountNames = (config: Config) =>
  sift([
    isUserDefined(config) && config.user.userName,
    getRootAuthType(config) !== "none" && "root",
  ]);

/**
 * Tells, by name in bold as the summary does, the accounts already set will be
 * replaced, keys included.
 */
const ReplacedAccountsMessage = ({
  accounts,
  hasKeys,
}: {
  accounts: string[];
  hasKeys: boolean;
}) => {
  const names = accounts.map((name) => () => <Text isBold>{name}</Text>);

  if (accounts.length === 1) {
    const sentence = hasKeys
      ? // TRANSLATORS: shown with the authentication fields when they replace
        // the account already set, followed by a button to keep it. %s is the
        // account name (e.g. "root" or "jdoe").
        _("The %s account and its SSH keys will be replaced.")
      : // TRANSLATORS: shown with the authentication fields when they replace
        // the account already set, followed by a button to keep it. %s is the
        // account name (e.g. "root" or "jdoe").
        _("The %s account will be replaced.");
    return <Interpolate sentence={sentence}>{names}</Interpolate>;
  }

  const sentence = hasKeys
    ? // TRANSLATORS: shown with the authentication fields when they replace
      // the accounts already set, followed by a button to keep them. The first
      // %s is a username (e.g. "jdoe"), the second is "root".
      _("The %s and %s accounts and their SSH keys will be replaced.")
    : // TRANSLATORS: shown with the authentication fields when they replace
      // the accounts already set, followed by a button to keep them. The first
      // %s is a username (e.g. "jdoe"), the second is "root".
      _("The %s and %s accounts will be replaced.");
  return <Interpolate sentence={sentence}>{names}</Interpolate>;
};

/**
 * How to log in to the installed system. Accounts already set, e.g. by a
 * profile or on a previous visit, are kept as a whole and told in place of the
 * choice, SSH keys included. Asking to change them replaces them as a whole
 * too, with a way back while not accepted.
 */
const AuthenticationFields = withForm({
  ...defaultOptions,
  props: {} as { config: Config | null },
  render: function Render({ form, config }) {
    const canKeep = !!config && hasAccounts(config);
    const hasKeys = canKeep && hasSshKeys(config);
    const accounts = canKeep ? accountNames(config) : [];
    // TRANSLATORS: label of the field for how to log in to the installed system
    const label = _("Authentication");

    if (!canKeep) return <AuthenticationChoice form={form} />;

    return (
      <form.Subscribe selector={(s) => s.values.keepsAuthentication}>
        {(keepsAuthentication) => (
          <PreservedValueField
            label={label}
            preservedMessage={<ConfiguredAccounts config={config} />}
            preservedDetails={hasKeys && <ConfiguredSshKeys config={config} />}
            isPreserving={keepsAuthentication}
            // TRANSLATORS: button to set up the accounts again here, in place of
            // the ones already set told before it
            changeButtonLabel={_("Replace")}
            isCompact
            onEdit={() => form.setFieldValue("keepsAuthentication", false)}
            onRestore={() => form.setFieldValue("keepsAuthentication", true)}
            restoreMessage={<ReplacedAccountsMessage accounts={accounts} hasKeys={hasKeys} />}
            restoreButtonLabel={
              accounts.length === 1
                ? // TRANSLATORS: keeps the account already set instead of
                  // replacing it ("it" is that account)
                  _("Keep it")
                : // TRANSLATORS: keeps the accounts already set instead of
                  // replacing them ("them" are those accounts)
                  _("Keep them")
            }
          >
            <AuthenticationChoice form={form} isLabelVisuallyHidden />
          </PreservedValueField>
        )}
      </form.Subscribe>
    );
  },
});

export default AuthenticationFields;
