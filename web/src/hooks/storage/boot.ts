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
import { useStorageModel } from "~/hooks/api/storage";
import { putStorageModel } from "~/api";
import { QueryHookOptions } from "~/types/queries";
import { setBootDevice, setDefaultBootDevice, disableBootConfig } from "~/helpers/storage/boot";

type SetBootDeviceFn = (deviceName: string) => void;

function useSetBootDevice(options?: QueryHookOptions): SetBootDeviceFn {
  const model = useModel(options);
  const apiModel = useStorageModel();
  return (deviceName: string) => putStorageModel(setBootDevice(model, apiModel, deviceName));
}

type SetDefaultBootDeviceFn = () => void;

function useSetDefaultBootDevice(options?: QueryHookOptions): SetDefaultBootDeviceFn {
  const model = useModel(options);
  const apiModel = useStorageModel();
  return () => putStorageModel(setDefaultBootDevice(model, apiModel));
}

type DisableBootConfigFn = () => void;

function useDisableBootConfig(options?: QueryHookOptions): DisableBootConfigFn {
  const model = useModel(options);
  const apiModel = useStorageModel();
  return () => putStorageModel(disableBootConfig(model, apiModel));
}

export { useSetBootDevice, useSetDefaultBootDevice, useDisableBootConfig };
