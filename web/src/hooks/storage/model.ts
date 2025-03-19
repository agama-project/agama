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
import buildModel from "~/hooks/storage/helpers/build-model";
import { QueryHookOptions } from "~/types/queries";
import { model } from "~/types/storage";

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
