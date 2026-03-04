/*
 * Copyright (c) [2025] SUSE LLC
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

import { useSuspenseQuery } from "@tanstack/react-query";
import { getConfig, getExtendedConfig } from "~/api";
import type { Config } from "~/model/config";

const CONFIG_KEY = "config";
const EXTENDED_CONFIG_KEY = "extendedConfig";

const configQuery = {
  queryKey: [CONFIG_KEY],
  queryFn: getConfig,
};

function useConfig(): Config | null {
  return useSuspenseQuery(configQuery)?.data;
}

const extendedConfigQuery = {
  queryKey: [EXTENDED_CONFIG_KEY],
  queryFn: getExtendedConfig,
};

function useExtendedConfig(): Config | null {
  return useSuspenseQuery(extendedConfigQuery)?.data;
}

export {
  CONFIG_KEY,
  EXTENDED_CONFIG_KEY,
  configQuery,
  extendedConfigQuery,
  useConfig,
  useExtendedConfig,
};
export * as network from "~/hooks/model/config/network";
export * as product from "~/hooks/model/config/product";
export * as storage from "~/hooks/model/config/storage";
export * as iscsi from "~/hooks/model/config/iscsi";
