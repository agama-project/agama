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
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { QueryHookOptions } from "~/types/queries";
import { ProductParams, Volume } from "~/api/storage/types";
import { productParamsQuery, volumeQuery } from "~/queries/storage";
import { useModel } from "~/hooks/storage/model";

function useProductParams(options?: QueryHookOptions): ProductParams {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(productParamsQuery);
  return data;
}

function useMissingMountPaths(options?: QueryHookOptions): string[] {
  const productParams = useProductParams(options);
  const model = useModel();

  const missingMountPaths = useMemo(() => {
    const currentMountPaths = model?.getMountPaths() || [];
    return (productParams?.mountPoints || []).filter((p) => !currentMountPaths.includes(p));
  }, [productParams, model]);

  return missingMountPaths;
}

function useVolume(mountPath: string, options?: QueryHookOptions): Volume {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { mountPoints } = useProductParams(options);

  // The query returns a volume with the given mount path, but we need the "generic" volume without
  // mount path for an arbitrary mount path. Take it into account while refactoring the backend side
  // in order to report all the volumes in a single call (e.g., as part of the product params).
  if (!mountPoints.includes(mountPath)) mountPath = "";
  const { data } = func(volumeQuery(mountPath));
  return data;
}

export { useProductParams, useMissingMountPaths, useVolume };
