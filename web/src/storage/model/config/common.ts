/*
 * Copyright (c) [2024] SUSE LLC
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

import { config } from "~/api/storage/types";
import * as checks from "~/api/storage/types/checks";

interface WithFilesystem {
  filesystem?: config.Filesystem;
}

interface WithSearch {
  search?: config.SearchElement;
}

export function generateName<Type extends WithSearch>(config: Type): string | undefined {
  const search = config.search;

  if (!search) return;
  if (checks.isSimpleSearchAll(search)) return;
  if (checks.isSimpleSearchByName(search)) return search;
  if (checks.isAdvancedSearch(search)) return search.condition?.name;
}

export function generateFilesystem<Type extends WithFilesystem>(config: Type): string | undefined {
  const fstype = config.filesystem?.type;

  if (!fstype) return;
  if (checks.isFilesystemTypeBtrfs(fstype)) return "btrfs";
  if (checks.isFilesystemTypeAny(fstype)) return fstype;
}

export function generateSnapshots<Type extends WithFilesystem>(config: Type): boolean | undefined {
  const fstype = config.filesystem?.type;

  if (!fstype) return;
  if (checks.isFilesystemTypeAny(fstype)) return;
  if (checks.isFilesystemTypeBtrfs(fstype)) return fstype.btrfs.snapshots;
}
