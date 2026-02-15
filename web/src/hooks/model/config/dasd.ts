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

import { useSuspenseQuery } from "@tanstack/react-query";
import { configQuery } from "~/hooks/model/config";
import { patchConfig, Response } from "~/api";
import dasdConfig from "~/model/config/dasd";

import type { Config, DASD } from "~/model/config";

type addDeviceFn = (device: DASD.Device) => Response;
type removeDeviceFn = (name: DASD.Device["channel"]) => Response;

/**
 * Extract DASD config from a config object.
 *
 * @remarks
 * Used by useSuspenseQuery's select option to transform the query result.
 * Returns undefined when data is undefined or when dasd property is not present.
 *
 * @see {@link https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations#select TanStack Query Select}
 * @see {@link https://tkdodo.eu/blog/react-query-selectors-supercharged#what-is-select Query Selectors Supercharged}
 *
 * FIXME: Read todo note below.
 * @todo Consider returning an empty object ({}) instead of undefined to simplify
 * consuming code and eliminate the need for fallback checks throughout the codebase.
 */
const dasdSelector = (data: Config | undefined): DASD.Config => data?.dasd;

/**
 * Hook to retrieve DASD configuration object.
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const dasdConfig = useConfig();
 *   return <div>{dasdConfig?.devices.length} devices</div>;
 * }
 * ```
 */
function useConfig(): DASD.Config | undefined {
  const { data } = useSuspenseQuery({
    ...configQuery,
    select: dasdSelector,
  });
  return data;
}

/**
 * Add a device to DASD configuration.
 *
 * @remarks
 * Falls back to empty config when useConfig returns undefined.
 *
 * @todo Remove fallback once useConfig returns empty object by default
 */
function useAddDevice(): addDeviceFn {
  const config = useConfig();

  return (device: DASD.Device) => {
    return patchConfig({
      // FIXME: useConfig should return an empty object instead of falling back
      // to an empty object all the time
      dasd: dasdConfig.addDevice(config || {}, device),
    });
  };
}

/**
 * Remove a device from DASD configuration by channel.
 *
 * @remarks
 * Falls back to empty config when useConfig returns undefined.
 *
 * @todo Remove fallback once useConfig returns empty object by default
 */
function useRemoveDevice(): removeDeviceFn {
  const config = useConfig();

  return (channel: string) =>
    patchConfig({
      // FIXME: useConfig should return an empty object instead of falling back
      // to an empty object all the time
      dasd: dasdConfig.removeDevice(config || {}, channel),
    });
}

export { useConfig, useAddDevice, useRemoveDevice };
export type { addDeviceFn, removeDeviceFn };
