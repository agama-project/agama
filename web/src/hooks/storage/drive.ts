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
import type { data } from "~/storage";
import type { configModel } from "~/model/storage";

function useDrive(name: string): configModel.Drive | null {
  const model = useModel();
  const drive = model?.drives?.find((d) => d.name === name);
  return drive || null;
}

type AddDriveFn = (data: data.Drive) => void;

function useAddDrive(): AddDriveFn {
  const apiModel = useConfigModel();
  return (data: data.Drive) => {
    putStorageModel(addDrive(apiModel, data));
  };
}

type DeleteDriveFn = (name: string) => void;

function useDeleteDrive(): DeleteDriveFn {
  const apiModel = useConfigModel();
  return (name: string) => {
    putStorageModel(deleteDrive(apiModel, name));
  };
}

type SwitchToDriveFn = (oldName: string, drive: data.Drive) => void;

function useSwitchToDrive(): SwitchToDriveFn {
  const apiModel = useConfigModel();
  return (oldName: string, drive: data.Drive) => {
    putStorageModel(switchToDrive(apiModel, oldName, drive));
  };
}

export { useDrive, useAddDrive, useDeleteDrive, useSwitchToDrive };
export type { AddDriveFn, DeleteDriveFn, SwitchToDriveFn };
