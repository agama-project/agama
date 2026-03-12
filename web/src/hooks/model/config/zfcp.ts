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
import zfcp from "~/model/config/zfcp";
import type { Config, ZFCP } from "~/model/config";

const selectConfig = (data: Config | null): ZFCP.Config => data?.zfcp || null;

function useConfig(): ZFCP.Config | null {
  const { data } = useSuspenseQuery({
    ...configQuery,
    select: selectConfig,
  });
  return data;
}

type SetControllersFn = (controllers: string[]) => Response;

/**
 * Provides a function for setting the list of zFCP controllers to activate.
 */
function useSetControllers(): SetControllersFn {
  const config = useConfig();

  return (controllers: string[]): Response => {
    const newConfig = zfcp.setControllers(config, controllers);
    return patchConfig({ zfcp: newConfig });
  };
}

type AddDevicesFn = (devices: ZFCP.Device[]) => Response;

/**
 * Provides a function for adding devices to the zFCP config.
 *
 * If a device already exists in the config, then it is replaced by the new device.
 */
function useAddDevices(): AddDevicesFn {
  const config = useConfig();

  return (devices: ZFCP.Device[]): Response => {
    const newConfig = zfcp.addDevices(config, devices);
    return patchConfig({ zfcp: newConfig });
  };
}

type RemoveDevicesFn = (devices: ZFCP.Device[]) => Response;

/**
 * Provides a function for removing devices from the zFCP config.
 */
function useRemoveDevices(): RemoveDevicesFn {
  const config = useConfig();

  return (devices: ZFCP.Device[]): Response => {
    const newConfig = zfcp.removeDevices(config, devices);
    return patchConfig({ zfcp: newConfig });
  };
}

export type { SetControllersFn, AddDevicesFn, RemoveDevicesFn };
export { useConfig, useSetControllers, useAddDevices, useRemoveDevices };
