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

import { isEmpty, shake, sift } from "radashi";
import { sprintf } from "sprintf-js";
import { requiredString } from "~/components/form/validation-helpers";
import { productLicenses } from "~/components/product/licenses";
import { _, formatList, n_ } from "~/i18n";

import type { ValidationResult } from "~/components/form/validation-helpers";
import { isEmptyDisk } from "./storage";
import { changesProduct } from "./transformations";
import { AUTHENTICATION } from "./fields";

import type { FormFields } from "./fields";
import type { QuickSetupData } from "./queries";

/**
 * Which accounts the fields set: none while the ones already set are kept,
 * whatever option the choice holds meanwhile.
 */
const chosenAuthentication = ({ authentication, keepsAuthentication }: FormFields) => ({
  isUser: !keepsAuthentication && authentication === AUTHENTICATION.USER,
  isRoot: !keepsAuthentication && authentication === AUTHENTICATION.ROOT,
});

/** The licenses of the picked product not accepted yet. */
const pendingLicenses = (formValues: FormFields, { products, licenses }: QuickSetupData) => {
  const product = products.find((p) => p.id === formValues.product);
  return productLicenses(product, licenses).filter(
    (l) => !formValues.acceptedLicenses.includes(l.id),
  );
};

/**
 * What is still empty. Every field is required: the product, its mode and
 * licenses when it has any, the location, the disk and what to do with its
 * content (unless it is empty, or a storage setup made elsewhere is kept), how
 * to authenticate and what that choice needs.
 */
function missingValues(formValues: FormFields, data: QuickSetupData) {
  const { products, disks } = data;
  const product = products.find((p) => p.id === formValues.product);
  const disk = disks.find((d) => d.name === formValues.disk);
  // A storage setup made elsewhere is kept unless the product changes, which
  // resets it.
  const asksStorage = !formValues.keepsCustomStorage || changesProduct(formValues, data);
  const needsMode = !isEmpty(product?.modes);
  const { isUser, isRoot } = chosenAuthentication(formValues);

  const fieldErrors = shake({
    // TRANSLATORS: error when no product is selected
    product: requiredString(formValues.product, _("Select a product")),
    // TRANSLATORS: error when the product has modes and none is selected
    mode: needsMode ? requiredString(formValues.mode, _("Select a mode")) : undefined,
    acceptedLicenses: isEmpty(pendingLicenses(formValues, data))
      ? undefined
      : // TRANSLATORS: error when the product license is not accepted yet
        _("License acceptance is required to continue."),
    // TRANSLATORS: error when no location (time zone) is selected
    timezone: requiredString(formValues.timezone, _("Select a location")),
    // TRANSLATORS: error when no installation disk is selected
    disk: asksStorage ? requiredString(formValues.disk, _("Select a disk")) : undefined,
    existingContent:
      asksStorage && disk && !isEmptyDisk(disk)
        ? // TRANSLATORS: error when it is not said what to do with the disk content
          requiredString(formValues.existingContent, _("Select an option"))
        : undefined,
    authentication: formValues.keepsAuthentication
      ? undefined
      : requiredString(
          formValues.authentication,
          // TRANSLATORS: error when no way to log in is selected
          _("Select how to authenticate"),
        ),
    fullName: isUser
      ? // TRANSLATORS: error when the full name of the user is empty
        requiredString(formValues.fullName, _("Full name is required"))
      : undefined,
    userName: isUser
      ? // TRANSLATORS: error when the name to log in with is empty
        requiredString(formValues.userName, _("Username is required"))
      : undefined,
    userPassword: isUser
      ? // TRANSLATORS: error when the password of the user is empty
        requiredString(formValues.userPassword, _("Password is required"))
      : undefined,
    userPasswordConfirmation: isUser
      ? requiredString(
          formValues.userPasswordConfirmation,
          // TRANSLATORS: error when the password of the user is not repeated
          _("Password confirmation is required"),
        )
      : undefined,
    rootPassword: isRoot
      ? // TRANSLATORS: error when the password of root is empty
        requiredString(formValues.rootPassword, _("Password is required"))
      : undefined,
    rootPasswordConfirmation: isRoot
      ? requiredString(
          formValues.rootPasswordConfirmation,
          // TRANSLATORS: error when the password of root is not repeated
          _("Password confirmation is required"),
        )
      : undefined,
  });

  return fieldErrors;
}

/**
 * What is still missing, as a sentence to tell next to Accept, nothing when
 * the form is complete. It names the choices left by the names the user sees
 * on screen, e.g. "Choose the installation disk and location to continue.",
 * and asks for the licenses only once they are all that is left.
 */
export function missingSummary(formValues: FormFields, data: QuickSetupData) {
  const missing = missingValues(formValues, data);
  const names = sift([
    // TRANSLATORS: part of "Choose the %s to continue", the product to install
    missing.product && _("product"),
    // TRANSLATORS: part of "Choose the %s to continue", the product mode
    missing.mode && _("mode"),
    // TRANSLATORS: part of "Choose the %s to continue", the disk to install on
    missing.disk && _("installation disk"),
    // TRANSLATORS: part of "Choose the %s to continue", what to do with what
    // is on the disk
    missing.existingContent && _("existing content"),
    // TRANSLATORS: part of "Choose the %s to continue", how to log in to the
    // installed system
    (missing.authentication ||
      missing.fullName ||
      missing.userName ||
      missing.userPassword ||
      missing.userPasswordConfirmation ||
      missing.rootPassword ||
      missing.rootPasswordConfirmation) &&
      _("authentication"),
    // TRANSLATORS: part of "Choose the %s to continue", the time zone
    missing.timezone && _("location"),
  ]);

  if (!isEmpty(names)) {
    return sprintf(
      // TRANSLATORS: shown below the Accept button while something is missing.
      // %s is a list of what, e.g. "installation disk and location".
      _("Choose the %s to continue."),
      formatList(names, { type: "conjunction" }),
    );
  }

  if (missing.acceptedLicenses) {
    return n_(
      // TRANSLATORS: shown below the Accept button when only accepting the
      // product license is left
      "Accept the license to continue.",
      // TRANSLATORS: shown below the Accept button when only accepting the
      // product licenses is left
      "Accept the licenses to continue.",
      pendingLicenses(formValues, data).length,
    );
  }

  return undefined;
}

/** The confirmation of the password in use, if it does not match it. */
const confirmationError = (password: string, confirmation: string, isInUse: boolean) =>
  isInUse && confirmation && password !== confirmation
    ? // TRANSLATORS: error when the password and its confirmation differ
      _("Passwords do not match")
    : undefined;

/**
 * Validates the Quick setup form against what the system offers: every field
 * filled in (see {@link missingSummary}), and each password typed twice the same.
 */
export function validate(
  formValues: FormFields,
  data: QuickSetupData,
): ValidationResult<FormFields> {
  const missing = missingValues(formValues, data);
  const { isUser, isRoot } = chosenAuthentication(formValues);
  const fieldErrors = shake({
    ...missing,
    userPasswordConfirmation:
      missing.userPasswordConfirmation ??
      confirmationError(formValues.userPassword, formValues.userPasswordConfirmation, isUser),
    rootPasswordConfirmation:
      missing.rootPasswordConfirmation ??
      confirmationError(formValues.rootPassword, formValues.rootPasswordConfirmation, isRoot),
  });

  return isEmpty(fieldErrors) ? undefined : { fields: fieldErrors };
}
