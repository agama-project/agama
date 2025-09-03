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

import { useApiModel, useUpdateApiModel } from "~/hooks/storage/api-model";
import { addDrive, deleteDrive, switchToDrive } from "~/helpers/storage/drive";
import { QueryHookOptions } from "~/types/queries";
import { model, data } from "~/types/storage";
import { useModel } from "~/hooks/storage/model";

function useDrive(name: string, options?: QueryHookOptions): model.Drive | null {
  const model = useModel(options);
  const drive = model?.drives?.find((d) => d.name === name);
  return drive || null;
}

type AddDriveFn = (data: data.Drive) => void;

function useAddDrive(options?: QueryHookOptions): AddDriveFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (data: data.Drive) => {
    updateApiModel(addDrive(apiModel, data));
  };
}

type DeleteDriveFn = (name: string) => void;

function useDeleteDrive(options?: QueryHookOptions): DeleteDriveFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (name: string) => {
    updateApiModel(deleteDrive(apiModel, name));
  };
}

type SwitchToDriveFn = (oldName: string, drive: data.Drive) => void;

function useSwitchToDrive(options?: QueryHookOptions): SwitchToDriveFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (oldName: string, drive: data.Drive) => {
    updateApiModel(switchToDrive(apiModel, oldName, drive));
  };
}

export { useDrive, useAddDrive, useDeleteDrive, useSwitchToDrive };
export type { AddDriveFn, DeleteDriveFn, SwitchToDriveFn };
