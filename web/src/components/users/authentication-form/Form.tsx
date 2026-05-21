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
import { putConfig } from "~/api";
import { useConfig } from "~/hooks/model/config";
import { anyFieldChanged, useAppForm } from "~/hooks/form";
import { _ } from "~/i18n";

import FirstUserFields from "./FirstUserFields";
import RootAuthFields from "./RootAuthFields";
import { AuthMode, authModeRequirements, defaultOptions, validate } from "./fields";

import type { User, Root } from "~/model/config";

type AuthFormValues = typeof defaultOptions.defaultValues;
type AuthFieldMeta = Record<string, { isDefaultValue?: boolean }>;

/**
 * Determines the authentication mode from the root user configuration.
 */
const getAuthModeFromConfig = (rootUser?: Root.Config): AuthMode => {
  if (!rootUser) return AuthMode.NONE;

  const hasPassword = !isEmpty(rootUser.password);
  const hasSshKey = !isEmpty(rootUser.sshPublicKey) || !isEmpty(rootUser.sshPublicKeys);

  if (hasPassword && hasSshKey) return AuthMode.BOTH;
  if (hasPassword) return AuthMode.PASSWORD;
  if (hasSshKey) return AuthMode.SSH_KEY;
  return AuthMode.NONE;
};

/**
 * Builds the user config patch if any user-related field has changed.
 *
 * Returns undefined if no changes are detected, which will be shaken out of the
 * final config.
 */
function buildUserConfig(
  formValues: AuthFormValues,
  fieldMeta: AuthFieldMeta,
  currentFirstUser?: User.Config,
): { user?: User.Config } | undefined {
  const userFields = [
    "defineUser",
    "userFullName",
    "userName",
    "userPassword",
    "userPasswordConfirmation",
    "userUsingHashedPassword",
    "userSshPublicKeys",
  ];

  if (!anyFieldChanged(fieldMeta, ...userFields)) {
    return undefined;
  }

  if (!formValues.defineUser) {
    return { user: undefined };
  }

  return {
    user: {
      fullName: formValues.userFullName,
      userName: formValues.userName,
      password: formValues.userUsingHashedPassword
        ? currentFirstUser?.password || ""
        : formValues.userPassword,
      hashedPassword: formValues.userUsingHashedPassword,
      sshPublicKeys: formValues.userSshPublicKeys,
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
): { root?: Partial<Root.Config> } | undefined {
  const { needsPassword, needsSshKey } = authModeRequirements(formValues.rootAuthMode);

  const fieldsToCheck = [
    "rootAuthMode",
    ...(needsPassword
      ? ["rootPassword", "rootPasswordConfirmation", "rootUsingHashedPassword"]
      : []),
    ...(needsSshKey ? ["rootSshPublicKeys"] : []),
  ];

  if (!anyFieldChanged(fieldMeta, ...fieldsToCheck)) return undefined;

  if (formValues.rootAuthMode === AuthMode.NONE) {
    return { root: undefined };
  }

  const data: Partial<Root.Config> = {};

  if (needsPassword) {
    data.password = formValues.rootUsingHashedPassword
      ? currentRootUser?.password || ""
      : formValues.rootPassword;
    data.hashedPassword = formValues.rootUsingHashedPassword;
  }

  if (needsSshKey) {
    data.sshPublicKeys = formValues.rootSshPublicKeys;
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
  const config = useConfig();
  const { user: firstUser, root: rootUser } = config;

  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      defineUser: !isNullish(firstUser),
      userFullName: firstUser?.fullName || "",
      userName: firstUser?.userName || "",
      usernameSuggestions: [],
      userPassword: firstUser?.password || "",
      userPasswordConfirmation: firstUser?.password || "",
      userUsingHashedPassword: firstUser?.hashedPassword || false,
      userSshPublicKeys:
        isEmpty(firstUser?.sshPublicKeys) && isEmpty(firstUser?.sshPublicKey)
          ? []
          : castArrayIfExists(firstUser?.sshPublicKeys || firstUser?.sshPublicKey),
      rootAuthMode: getAuthModeFromConfig(rootUser),
      rootPassword: rootUser?.password || "",
      rootPasswordConfirmation: rootUser?.password || "",
      rootUsingHashedPassword: rootUser?.hashedPassword || false,
      rootSshPublicKeys:
        isEmpty(rootUser?.sshPublicKeys) && isEmpty(rootUser?.sshPublicKey)
          ? []
          : castArrayIfExists(rootUser?.sshPublicKeys || rootUser?.sshPublicKey),
    },
    validators: {
      onSubmitAsync: async ({ value: formValues, formApi }) => {
        configWasPatched.current = false;

        if (!formApi.state.isDirty) return undefined;

        const fieldErrors = validate(formValues);
        if (fieldErrors) return fieldErrors;

        const { fieldMeta } = formApi.state;

        const userConfig = buildUserConfig(formValues, fieldMeta, firstUser);
        const rootConfig = buildRootAuthConfig(formValues, fieldMeta, rootUser);

        if (!userConfig && !rootConfig) {
          form.reset(formValues);
          return undefined;
        }

        const finalConfig = shake({
          ...config,
          ...(userConfig && { user: userConfig.user }),
          ...(rootConfig && { root: rootConfig.root }),
        });

        return await putConfig(finalConfig)
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
  );
}
