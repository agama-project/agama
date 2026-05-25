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
import NestedContent from "~/components/core/NestedContent";
import { Fieldset } from "~/components/form/Fieldset";
import PreservedValueField from "~/components/form/PreservedValueField";
import PasswordCheck from "~/components/users/PasswordCheck";
import {
  AuthMode,
  authModeRequirements,
  defaultOptions,
  isPrivateKey,
  isValidSshKey,
} from "./fields";
import { withForm } from "~/hooks/form";
import { _ } from "~/i18n";

/**
 * Password and confirmation fields for root authentication.
 */
const RootPasswordFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="rootPassword">
          {(field) => <field.MaskedField label={_("Password")} />}
        </form.AppField>

        <form.AppField name="rootPasswordConfirmation">
          {(field) => (
            <field.MaskedField
              label={_("Password confirmation")}
              hideReminders={["keymap", "capslock"]}
            />
          )}
        </form.AppField>
      </>
    );
  },
});

/**
 * Authentication mode options for the root user.
 */
const authModeOptions = () => [
  {
    value: AuthMode.NONE,
    // TRANSLATORS: authentication mode option
    label: _("Disabled"),
    // TRANSLATORS: description for no authentication mode
    description: _("Root login is off"),
  },
  {
    value: AuthMode.PASSWORD,
    // TRANSLATORS: authentication mode option
    label: _("Password"),
    // TRANSLATORS: description for password authentication mode
    description: _("Log in using a password"),
  },
  {
    value: AuthMode.SSH_KEY,
    // TRANSLATORS: authentication mode option
    label: _("SSH Public Key"),
    // TRANSLATORS: description for SSH public key authentication mode
    description: _("Log in using a trusted SSH public key"),
  },
  {
    value: AuthMode.BOTH,
    // TRANSLATORS: authentication mode option
    label: _("Password and SSH Public Key"),
    // TRANSLATORS: description for both password and SSH key authentication
    description: _("Sets up both and use either to log in"),
  },
];

/**
 * Root authentication configuration section for the authentication form.
 *
 * Provides a dropdown to select authentication mode (none, password, SSH key, or both)
 * and conditionally reveals corresponding authentication fields.
 *
 * Receives a typed form instance via `withForm`.
 */
const RootAuthFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <Fieldset
        legend={
          // TRANSLATORS: fieldset legend for root authentication configuration
          _("Root account")
        }
        description={
          // TRANSLATORS: explanation of how to enable the root account
          _("Choose whether to enable the root account.")
        }
      >
        <form.AppField name="rootAuthMode">
          {(field) => (
            <field.DropdownField
              // TRANSLATORS: label for the root authentication mode selector
              label={_("Root login method")}
              options={authModeOptions()}
            />
          )}
        </form.AppField>

        <form.Subscribe
          selector={(s) => ({
            authMode: s.values.rootAuthMode,
            usingHashedPassword: s.values.rootUsingHashedPassword,
          })}
        >
          {({ authMode, usingHashedPassword }) => {
            const { needsPassword, needsSshKey } = authModeRequirements(authMode);

            return (
              <>
                {needsPassword && (
                  <NestedContent margin="mxLg">
                    <PreservedValueField
                      preservedMessage={_("Using a hashed password.")}
                      isPreserving={usingHashedPassword}
                      onEdit={() => form.setFieldValue("rootUsingHashedPassword", false)}
                    >
                      <RootPasswordFields form={form} />
                      <form.Subscribe selector={(s) => s.values.rootPassword}>
                        {(password) => <PasswordCheck password={password} />}
                      </form.Subscribe>
                    </PreservedValueField>
                  </NestedContent>
                )}

                {needsSshKey && (
                  <NestedContent margin="mxLg">
                    <form.AppField name="rootSshPublicKeys">
                      {(field) => (
                        <field.ArrayField
                          // TRANSLATORS: label for root SSH public keys input field
                          label={_("SSH Public Keys")}
                          skipDuplicates
                          maxEntryWidth={60}
                          splitPasteOn={/\r?\n/}
                          validateOnSubmit={(v) =>
                            isValidSshKey(v) && !isPrivateKey(v) ? undefined : _("Invalid SSH Key")
                          }
                          helperText={_(
                            "Paste or enter one or more public SSH keys (e.g. ssh-ed25519 AAAA...)",
                          )}
                        />
                      )}
                    </form.AppField>
                  </NestedContent>
                )}
              </>
            );
          }}
        </form.Subscribe>
      </Fieldset>
    );
  },
});

export default RootAuthFields;
