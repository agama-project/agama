/*
 * Copyright (c) [2024-2025] SUSE LLC
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
  wifis: "/network/wifis",
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
  logs: "/api/manager/logs/store",
  welcomePage: "/welcome",
};

const USER = {
  root: "/users",
  rootUser: {
    edit: "/users/root/edit",
  },
  firstUser: {
    create: "/users/first",
    edit: "/users/first/edit",
  },
};

const SOFTWARE = {
  root: "/software",
  patternsSelection: "/software/patterns/select",
};

const STORAGE = {
  root: "/storage",
  targetDevice: "/storage/target-device",
  bootingPartition: "/storage/booting-partition",
  spacePolicy: "/storage/space-policy",
  iscsi: "/storage/iscsi",
  dasd: "/storage/dasd",
  zfcp: {
    root: "/storage/zfcp",
    activateDisk: "/storage/zfcp/active-disk",
  },
};

const SUPPORTIVE_PATHS = [
  ROOT.welcomePage,
  ROOT.login,
  PRODUCT.changeProduct,
  PRODUCT.progress,
  ROOT.installationProgress,
  ROOT.installationFinished,
  USER.rootUser.edit,
];

export { L10N, NETWORK, PRODUCT, REGISTRATION, ROOT, SOFTWARE, STORAGE, USER, SUPPORTIVE_PATHS };
