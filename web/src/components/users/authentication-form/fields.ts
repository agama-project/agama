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
import { requiredString, requiredValidList } from "~/components/form/validation-helpers";
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

type FirstUserFields = {
  define: boolean;
  fullName: string;
  userName: string;
  usernameSuggestions: string[];
  password: string;
  passwordConfirmation: string;
  usingHashedPassword: boolean;
  sshPublicKeys: string[];
};

type RootAuthFields = {
  authMode: AuthMode;
  password: string;
  passwordConfirmation: string;
  usingHashedPassword: boolean;
  sshPublicKeys: string[];
};

type FormFields = {
  firstUser: FirstUserFields;
  root: RootAuthFields;
};

/** Defaults */

const defaultValues: FormFields = {
  firstUser: {
    define: false,
    fullName: "",
    userName: "",
    usernameSuggestions: [],
    password: "",
    passwordConfirmation: "",
    usingHashedPassword: false,
    sshPublicKeys: [],
  },
  root: {
    authMode: AuthMode.NONE,
    password: "",
    passwordConfirmation: "",
    usingHashedPassword: false,
    sshPublicKeys: [],
  },
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
 * Validates first user fields when first user definition is enabled.
 */
function validateFirstUserFields(fields: FormFields): Record<string, string | undefined> {
  if (!fields.firstUser.define) return {};

  const errors: Record<string, string | undefined> = {};

  errors["firstUser.fullName"] = requiredString(
    fields.firstUser.fullName,
    _("Full name is required"),
  );
  errors["firstUser.userName"] = requiredString(
    fields.firstUser.userName,
    _("Username is required"),
  );

  if (!fields.firstUser.usingHashedPassword) {
    errors["firstUser.password"] = requiredString(
      fields.firstUser.password,
      _("Password is required"),
    );
    errors["firstUser.passwordConfirmation"] = requiredString(
      fields.firstUser.passwordConfirmation,
      _("Password confirmation is required"),
    );

    if (
      fields.firstUser.password &&
      fields.firstUser.passwordConfirmation &&
      fields.firstUser.password !== fields.firstUser.passwordConfirmation
    ) {
      errors["firstUser.passwordConfirmation"] = _("Passwords do not match");
    }
  }

  return errors;
}

/**
 * Validates root authentication fields based on selected auth mode.
 */
function validateRootAuthFields(fields: FormFields): Record<string, string | undefined> {
  const { authMode, usingHashedPassword, password, passwordConfirmation } = fields.root;
  const errors: Record<string, string | undefined> = {};

  const needsPassword = authMode === AuthMode.PASSWORD || authMode === AuthMode.BOTH;
  const needsSshKey = authMode === AuthMode.SSH_KEY || authMode === AuthMode.BOTH;

  if (needsPassword && !usingHashedPassword) {
    errors["root.password"] = requiredString(password, _("Password is required"));
    errors["root.passwordConfirmation"] = requiredString(
      passwordConfirmation,
      _("Password confirmation is required"),
    );

    if (password && passwordConfirmation && password !== passwordConfirmation) {
      errors["root.passwordConfirmation"] = _("Passwords do not match");
    }
  }

  if (needsSshKey) {
    errors["root.sshPublicKeys"] = requiredValidList(
      fields.root.sshPublicKeys,
      isValidSshKeyEntry,
      _("At least one SSH public key is required"),
      _("Some SSH public keys are invalid"),
    );
  }

  return errors;
}

/**
 * Validates the authentication form fields.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
export function validate(formFields: FormFields): { fields?: Record<string, string> } | undefined {
  const fieldErrors = shake({
    ...validateFirstUserFields(formFields),
    ...validateRootAuthFields(formFields),
  });

  if (Object.keys(fieldErrors).length > 0) return { fields: fieldErrors };
}
