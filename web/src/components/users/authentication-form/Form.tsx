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

import React, { useRef } from "react";
import { castArrayIfExists, isEmpty, isNullish, shake } from "radashi";
import { ActionGroup, Alert, Form } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import { patchConfig } from "~/api";
import { useConfig } from "~/hooks/model/config";
import { anyFieldChanged, useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";

import FirstUserFields from "./FirstUserFields";
import RootAuthFields from "./RootAuthFields";
import { AuthMode, defaultOptions, validate } from "./fields";

import type { User, Root } from "~/model/config";

type AuthFormValues = typeof defaultOptions.defaultValues;
type AuthFieldMeta = Record<string, { isDefaultValue?: boolean }>;

/**
 * Determines the authentication mode from the root user configuration.
 */
const getAuthModeFromConfig = (rootUser?: Root.Config): AuthMode => {
  if (!rootUser) return AuthMode.NONE;

  const hasPassword = !isEmpty(rootUser.password);
  const hasSshKey = !isEmpty(rootUser.sshPublicKeys);

  if (hasPassword && hasSshKey) return AuthMode.BOTH;
  if (hasPassword) return AuthMode.PASSWORD;
  if (hasSshKey) return AuthMode.SSH_KEY;
  return AuthMode.NONE;
};

/**
 * Builds the first user config patch if any first-user-related field has changed.
 *
 * Returns undefined if no changes are detected, which will be shaken out of the
 * final config.
 */
function buildFirstUserConfig(
  formValues: AuthFormValues,
  fieldMeta: AuthFieldMeta,
  currentFirstUser?: User.Config,
): { user: User.Config } | undefined {
  const fieldsToCheck = formValues.firstUser.define
    ? [
        "firstUser.define",
        "firstUser.fullName",
        "firstUser.userName",
        "firstUser.password",
        "firstUser.passwordConfirmation",
        "firstUser.usingHashedPassword",
        "firstUser.sshPublicKey",
      ]
    : ["firstUser.define"];

  if (!anyFieldChanged(fieldMeta, ...fieldsToCheck)) return undefined;

  if (!formValues.firstUser.define) {
    return { user: null };
  }

  return {
    user: {
      fullName: formValues.firstUser.fullName,
      userName: formValues.firstUser.userName,
      password: formValues.firstUser.usingHashedPassword
        ? currentFirstUser?.password || ""
        : formValues.firstUser.password,
      hashedPassword: formValues.firstUser.usingHashedPassword,
      sshPublicKeys: formValues.firstUser.sshPublicKeys,
    },
  };
}

/**
 * Builds the root authentication config patch if any root-related field has changed.
 *
 * Returns undefined if no changes are detected, which will be shaken out of the
 * final config.
 */
function buildRootAuthConfig(
  formValues: AuthFormValues,
  fieldMeta: AuthFieldMeta,
  currentRootUser?: Root.Config,
): { root: Partial<Root.Config> } | undefined {
  const baseFields = ["root.authMode"];
  const needsPassword =
    formValues.root.authMode === AuthMode.PASSWORD || formValues.root.authMode === AuthMode.BOTH;
  const needsSshKey =
    formValues.root.authMode === AuthMode.SSH_KEY || formValues.root.authMode === AuthMode.BOTH;

  const fieldsToCheck = [
    ...baseFields,
    ...(needsPassword
      ? ["root.password", "root.passwordConfirmation", "root.usingHashedPassword"]
      : []),
    ...(needsSshKey ? ["root.sshPublicKeys"] : []),
  ];

  if (!anyFieldChanged(fieldMeta, ...fieldsToCheck)) return undefined;

  const data: Partial<Root.Config> = {};

  if (needsPassword) {
    data.password = formValues.root.usingHashedPassword
      ? currentRootUser?.password || ""
      : formValues.root.password;
    data.hashedPassword = formValues.root.usingHashedPassword;
  } else {
    data.password = "";
    data.hashedPassword = false;
  }

  if (needsSshKey) {
    data.sshPublicKeys = formValues.root.sshPublicKeys.filter((k) => k.trim()).join("\n");
  } else {
    data.sshPublicKeys = "";
  }

  return { root: data };
}

/**
 * Page for configuring user authentication.
 *
 * Allows the user to configure:
 * - First user: optionally define a first user with admin privileges
 * - Root authentication: choose authentication mode (none, password, SSH key, or both)
 */
export default function AuthenticationForm() {
  const configWasPatched = useRef(false);
  const { user: firstUser, root: rootUser } = useConfig();

  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      firstUser: {
        define: !isNullish(firstUser),
        fullName: firstUser?.fullName || "",
        userName: firstUser?.userName || "",
        usernameSuggestions: [],
        password: firstUser?.password || "",
        passwordConfirmation: firstUser?.password || "",
        usingHashedPassword: firstUser?.hashedPassword || false,
        sshPublicKeys: isEmpty(firstUser?.sshPublicKeys)
          ? []
          : castArrayIfExists(firstUser?.sshPublicKeys),
      },
      root: {
        authMode: getAuthModeFromConfig(rootUser),
        password: rootUser?.password || "",
        passwordConfirmation: rootUser?.password || "",
        usingHashedPassword: rootUser?.hashedPassword || false,
        sshPublicKeys: isEmpty(rootUser?.sshPublicKeys)
          ? []
          : castArrayIfExists(rootUser?.sshPublicKeys),
      },
    },
    validators: {
      onSubmitAsync: async ({ value: formValues, formApi }) => {
        configWasPatched.current = false;

        if (!formApi.state.isDirty) return undefined;

        const fieldErrors = validate(formValues);
        if (fieldErrors) return fieldErrors;

        const { fieldMeta } = formApi.state;

        const config = shake({
          ...buildFirstUserConfig(formValues, fieldMeta, firstUser),
          ...buildRootAuthConfig(formValues, fieldMeta, rootUser),
        });

        if (isEmpty(config)) {
          form.reset(formValues);
          return undefined;
        }

        return await patchConfig(config)
          .then(() => {
            configWasPatched.current = true;
            form.reset(formValues);
            return undefined;
          })
          .catch(({ message: errorMessage }) => ({
            form: errorMessage,
          }));
      },
    },
  });

  return (
    <Page breadcrumbs={[{ label: _("Authentication") }]}>
      <Page.Content>
        <form.AppForm>
          <Form
            id="authenticationForm"
            onSubmit={(e) => {
              e.preventDefault();
              form.setErrorMap({ onSubmit: { fields: {} } });
              form.handleSubmit();
            }}
          >
            <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
              {(serverError) =>
                serverError && (
                  <Alert
                    isInline
                    variant="danger"
                    title={_("Authentication settings could not be updated")}
                  >
                    {serverError}
                  </Alert>
                )
              }
            </form.Subscribe>

            <form.Subscribe
              selector={(s) =>
                s.isSubmitted && !s.isSubmitting && !s.errorMap.onSubmit?.form && !s.isDirty
              }
            >
              {(showResult) =>
                showResult && (
                  <Alert
                    isInline
                    variant={configWasPatched.current ? "success" : "info"}
                    title={
                      configWasPatched.current
                        ? _("Authentication settings successfully updated")
                        : _("No changes detected. Authentication settings are already up to date.")
                    }
                  />
                )
              }
            </form.Subscribe>

            <FirstUserFields form={form} />
            <RootAuthFields form={form} />

            <ActionGroup>
              <form.SubmitButton label={_("Accept")} />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}
