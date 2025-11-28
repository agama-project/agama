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

import React from "react";
import { useNavigate } from "react-router";
import * as partitionUtils from "~/components/storage/utils/partition";
import { Icon } from "~/components/layout";
import { MenuItem, MenuItemAction } from "@patternfly/react-core";
import type { model } from "~/model/storage";

export type MountPathMenuItemProps = {
  device: model.Partition | model.LogicalVolume;
  editPath?: string;
  deleteFn?: () => void;
};

export default function MountPathMenuItem({
  device,
  editPath = undefined,
  deleteFn = undefined,
}: MountPathMenuItemProps) {
  const navigate = useNavigate();
  const mountPath = device.mountPath;
  const description = device ? partitionUtils.typeWithSize(device) : null;

  return (
    <MenuItem
      itemId={mountPath}
      description={description}
      role="menuitem"
      actions={
        <>
          <MenuItemAction
            style={{ alignSelf: "center" }}
            icon={<Icon name="edit_square" aria-label={"Edit"} />}
            actionId={`edit-${mountPath}`}
            aria-label={`Edit ${mountPath}`}
            onClick={() => editPath && navigate(editPath)}
          />
          <MenuItemAction
            style={{ alignSelf: "center" }}
            icon={<Icon name="delete" aria-label={"Delete"} />}
            actionId={`delete-${mountPath}`}
            aria-label={`Delete ${mountPath}`}
            onClick={deleteFn}
          />
        </>
      }
    >
      {mountPath}
    </MenuItem>
  );
}
