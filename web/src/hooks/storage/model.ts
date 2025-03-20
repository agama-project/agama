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

import { useMemo } from "react";
import useApiModel from "~/hooks/storage/api-model";
import { QueryHookOptions } from "~/types/queries";
import { apiModel } from "~/api/storage/types";
import { model } from "~/types/storage";

const findDrive = (model: model.Model, name: string): model.Drive | undefined => {
  return model.drives.find((d) => d.name === name);
};

function buildDrive(apiDrive: apiModel.Drive, model: model.Model): model.Drive {
  const findVolumeGroups = (targetName: string): model.VolumeGroup[] => {
    return model.volumeGroups.filter((v) =>
      v.getTargetDevices().some((d) => d.name === targetName),
    );
  };

  return {
    ...apiDrive,
    getVolumeGroups: () => findVolumeGroups(apiDrive.name),
  };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): model.LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(
  apiVolumeGroup: apiModel.VolumeGroup,
  model: model.Model,
): model.VolumeGroup {
  const buildLogicalVolumes = (): model.LogicalVolume[] => {
    return (apiVolumeGroup.logicalVolumes || []).map(buildLogicalVolume);
  };

  const findTargetDevices = (): model.Drive[] => {
    return (apiVolumeGroup.targetDevices || []).map((d) => findDrive(model, d)).filter((d) => d);
  };

  return {
    ...apiVolumeGroup,
    logicalVolumes: buildLogicalVolumes(),
    getTargetDevices: findTargetDevices,
  };
}

function buildModel(apiModel: apiModel.Config): model.Model {
  const model: model.Model = {
    drives: [],
    volumeGroups: [],
  };

  const buildDrives = (): model.Drive[] => {
    return (apiModel.drives || []).map((d) => buildDrive(d, model));
  };

  const buildVolumeGroups = (): model.VolumeGroup[] => {
    return (apiModel.volumeGroups || []).map((v) => buildVolumeGroup(v, model));
  };

  // Important! Modify the model object instead of assigning a new one.
  model.drives = buildDrives();
  model.volumeGroups = buildVolumeGroups();
  return model;
}

function useModel(options?: QueryHookOptions): model.Model | null {
  const apiModel = useApiModel(options);

  const model = useMemo((): model.Model | null => {
    return apiModel ? buildModel(apiModel) : null;
  }, [apiModel]);

  return model;
}

function useDrive(name: string, options?: QueryHookOptions): model.Drive | null {
  const model = useModel(options);
  const drive = model?.drives?.find((d) => d.name === name);
  return drive || null;
}

function useVolumeGroup(vgName: string, options?: QueryHookOptions): model.VolumeGroup | null {
  const model = useModel(options);
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

export { useModel as default, useDrive, useVolumeGroup };
