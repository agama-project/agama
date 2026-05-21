/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { useNavigate } from "react-router";
import { castArrayIfExists, isEmpty } from "radashi";
import { Alert, ActionGroup, Form } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import PreservedValueField from "~/components/form/PreservedValueField";
import PasswordCheck from "~/components/users/PasswordCheck";
import PasswordFields from "./PasswordFields";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useConfig } from "~/hooks/model/config";
import { patchConfig } from "~/api";
import { USER } from "~/routes/paths";
import { defaultOptions, validate, AuthMode, isValidSshKey, isPrivateKey } from "./fields";
import { _ } from "~/i18n";

import type { Root } from "~/model/config";

/**
 * Determines the authentication mode from the root user configuration.
 */
const getAuthModeFromConfig = (rootUser: Root.Config): AuthMode => {
  const hasPassword = !isEmpty(rootUser.password);
  const hasSshKey = !isEmpty(rootUser.sshPublicKey);

  if (hasPassword && hasSshKey) return AuthMode.BOTH;
  if (hasPassword) return AuthMode.PASSWORD;
  if (hasSshKey) return AuthMode.SSH_KEY;
  return AuthMode.NONE;
};

/**
 * Authentication mode options for the root user.
 */
const authModeOptions = () => [
  {
    value: AuthMode.NONE,
    // TRANSLATORS: authentication mode option
    label: _("None"),
    // TRANSLATORS: description for no authentication mode
    description: _("No authentication configured"),
  },
  {
    value: AuthMode.PASSWORD,
    // TRANSLATORS: authentication mode option
    label: _("Password"),
    // TRANSLATORS: description for password authentication mode
    description: _("Authenticate using a password"),
  },
  {
    value: AuthMode.SSH_KEY,
    // TRANSLATORS: authentication mode option
    label: _("SSH Public Key"),
    // TRANSLATORS: description for SSH public key authentication mode
    description: _("Authenticate using an SSH public key"),
  },
  {
    value: AuthMode.BOTH,
    // TRANSLATORS: authentication mode option
    label: _("Both"),
    // TRANSLATORS: description for both password and SSH key authentication
    description: _("Authenticate using either password or SSH public key"),
  },
];

const RootUserForm = () => {
  const navigate = useNavigate();
  const rootUser = useConfig().root || {};

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, {
      authMode: getAuthModeFromConfig(rootUser),
      usingHashedPassword: rootUser.hashedPassword,
      sshPublicKey: isEmpty(rootUser.sshPublicKey) ? [] : castArrayIfExists(rootUser.sshPublicKey),
    }),
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        const fieldErrors = validate(formValues);
        if (fieldErrors) return fieldErrors;

        const needsPassword =
          formValues.authMode === AuthMode.PASSWORD || formValues.authMode === AuthMode.BOTH;
        const needsSshKey =
          formValues.authMode === AuthMode.SSH_KEY || formValues.authMode === AuthMode.BOTH;

        const data: Partial<Root.Config> = {};

        if (needsPassword) {
          data.password = formValues.usingHashedPassword
            ? rootUser.password || ""
            : formValues.password;
          data.hashedPassword = formValues.usingHashedPassword;
        } else {
          data.password = "";
          data.hashedPassword = false;
        }

        if (needsSshKey) {
          data.sshPublicKey = formValues.sshPublicKey.filter((k) => k.trim()).join("\n");
        } else {
          data.sshPublicKey = "";
        }

        try {
          await patchConfig({ root: data });
        } catch (e) {
          return { form: e.message };
        }
      },
    },
    onSubmit: () => navigate(-1),
  });

  return (
    <Page breadcrumbs={[{ label: _("Authentication"), path: USER.root }, { label: _("root") }]}>
      <Page.Content>
        <form.AppForm>
          <Form
            id="rootUserForm"
            isWidthLimited
            maxWidth="fit-content"
            onSubmit={(e) => {
              e.preventDefault();
              form.setErrorMap({ onSubmit: { fields: {} } });
              form.handleSubmit();
            }}
          >
            <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
              {(serverError) =>
                serverError && (
                  <Alert isInline title={_("Something went wrong")} variant="warning">
                    {serverError}
                  </Alert>
                )
              }
            </form.Subscribe>

            <form.AppField name="authMode">
              {(field) => (
                <field.DropdownField
                  // TRANSLATORS: label for the authentication mode selector
                  label={_("Authentication")}
                  options={authModeOptions()}
                />
              )}
            </form.AppField>

            <form.Subscribe
              selector={(s) => ({
                authMode: s.values.authMode,
                usingHashedPassword: s.values.usingHashedPassword,
              })}
            >
              {({ authMode, usingHashedPassword }) => {
                const needsPassword = authMode === AuthMode.PASSWORD || authMode === AuthMode.BOTH;
                const needsSshKey = authMode === AuthMode.SSH_KEY || authMode === AuthMode.BOTH;

                return (
                  <>
                    {needsPassword && (
                      <NestedContent margin="mxLg">
                        <PreservedValueField
                          // TRANSLATORS: message shown when using a previously hashed password
                          preservedMessage={_("Using a hashed password.")}
                          isPreserving={usingHashedPassword}
                          onEdit={() => form.setFieldValue("usingHashedPassword", false)}
                        >
                          <PasswordFields form={form} />
                          <form.Subscribe selector={(s) => s.values.password}>
                            {(password) => <PasswordCheck password={password} />}
                          </form.Subscribe>
                        </PreservedValueField>
                      </NestedContent>
                    )}

                    {needsSshKey && (
                      <NestedContent margin="mxLg">
                        <form.AppField name="sshPublicKey">
                          {(field) => (
                            <field.ArrayField
                              // TRANSLATORS: label for SSH public keys input field
                              label={_("SSH Public Keys")}
                              skipDuplicates
                              maxEntryWidth={60}
                              splitPasteOn={/\r?\n/}
                              validateOnSubmit={(v) =>
                                // TRANSLATORS: validation error for an invalid SSH key entry
                                isValidSshKey(v) && !isPrivateKey(v)
                                  ? undefined
                                  : _("Invalid SSH Key")
                              }
                              helperText={
                                // TRANSLATORS: helper text for SSH Public Keys
                                _("Enter or paste your public keys.")
                              }
                            />
                          )}
                        </form.AppField>
                      </NestedContent>
                    )}
                  </>
                );
              }}
            </form.Subscribe>

            <ActionGroup>
              <Page.Submit form="rootUserForm" />
              <Page.Cancel />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
};

export default RootUserForm;
