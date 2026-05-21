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

import { formOptions } from "@tanstack/react-form";
import { shake } from "radashi";
import { requiredString } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";

/** Types */

type UserFormFields = {
  fullName: string;
  userName: string;
  usernameSuggestions: string[];
};

type CredentialsFormFields = {
  usingHashedPassword: boolean;
  password: string;
  passwordConfirmation: string;
  sshPublicKey?: string[];
};

type FormFields = UserFormFields & CredentialsFormFields;

/** Defaults */

const defaultValues: FormFields = {
  fullName: "",
  userName: "",
  password: "",
  passwordConfirmation: "",
  usingHashedPassword: false,
  sshPublicKey: [],
  usernameSuggestions: [],
};

export const defaultOptions = formOptions({ defaultValues });

/** Validation */

const SSH_PUBLIC_KEY_REGEX = /^(ssh-|ecdsa-|sk-)\S+\s+[A-Za-z0-9+/]+=*(\s+.*)?$/;

export const isValidSshKey = (value: string) => SSH_PUBLIC_KEY_REGEX.test(value);
export const isPrivateKey = (value: string) => value.includes("PRIVATE KEY");

const validateSshPublicKey = (key: string): string | undefined => {
  if (isPrivateKey(key)) return _("Private keys are not allowed");
  if (!isValidSshKey(key)) return _("Invalid SSH public key");
};

const validateCredentialsFields = (
  fields: FormFields,
): FieldsValidationResult<CredentialsFormFields> => {
  const { usingHashedPassword, password, passwordConfirmation, sshPublicKey } = fields;

  const errors: FieldsValidationResult<FormFields> = {};

  if (!usingHashedPassword) {
    errors.password = requiredString(password, _("Password is required"));
    errors.passwordConfirmation = requiredString(
      passwordConfirmation,
      _("Password confirmation is required"),
    );

    if (password && passwordConfirmation && password !== passwordConfirmation) {
      errors.passwordConfirmation = _("Passwords do not match");
    }
  }

  const invalidKey = sshPublicKey.find((key) => validateSshPublicKey(key) !== undefined);
  if (invalidKey) {
    errors.sshPublicKey = validateSshPublicKey(invalidKey);
  }

  return errors;
};

const validateUserFields = (fields: FormFields): FieldsValidationResult<UserFormFields> => {
  const { fullName, userName } = fields;

  return {
    fullName: requiredString(fullName, _("Full name is required")),
    userName: requiredString(userName, _("Username is required")),
  };
};

export function validate(fields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateUserFields(fields),
    ...validateCredentialsFields(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
