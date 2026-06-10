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
import Interpolate from "~/components/core/Interpolate";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import LabelText from "~/components/form/LabelText";
import { Fieldset } from "~/components/form/Fieldset";
import PreservedValueField from "~/components/form/PreservedValueField";
import PasswordCheck from "~/components/users/PasswordCheck";
import { suggestUsernames } from "~/components/users/utils";
import { defaultOptions, isPrivateKey, isValidSshKey } from "./fields";
import { withForm } from "~/hooks/form";
import { _ } from "~/i18n";

/**
 * Password and confirmation fields for the first user.
 */
const FirstUserPasswordFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="userPassword">
          {(field) => <field.MaskedField label={_("Password")} />}
        </form.AppField>

        <form.AppField name="userPasswordConfirmation">
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
 * First user configuration section for the authentication form.
 *
 * Receives a typed form instance via `withForm`.
 */
const FirstUserFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <Fieldset
        legend={
          // TRANSLATORS: fieldset legend for first user configuration
          _("Administrator account")
        }
        description={
          <Interpolate
            sentence={
              // TRANSLATORS: checkbox description explaining admin privileges.
              // Text in square brackets will be displayed in bold.
              _(
                "Sets up a main login account. It can run administrator commands using [sudo] but is separate from the root account.",
              )
            }
          >
            {(text) => (
              <Text component="strong" isBold>
                {text}
              </Text>
            )}
          </Interpolate>
        }
      >
        <form.AppField name="defineUser">
          {(field) => (
            <field.CheckboxField
              // TRANSLATORS: checkbox label to enable first user definition
              label={_("Define an administrator user")}
            />
          )}
        </form.AppField>

        <form.Subscribe selector={(s) => s.values.defineUser}>
          {(define) =>
            define && (
              <NestedContent margin="mxLg">
                <form.AppField
                  name="userFullName"
                  listeners={{
                    onBlur: ({ value }) => {
                      const suggestions = suggestUsernames(value);
                      form.setFieldValue("usernameSuggestions", suggestions);
                    },
                  }}
                >
                  {(field) => <field.TextField label={_("Full name")} />}
                </form.AppField>

                <form.Subscribe selector={(s) => s.values.usernameSuggestions}>
                  {(suggestions) => (
                    <form.AppField name="userName">
                      {(field) => (
                        <field.SuggestionsTextField
                          label={_("Username")}
                          suggestions={suggestions}
                        />
                      )}
                    </form.AppField>
                  )}
                </form.Subscribe>

                <form.Subscribe selector={(s) => s.values.userUsingHashedPassword}>
                  {(usingHashedPassword) => (
                    <PreservedValueField
                      preservedMessage={_("Using a hashed password.")}
                      isPreserving={usingHashedPassword}
                      onEdit={() => form.setFieldValue("userUsingHashedPassword", false)}
                    >
                      <FirstUserPasswordFields form={form} />
                      <form.Subscribe selector={(s) => s.values.userPassword}>
                        {(password) => <PasswordCheck password={password} />}
                      </form.Subscribe>
                    </PreservedValueField>
                  )}
                </form.Subscribe>

                <form.AppField name="userSshPublicKeys">
                  {(field) => (
                    <field.ArrayField
                      label={<LabelText suffix={_("(optional)")}>{_("SSH Public Keys")}</LabelText>}
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
            )
          }
        </form.Subscribe>
      </Fieldset>
    );
  },
});

export default FirstUserFields;
