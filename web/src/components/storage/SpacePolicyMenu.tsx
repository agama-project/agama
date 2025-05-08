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
import { useNavigate, generatePath } from "react-router-dom";
import { useSetSpacePolicy } from "~/hooks/storage/space-policy";
import { _ } from "~/i18n";
import { baseName, SPACE_POLICIES } from "~/components/storage/utils";
import { apiModel } from "~/api/storage/types";
import { STORAGE as PATHS } from "~/routes/paths";
import * as driveUtils from "~/components/storage/utils/drive";
import { contentDescription } from "~/components/storage/utils/device";
import DeviceMenu from "~/components/storage/DeviceMenu";
import { MenuHeader } from "~/components/core";
import { Divider, Label, Split, MenuItem, MenuList, MenuGroup } from "@patternfly/react-core";

// FIXME: Presentation is quite poor
const SpacePolicySelectorIntro = ({ device }) => {
  const main = _("Choose what to with current content");
  const description = contentDescription(device);
  const systems = device.systems;

  return (
    <MenuHeader
      title={main}
      description={
        <Split hasGutter>
          <span className="pf-v5-c-menu__item-description">{description}</span>
          {systems.map((s, i) => (
            <Label key={i} isCompact>
              {s}
            </Label>
          ))}
        </Split>
      }
    />
  );
};

export default function SpacePolicyMenu({ modelDevice, device }) {
  const navigate = useNavigate();
  const setSpacePolicy = useSetSpacePolicy();
  const onSpacePolicyChange = (spacePolicy: apiModel.SpacePolicy) => {
    if (spacePolicy === "custom") {
      return navigate(
        generatePath(PATHS.drive.editSpacePolicy, { id: baseName(modelDevice.name) }),
      );
    } else {
      setSpacePolicy(modelDevice.name, { type: spacePolicy });
    }
  };

  const currentPolicy = driveUtils.spacePolicyEntry(modelDevice);

  const PolicyItem = ({ policy }) => {
    const isSelected = policy.id === currentPolicy.id;
    // FIXME: use PF/Content with #component prop instead when migrating to PF6
    const Name = () => (isSelected ? <b>{policy.label}</b> : policy.label);

    return (
      <MenuItem
        itemId={policy.id}
        isSelected={isSelected}
        description={policy.description}
        onClick={() => onSpacePolicyChange(policy.id)}
      >
        <Name />
      </MenuItem>
    );
  };

  return (
    <DeviceMenu
      title={<span>{driveUtils.contentActionsDescription(modelDevice)}</span>}
      activeItemId={currentPolicy.id}
    >
      <MenuGroup label={<SpacePolicySelectorIntro device={device} />}>
        <MenuList>
          <Divider />
          {SPACE_POLICIES.map((policy) => (
            <PolicyItem key={policy.id} policy={policy} />
          ))}
        </MenuList>
      </MenuGroup>
    </DeviceMenu>
  );
}
