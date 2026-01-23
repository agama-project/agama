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

type System = {
  addons: AddonInfo[];
  patterns: Pattern[];
  repositories: Repository[];
  registration?: RegistrationInfo;
};

type Pattern = {
  /** Pattern name (internal ID) */
  name: string;
  /** Pattern category */
  category: string;
  /** User visible pattern name */
  summary: string;
  /** Long description of the pattern */
  description: string;
  /** {number} order - Display order (string!) */
  order: number;
  /** Icon name (not path or file name!) */
  icon: string;
  /** Whether the pattern is selected by default */
  preselected: boolean;
};

type Repository = {
  repo_id: number;
  alias: string;
  name: string;
  raw_url: string;
  product_dir: string;
  enabled: boolean;
  loaded: boolean;
};

type RegistrationInfo = {
  code?: string;
  email?: string;
  // FIXME: it should be mandatory.
  url?: string;
  addons: AddonInfo[];
};

type AddonInfo = {
  id: string;
  status: string;
  version: string;
  label: string;
  available: boolean;
  free: boolean;
  recommended: boolean;
  description: string;
  release: string;
  registration: AddonRegistered | AddonUnregistered;
};

type AddonRegistered = {
  status: "registered";
  code?: string;
};

type AddonUnregistered = {
  status: "notRegistered";
};

export type { System, Pattern, RegistrationInfo, Repository };
