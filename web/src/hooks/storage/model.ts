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
import { useApiModel } from "~/hooks/storage/api-model";
import { buildModel } from "~/helpers/storage/build-model";
import { QueryHookOptions } from "~/types/queries";
import { model } from "~/types/storage";

function useModel(options?: QueryHookOptions): model.Model | null {
  const apiModel = useApiModel(options);

  const model = useMemo((): model.Model | null => {
    return apiModel ? buildModel(apiModel) : null;
  }, [apiModel]);

  return model;
}

export { useModel };
