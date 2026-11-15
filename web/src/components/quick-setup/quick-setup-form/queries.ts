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

import { useInstallerL10n } from "~/context/installerL10n";
import { useConfig } from "~/hooks/model/config";
import { useProduct, useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useCandidateDrives, useSystem as useStorageSystem } from "~/hooks/model/system/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { timezoneFor } from "./timezones";

import type { Config } from "~/model/config";
import type { ConfigModel } from "~/model/storage/config-model";
import type { License, Product, Storage } from "~/model/system";
import type { Timezone } from "~/model/system/l10n";

/**
 * Everything the Quick setup form needs: what to choose from (from the system)
 * and what is set already (from the config), for reopening Quick setup.
 */
type QuickSetupData = {
  products: Product[];
  licenses: License[];
  timezones: Timezone[];
  /** The disks the system can be installed on. */
  disks: Storage.Device[];
  /** The storage devices of the system. */
  storageSystem: Storage.System | null;
  /** The storage setup, once there is a product. */
  storageModel: ConfigModel.Config | null;
  /** The settings someone set, not the defaults Agama fills in. */
  config: Config | null;
  currentProduct?: Product;
  currentMode?: string;
  /** The time zone guessed from the installer language, if any. */
  guessedTimezone?: string;
};

function useQuickSetupData(): QuickSetupData {
  const { products = [], licenses = [], l10n } = useSystem() ?? {};
  const config = useConfig();
  const currentProduct = useProductInfo() ?? undefined;
  const currentMode = useProduct()?.mode;
  const { language } = useInstallerL10n();
  const timezones = l10n?.timezones ?? [];
  const disks = useCandidateDrives();
  const storageSystem = useStorageSystem();
  const storageModel = useConfigModel();

  return {
    products,
    licenses,
    timezones,
    disks,
    storageSystem,
    storageModel,
    config,
    currentProduct,
    currentMode,
    guessedTimezone: timezoneFor(language, timezones),
  };
}

export { useQuickSetupData };
export type { QuickSetupData };
