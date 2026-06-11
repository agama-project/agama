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
import { castArrayIfExists, isEmpty, isNullish } from "radashi";
import { ActionGroup, Alert, Form } from "@patternfly/react-core";

import { useConfig, useUpdateConfig } from "~/hooks/model/config";
import { useFormSubmit } from "~/hooks/use-form-submit";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { anyFieldChanged, mergeFormDefaults, useAppForm } from "~/hooks/form";
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
 * Builds runtime form values from config.
 *
 * Returns only the values that should override the static defaults.
 * Undefined values are automatically removed by mergeFormDefaults, so no
 * fallback to "" is needed.
 */
function buildRuntimeValues(
  firstUser?: User.Config,
  rootUser?: Root.Config,
): Partial<AuthFormValues> {
  return {
    defineUser: !isNullish(firstUser),

    userFullName: firstUser?.fullName,
    userName: firstUser?.userName,

    userPassword: firstUser?.password,
    userPasswordConfirmation: firstUser?.password,

    userUsingHashedPassword: firstUser?.hashedPassword,

    userSshPublicKeys:
      !isEmpty(firstUser?.sshPublicKeys) || !isEmpty(firstUser?.sshPublicKey)
        ? castArrayIfExists(firstUser?.sshPublicKeys || firstUser?.sshPublicKey)
        : undefined,

    rootAuthMode: getAuthModeFromConfig(rootUser),

    rootPassword: rootUser?.password,
    rootPasswordConfirmation: rootUser?.password,

    rootUsingHashedPassword: rootUser?.hashedPassword,

    rootSshPublicKeys:
      !isEmpty(rootUser?.sshPublicKeys) || !isEmpty(rootUser?.sshPublicKey)
        ? castArrayIfExists(rootUser?.sshPublicKeys || rootUser?.sshPublicKey)
        : undefined,
  };
}

/**
 * Builds the user config patch if any user-related field has changed.
 *
 * Returns undefined if no changes are detected (field will be omitted from patch).
 * Returns { user: undefined } to express "delete the first user".
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

  if (!anyFieldChanged(fieldMeta, ...userFields)) return undefined;

  if (!formValues.defineUser) return { user: undefined };

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
 * Returns undefined if no changes are detected (field will be omitted from patch).
 * Returns { root: undefined } to express "remove root authentication".
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

  if (formValues.rootAuthMode === AuthMode.NONE) return { root: undefined };

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

type AuthenticationFormProps = {
  user?: User.Config;
  root?: Root.Config;
};

/**
 * Form for configuring user authentication.
 *
 * Allows the user to configure:
 * - First user: optionally define a first user with admin privileges
 * - Root authentication: choose authentication mode (none, password, SSH key, or both)
 *
 * ## Patterns Used
 *
 * ### withFrozenQuery (see withFrozenQuery.tsx)
 * Wraps this component so it receives frozen initial config as props.
 * Query refetches never reach this component, preventing flickering and
 * protecting user edits.
 *
 * ### useUpdateConfig (see useUpdateConfig.ts)
 * Fetches a truly fresh config at submit time and merges the patch on top.
 * Prevents overwriting unrelated backend changes that happened while the
 * user was editing.
 *
 * ### useFormSubmit (see useFormSubmit.tsx)
 * Encapsulates the submit lifecycle for forms that stay mounted:
 * - Deferred form.reset() after submit (workaround for TanStack Form #1681)
 * - Success/info alert via refs + Subscribe (no extra re-renders)
 * - Clean > dirty transition tracking to hide alert when user edits again
 *
 * ### Field validation
 * Stays in useAppForm's validators.onSubmitAsync where TanStack Form expects it.
 * useFormSubmit's onSubmit is only called after field validation passes.
 */
function AuthenticationForm({ user, root }: AuthenticationFormProps) {
  const updateConfig = useUpdateConfig();

  // useFormSubmit is initialized before useAppForm so we can pass onSubmitAsync
  // directly into the validators option — no mutation, no two-phase wiring.
  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<AuthFormValues>({
    onSubmit: async (values, fieldMeta) => {
      const userConfig = buildUserConfig(values, fieldMeta, user);
      const rootConfig = buildRootAuthConfig(values, fieldMeta, root);

      if (!userConfig && !rootConfig) return { noChanges: true };

      // Build patch explicitly to preserve undefined values (express deletions).
      // shake happens inside useUpdateConfig as it is a transport concern.
      const patch = {
        ...(userConfig !== undefined && { user: userConfig.user }),
        ...(rootConfig !== undefined && { root: rootConfig.root }),
      };

      return updateConfig(patch)
        .then(() => ({ patched: true as const }))
        .catch(({ message }) => ({ error: message }));
    },
  });

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, buildRuntimeValues(user, root)),
    validators: {
      onSubmitAsync: async (ctx) => {
        // Field validation runs first. If it fails, TanStack Form surfaces
        // errors per field and onSubmitAsync (business logic) is not called.
        const fieldErrors = validate(ctx.value);
        if (fieldErrors) return fieldErrors;

        // Business logic: patch building + API call.
        return onSubmitAsync(ctx, form);
      },
    },
  });

  return (
    <form.AppForm>
      <Form id="authenticationForm" onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline variant="danger" title={_("Changes could not be applied")}>
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Success / no-changes / validation error alerts — managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        <FirstUserFields form={form} />
        <RootAuthFields form={form} />

        <ActionGroup>
          <form.SubmitButton label={_("Accept")} />
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

/**
 * Exported component.
 *
 * withFrozenQuery freezes the initial config on mount and passes it as props
 * to the memoized AuthenticationForm. Query refetches update the wrapper but
 * never reach the form, protecting user edits and preventing flickering.
 */
export default withFrozenQuery(useConfig, AuthenticationForm);
