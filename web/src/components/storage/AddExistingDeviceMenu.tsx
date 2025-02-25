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

import React, { useState } from "react";
import { _, n_ } from "~/i18n";
import { sprintf } from "sprintf-js";
import {
  Dropdown,
  DropdownList,
  DropdownItem,
  DropdownGroup,
  MenuToggleElement,
  MenuToggle,
  Divider,
  Split,
  Flex,
  Label,
} from "@patternfly/react-core";
import { MenuHeader } from "~/components/core";
import MenuDeviceDescription from "./MenuDeviceDescription";
import { useAvailableDevices } from "~/queries/storage";
import { useConfigModel, useModel } from "~/queries/storage/config-model";
import { deviceLabel } from "~/components/storage/utils";

export default function AddExistingDeviceMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);
  const allDevices = useAvailableDevices();
  const model = useConfigModel({ suspense: true });
  const modelHook = useModel();

  const drivesNames = model.drives.map((d) => d.name);
  const devices = allDevices.filter((d) => !drivesNames.includes(d.name));

  const Header = ({ drives }) => {
    const desc = sprintf(
      n_(
        "Extends the installation beyond the currently selected disk",
        "Extends the installation beyond the current %d disks",
        drives.length,
      ),
      drives.length,
    );

    return <MenuHeader title={_("Select another disk to define partitions")} description={desc} />;
  };

  if (!devices.length) return null;

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={toggle}
      onSelect={toggle}
      onActionClick={toggle}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={toggle}
          aria-label={_("Use additional disk toggle")}
          isExpanded={isOpen}
        >
          {_("Use additional disk")}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {/* @ts-expect-error See https://github.com/patternfly/patternfly/issues/7327 */}
        <DropdownGroup label={<Header drives={model.drives} />}>
          <Divider />
          {devices.map((device) => (
            <DropdownItem
              key={device.sid}
              description={<MenuDeviceDescription device={device} />}
              onClick={() => modelHook.addDrive(device.name)}
            >
              <Split hasGutter>
                {deviceLabel(device)}
                <Flex columnGap={{ default: "columnGapXs" }}>
                  {device.systems.map((s, i) => (
                    <Label key={i} isCompact>
                      {s}
                    </Label>
                  ))}
                </Flex>
              </Split>
            </DropdownItem>
          ))}
        </DropdownGroup>
      </DropdownList>
    </Dropdown>
  );
}
