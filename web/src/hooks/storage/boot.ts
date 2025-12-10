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

import { useModel } from "~/hooks/storage/model";
import { useConfigModel } from "~/hooks/model/storage";
import { putStorageModel } from "~/api";
import { setBootDevice, setDefaultBootDevice, disableBootConfig } from "~/storage/boot";

type SetBootDeviceFn = (deviceName: string) => void;

function useSetBootDevice(): SetBootDeviceFn {
  const model = useModel();
  const apiModel = useConfigModel();
  return (deviceName: string) => putStorageModel(setBootDevice(model, apiModel, deviceName));
}

type SetDefaultBootDeviceFn = () => void;

function useSetDefaultBootDevice(): SetDefaultBootDeviceFn {
  const model = useModel();
  const apiModel = useConfigModel();
  return () => putStorageModel(setDefaultBootDevice(model, apiModel));
}

type DisableBootConfigFn = () => void;

function useDisableBootConfig(): DisableBootConfigFn {
  const model = useModel();
  const apiModel = useConfigModel();
  return () => putStorageModel(disableBootConfig(model, apiModel));
}

export { useSetBootDevice, useSetDefaultBootDevice, useDisableBootConfig };
