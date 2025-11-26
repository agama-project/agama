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

import { useCallback } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getConfig, getExtendedConfig } from "~/api";
import { useSystem } from "~/hooks/api/system";
import type { system } from "~/api";
import type { Config } from "~/api/config";

const extendedConfigQuery = {
  queryKey: ["extendedConfig"],
  queryFn: getExtendedConfig,
};

const configQuery = {
  queryKey: ["config"],
  queryFn: getConfig,
};

function useExtendedConfig(): Config | null {
  return useSuspenseQuery(extendedConfigQuery)?.data;
}

// Returns the information of the current selected product from the list of products provided by
// the system.
function useProduct(): system.Product | null {
  const products = useSystem()?.products;
  const { data } = useSuspenseQuery({
    ...extendedConfigQuery,
    select: useCallback(
      (data: Config | null): system.Product | null => {
        return products?.find((p) => p.id === data?.product?.id) || null;
      },
      [products],
    ),
  });
  return data;
}

export { configQuery, extendedConfigQuery, useExtendedConfig, useProduct };
export * as storage from "~/hooks/api/config/storage";
