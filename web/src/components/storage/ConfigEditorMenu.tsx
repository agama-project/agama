/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { useNavigate } from "react-router-dom";
import { _ } from "~/i18n";
import {
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  DropdownList,
  DropdownItem,
  Divider,
} from "@patternfly/react-core";
import { useResetConfig } from "~/hooks/storage/config";
import { activateStorageAction } from "~/api";
import { STORAGE as PATHS } from "~/routes/paths";
import { useZFCPSupported } from "~/queries/storage/zfcp";
import { useDASDSupported } from "~/queries/storage/dasd";

export default function ConfigEditorMenu() {
  const navigate = useNavigate();
  const isZFCPSupported = useZFCPSupported();
  const isDASDSupported = useDASDSupported();
  const reset = useResetConfig();
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);

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
          aria-label={_("Other options toggle")}
          isExpanded={isOpen}
        >
          {_("Other options")}
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem
          key="boot-link"
          onClick={() => navigate(PATHS.editBootDevice)}
          description={_("Select the disk to configure partitions for booting")}
        >
          {_("Change boot options")}
        </DropdownItem>
        <DropdownItem
          key="reset-link"
          onClick={() => reset()}
          description={_("Start from scratch with the default configuration")}
        >
          {_("Reset to defaults")}
        </DropdownItem>
        <Divider />
        <DropdownItem
          key="iscsi-link"
          onClick={() => navigate(PATHS.iscsi)}
          description={_("Discover and connect to iSCSI targets")}
        >
          {_("Configure iSCSI")}
        </DropdownItem>
        {isZFCPSupported && (
          <DropdownItem
            key="zfcp-link"
            onClick={() => navigate(PATHS.zfcp.root)}
            description={_("Activate zFCP disks")}
          >
            {_("Configure zFCP")}
          </DropdownItem>
        )}
        {isDASDSupported && (
          <DropdownItem
            key="dasd-link"
            onClick={() => navigate(PATHS.dasd)}
            description={_("Activate and format DASD devices")}
          >
            {_("Configure DASD")}
          </DropdownItem>
        )}
        <DropdownItem
          key="reprobe-link"
          onClick={activateStorageAction}
          description={_("Update available disks and activate crypt devices")}
        >
          {_("Rescan devices")}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
}
