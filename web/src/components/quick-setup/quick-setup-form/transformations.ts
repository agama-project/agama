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
 * Mapping between the Quick setup form values and the installation config.
 */

import { isEmpty, shake } from "radashi";
import { productLicenses } from "~/components/product/licenses";
import { getRootAuthType, hasAccounts, isUserDefined } from "~/components/users/ConfiguredAccounts";
import configModel from "~/model/storage/config-model";
import { findDeviceByName } from "~/model/system/storage";
import { AUTHENTICATION, EXISTING_CONTENT, defaultOptions } from "./fields";
import { isEmptyDisk, modelDisks, quickSetupStorage } from "./storage";

import type { Config } from "~/model/config";
import type * as L10n from "~/model/config/l10n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import type { FormFields } from "./fields";
import type { QuickSetupData } from "./queries";

/** Whether the form values change a product already set. */
export function changesProduct(
  formValues: FormFields,
  { currentProduct, currentMode }: Pick<QuickSetupData, "currentProduct" | "currentMode">,
): boolean {
  return (
    !!currentProduct &&
    (formValues.product !== currentProduct.id || formValues.mode !== (currentMode ?? ""))
  );
}

type Account = { password?: string; hashedPassword?: boolean };

/** The password of an account, if it can be shown: a hashed one cannot. */
const plainPassword = (account?: Account) =>
  account?.hashedPassword ? "" : (account?.password ?? "");

/**
 * The option matching the accounts set, so replacing them starts from it: the
 * administrator user if there is one, root otherwise.
 */
function authenticationOf(config: Config | null): FormFields["authentication"] {
  if (!config) return "";
  if (isUserDefined(config)) return AUTHENTICATION.USER;
  if (getRootAuthType(config) !== "none") return AUTHENTICATION.ROOT;
  return "";
}

/**
 * Builds the initial form values. A new installation starts empty, but for the
 * only product of the medium and the location guessed from the language;
 * reopening Quick setup starts from what is set.
 */
export function toFormValues({
  products,
  licenses,
  disks,
  storageModel,
  config,
  currentProduct,
  currentMode,
  guessedTimezone,
}: QuickSetupData): FormFields {
  const product = currentProduct ?? (products.length === 1 ? products[0] : undefined);
  // Without a product there is no storage setup to start from yet.
  const storage = currentProduct ? quickSetupStorage(storageModel) : undefined;
  const hasCustomStorage = !!currentProduct && !storage && !isEmpty(modelDisks(storageModel));

  return {
    ...defaultOptions.defaultValues,
    product: product?.id ?? "",
    mode: currentProduct ? (currentMode ?? "") : "",
    // The licenses of the current product were accepted when it was chosen.
    acceptedLicenses: currentProduct
      ? productLicenses(currentProduct, licenses).map((l) => l.id)
      : [],
    timezone: config?.l10n?.timezone ?? guessedTimezone ?? "",
    disk: storage?.disk ?? (disks.length === 1 ? disks[0].name : ""),
    existingContent: storage?.existingContent ?? "",
    keepsCustomStorage: hasCustomStorage,
    // Accounts already set are kept, told in place of the choice. Asking to
    // change them starts from what is set: the matching option, with what can
    // be shown filled in; a hashed password cannot, so it is typed anew.
    keepsAuthentication: !!config && hasAccounts(config),
    authentication: authenticationOf(config),
    fullName: config?.user?.fullName ?? "",
    userName: config?.user?.userName ?? "",
    userPassword: plainPassword(config?.user),
    userPasswordConfirmation: plainPassword(config?.user),
    rootPassword: plainPassword(config?.root),
    rootPasswordConfirmation: plainPassword(config?.root),
  };
}

type BuildConfigOptions = {
  /** The settings someone set so far. */
  config: Config | null;
  /** Whether the product is set (first time) or changed with this config. */
  setsProduct: boolean;
  /** The installer language and keyboard the product takes, if any. */
  installerL10n?: L10n.Config;
};

/**
 * The accounts to log in with, as picked: only the chosen one, with only what
 * is on screen. Anything else set before, such as the other account or SSH
 * keys, is left out. "Configure it later" sets none.
 */
function chosenAccounts(formValues: FormFields): Pick<Config, "user" | "root"> {
  if (formValues.authentication === AUTHENTICATION.USER) {
    return {
      user: {
        fullName: formValues.fullName,
        userName: formValues.userName,
        password: formValues.userPassword,
        hashedPassword: false,
      },
    };
  }

  if (formValues.authentication === AUTHENTICATION.ROOT) {
    return { root: { password: formValues.rootPassword, hashedPassword: false } };
  }

  return {};
}

/**
 * Builds the config to save: the product when it is set or changed, the
 * location (with the installer language and keyboard the product takes), and
 * the accounts: the ones already set when kept, as they are, or else the ones
 * picked (see {@link chosenAccounts}).
 */
export function buildConfig(
  formValues: FormFields,
  { config, setsProduct, installerL10n }: BuildConfigOptions,
): Config {
  // Kept accounts go as they are, so a config replaced along with the product
  // keeps them too.
  const { user, root } = formValues.keepsAuthentication
    ? { user: config?.user, root: config?.root }
    : chosenAccounts(formValues);

  return shake({
    product: setsProduct
      ? shake({ id: formValues.product, mode: formValues.mode || undefined })
      : undefined,
    l10n: { ...installerL10n, timezone: formValues.timezone },
    user,
    root,
  });
}

/**
 * Builds the storage setup for the picked disk and existing content, from the
 * setup the product proposes: its disk moved to the picked one, with the space
 * policy for the existing content. An empty disk has nothing to keep, so the
 * whole of it is used. Returns undefined when the product proposes no disk.
 */
export function buildStorageModel(
  formValues: FormFields,
  model: ConfigModel.Config | null,
  system: Storage.System | null,
): ConfigModel.Config | undefined {
  const drive = model?.drives?.[0];
  const device = drive && findDeviceByName(system, drive.name);
  const target = findDeviceByName(system, formValues.disk);
  if (!device || !target) return undefined;

  const converted =
    device.name === target.name ? model : configModel.device.convert(model, device, target);
  const policy = isEmptyDisk(target) ? EXISTING_CONTENT.DELETE : formValues.existingContent;

  return configModel.device.setSpacePolicy(converted, "drives", 0, {
    type: policy || EXISTING_CONTENT.DELETE,
  });
}
