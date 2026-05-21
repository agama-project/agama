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

import { formOptions } from "@tanstack/react-form";
import { shake } from "radashi";
import { requiredString, requiredValidList } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";

/** Types */

type CredentialsFormFields = {
  usingHashedPassword: boolean;
  password: string;
  passwordConfirmation: string;
  sshPublicKey: string[];
};

type FormFields = {
  authMode: AuthMode;
} & CredentialsFormFields;

/** Exported constants */

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

/** Defaults */

const defaultValues: FormFields = {
  authMode: AuthMode.NONE,
  password: "",
  passwordConfirmation: "",
  usingHashedPassword: false,
  sshPublicKey: [],
};

export const defaultOptions = formOptions({ defaultValues });

/** Validation */

const SSH_PUBLIC_KEY_REGEX = /^(ssh-|ecdsa-|sk-)\S+\s+[A-Za-z0-9+/]+=*(\s+.*)?$/;

export const isValidSshKey = (value: string) => SSH_PUBLIC_KEY_REGEX.test(value);
export const isPrivateKey = (value: string) => value.includes("PRIVATE KEY");

const isValidSshKeyEntry = (key: string): boolean => {
  return isValidSshKey(key) && !isPrivateKey(key);
};

const validateCredentials = (fields: FormFields): FieldsValidationResult<CredentialsFormFields> => {
  const { authMode, usingHashedPassword, password, passwordConfirmation, sshPublicKey } = fields;
  const errors: FieldsValidationResult<CredentialsFormFields> = {};

  const needsPassword = authMode === AuthMode.PASSWORD || authMode === AuthMode.BOTH;
  const needsSshKey = authMode === AuthMode.SSH_KEY || authMode === AuthMode.BOTH;

  if (needsPassword && !usingHashedPassword) {
    errors.password = requiredString(password, _("Password is required"));
    errors.passwordConfirmation = requiredString(
      passwordConfirmation,
      _("Password confirmation is required"),
    );

    if (password && passwordConfirmation && password !== passwordConfirmation) {
      errors.passwordConfirmation = _("Passwords do not match");
    }
  }

  if (needsSshKey) {
    errors.sshPublicKey = requiredValidList(
      sshPublicKey,
      isValidSshKeyEntry,
      _("At least one SSH public key is required"),
      _("Some SSH public keys are invalid"),
    );
  }

  return errors;
};

export function validate(fields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake(validateCredentials(fields));

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
