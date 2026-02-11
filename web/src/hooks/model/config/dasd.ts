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
import dasd from "~/model/config/dasd";
import type { Config, DASD } from "~/model/config";

const selectConfig = (data: Config | null): DASD.Config => data?.dasd;

function useConfig(): DASD.Config | null {
  const { data } = useSuspenseQuery({
    ...configQuery,
    select: selectConfig,
  });
  return data;
}

const addDevice = (config: DASD.Config | null, device: DASD.Device): DASD.Config =>
  config ? dasd.addDevice(config, device) : { devices: [device] };

type addDeviceFn = (device: DASD.Device) => Response;

function useAddDevice(): addDeviceFn {
  const config = useConfig();
  return (device: DASD.Device) => patchConfig({ dasd: addDevice(config, device) });
}

const removeDevice = (config: DASD.Config | null, channel: string): DASD.Config =>
  config ? dasd.removeDevice(config, channel) : {};

type removeDeviceFn = (name: string) => Response;

function useRemoveDevice(): removeDeviceFn {
  const config = useConfig();
  return (channel: string) => patchConfig({ dasd: removeDevice(config, channel) });
}

export { useConfig, useAddDevice, useRemoveDevice };
export type { addDeviceFn, removeDeviceFn };
