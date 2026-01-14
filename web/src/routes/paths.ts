/*
 * Copyright (c) [2024-2026] SUSE LLC
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

const L10N = {
  root: "/l10n",
  localeSelection: "/l10n/locale/select",
  keymapSelection: "/l10n/keymap/select",
  timezoneSelection: "/l10n/timezone/select",
};

const NETWORK = {
  root: "/network",
  editConnection: "/network/connections/:id/edit",
  editBindingSettings: "/network/connections/:id/binding/edit",
  wifiNetwork: "/network/wifi_networks/:ssid",
  wiredConnection: "/network/wired_connection/:id",
};

const PRODUCT = {
  root: "/products",
  changeProduct: "/products",
  progress: "/products/progress",
};

const REGISTRATION = {
  root: "/registration",
};

const ROOT = {
  root: "/",
  login: "/login",
  overview: "/overview",
  installation: "/installation",
  installationProgress: "/installation/progress",
  installationFinished: "/installation/finished",
  installationExit: "/installation/exit",
  logs: "/api/v2/private/download_logs",
};

const USER = {
  root: "/users",
  firstUser: {
    create: "/users/first",
    edit: "/users/first/edit",
  },
  rootUser: {
    edit: "/users/root/edit",
  },
};

const SOFTWARE = {
  root: "/software",
  patternsSelection: "/software/patterns/select",
  conflicts: "/software/conflicts",
};

const STORAGE = {
  root: "/storage",
  progress: "/storage/progress",
  editBootDevice: "/storage/boot-device/edit",
  editEncryption: "/storage/encryption/edit",
  editSpacePolicy: "/storage/:collection/:index/space-policy/edit",
  formatDevice: "/storage/:collection/:index/format",
  addPartition: "/storage/:collection/:index/partitions/add",
  editPartition: "/storage/:collection/:index/partitions/:partitionId/edit",
  selectDevice: "/storage/devices/select",
  volumeGroup: {
    add: "/storage/volume-groups/add",
    edit: "/storage/volume-groups/:id/edit",
    logicalVolume: {
      add: "/storage/volume-groups/:id/logical-volumes/add",
      edit: "/storage/volume-groups/:id/logical-volumes/:logicalVolumeId/edit",
    },
  },
  iscsi: "/storage/iscsi",
  dasd: "/storage/dasd",
  zfcp: {
    root: "/storage/zfcp",
    activateDisk: "/storage/zfcp/active-disk",
  },
};

const HOSTNAME = {
  root: "/hostname",
};

/**
 * A set of routes that do not directly allow fine-tuning the installation
 * settings for the selected product, but rather serve special purposes, such
 * as authentication (e.g., login), product selection change, or transitions
 * between states (e.g., progress, error, success).
 *
 * These routes are defined separately to adjust the UI accordingly, ensuring
 * that certain core elements, like the Install button, are not displayed when
 * visiting them.
 */
const SIDE_PATHS = [
  ROOT.login,
  PRODUCT.changeProduct,
  PRODUCT.progress,
  ROOT.installationProgress,
  ROOT.installationFinished,
  ROOT.installationExit,
  STORAGE.progress,
];

const EXTENDED_SIDE_PATHS = [...SIDE_PATHS, ROOT.root, ROOT.overview];

export {
  HOSTNAME,
  L10N,
  NETWORK,
  PRODUCT,
  REGISTRATION,
  ROOT,
  SIDE_PATHS,
  EXTENDED_SIDE_PATHS,
  SOFTWARE,
  STORAGE,
  USER,
};
