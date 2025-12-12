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

import { useConfigModel } from "~/hooks/model/storage";
import { putStorageModel } from "~/api";
import { addDrive, deleteDrive, switchToDrive } from "~/storage/drive";
import { useModel } from "~/hooks/storage/model";
import type { ConfigModel, Data } from "~/model/storage/config-model";

function useDrive(name: string): ConfigModel.Drive | null {
  const model = useModel();
  const drive = model?.drives?.find((d) => d.name === name);
  return drive || null;
}

type AddDriveFn = (data: Data.Drive) => void;

function useAddDrive(): AddDriveFn {
  const config = useConfigModel();
  return (data: Data.Drive) => {
    putStorageModel(addDrive(config, data));
  };
}

type DeleteDriveFn = (name: string) => void;

function useDeleteDrive(): DeleteDriveFn {
  const config = useConfigModel();
  return (name: string) => {
    putStorageModel(deleteDrive(config, name));
  };
}

type SwitchToDriveFn = (oldName: string, drive: Data.Drive) => void;

function useSwitchToDrive(): SwitchToDriveFn {
  const config = useConfigModel();
  return (oldName: string, drive: Data.Drive) => {
    putStorageModel(switchToDrive(config, oldName, drive));
  };
}

export { useDrive, useAddDrive, useDeleteDrive, useSwitchToDrive };
export type { AddDriveFn, DeleteDriveFn, SwitchToDriveFn };
