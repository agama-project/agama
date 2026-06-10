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

/**
 * Authentication form fields: types, defaults, and validation.
 *
 * Consolidates all authentication concerns (first user and root authentication)
 * in a single module following the system-form pattern.
 */

import { formOptions } from "@tanstack/react-form";
import { shake } from "radashi";
import {
  FieldsValidationResult,
  optionalValidList,
  requiredString,
  requiredValidList,
  ValidationResult,
} from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

/** Constants */

/**
 * Authentication mode for the root user.
 *
 * - NONE: No authentication configured
 * - PASSWORD: Password-based authentication
 * - SSH_KEY: SSH public key authentication
 * - BOTH: Both password and SSH key authentication
 */
export const AuthMode = {
  NONE: "none",
  PASSWORD: "password",
  SSH_KEY: "sshKey",
  BOTH: "both",
} as const;

export type AuthMode = (typeof AuthMode)[keyof typeof AuthMode];

/**
 * Determines which authentication methods are needed for the given mode.
 */
export const authModeRequirements = (authMode: AuthMode) => ({
  needsPassword: authMode === AuthMode.PASSWORD || authMode === AuthMode.BOTH,
  needsSshKey: authMode === AuthMode.SSH_KEY || authMode === AuthMode.BOTH,
});

/** Types */

export type UserFormFields = {
  defineUser: boolean;
  userFullName: string;
  userName: string;
  usernameSuggestions: string[];
  userPassword: string;
  userPasswordConfirmation: string;
  userUsingHashedPassword: boolean;
  userSshPublicKeys: string[];
};

export type RootFormFields = {
  rootAuthMode: AuthMode;
  rootPassword: string;
  rootPasswordConfirmation: string;
  rootUsingHashedPassword: boolean;
  rootSshPublicKeys: string[];
};

type FormFields = UserFormFields & RootFormFields;

/** Defaults */

const defaultValues: FormFields = {
  defineUser: false,
  userFullName: "",
  userName: "",
  usernameSuggestions: [],
  userPassword: "",
  userPasswordConfirmation: "",
  userUsingHashedPassword: false,
  userSshPublicKeys: [],
  rootAuthMode: AuthMode.NONE,
  rootPassword: "",
  rootPasswordConfirmation: "",
  rootUsingHashedPassword: false,
  rootSshPublicKeys: [],
};

export const defaultOptions = formOptions({ defaultValues });

/** Validation */

const SSH_PUBLIC_KEY_REGEX = /^(ssh-|ecdsa-|sk-)\S+\s+[A-Za-z0-9+/]+=*(\s+.*)?$/;

export const isValidSshKey = (value: string) => SSH_PUBLIC_KEY_REGEX.test(value);
export const isPrivateKey = (value: string) => value.includes("PRIVATE KEY");

/**
 * Validates a single SSH public key entry.
 */
const isValidSshKeyEntry = (key: string): boolean => {
  return isValidSshKey(key) && !isPrivateKey(key);
};

/**
 * Validates user fields when user definition is enabled.
 */
function validateUserFields(fields: FormFields): FieldsValidationResult<UserFormFields> {
  if (!fields.defineUser) return {};

  const passwordMismatch =
    !fields.userUsingHashedPassword &&
    fields.userPassword &&
    fields.userPasswordConfirmation &&
    fields.userPassword !== fields.userPasswordConfirmation;

  return {
    userFullName: requiredString(fields.userFullName, _("Full name is required")),
    userName: requiredString(fields.userName, _("Username is required")),
    userPassword: !fields.userUsingHashedPassword
      ? requiredString(fields.userPassword, _("Password is required"))
      : undefined,
    userPasswordConfirmation: passwordMismatch
      ? _("Passwords do not match")
      : !fields.userUsingHashedPassword
        ? requiredString(fields.userPasswordConfirmation, _("Password confirmation is required"))
        : undefined,
    userSshPublicKeys: optionalValidList(
      fields.userSshPublicKeys,
      isValidSshKeyEntry,
      _("Some SSH public keys are invalid"),
    ),
  };
}

/**
 * Validates root authentication fields based on selected auth mode.
 */
function validateRootAuthFields(fields: FormFields): FieldsValidationResult<RootFormFields> {
  const { needsPassword, needsSshKey } = authModeRequirements(fields.rootAuthMode);

  const passwordMismatch =
    needsPassword &&
    !fields.rootUsingHashedPassword &&
    fields.rootPassword &&
    fields.rootPasswordConfirmation &&
    fields.rootPassword !== fields.rootPasswordConfirmation;

  return {
    rootPassword:
      needsPassword && !fields.rootUsingHashedPassword
        ? requiredString(fields.rootPassword, _("Password is required"))
        : undefined,
    rootPasswordConfirmation: passwordMismatch
      ? _("Passwords do not match")
      : needsPassword && !fields.rootUsingHashedPassword
        ? requiredString(fields.rootPasswordConfirmation, _("Password confirmation is required"))
        : undefined,
    rootSshPublicKeys: needsSshKey
      ? requiredValidList(
          fields.rootSshPublicKeys,
          isValidSshKeyEntry,
          _("At least one SSH public key is required"),
          _("Some SSH public keys are invalid"),
        )
      : undefined,
  };
}

/**
 * Validates the authentication form fields.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
export function validate(formFields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateUserFields(formFields),
    ...validateRootAuthFields(formFields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
