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

import React, {useState } from "react";
import { _ } from "~/i18n";
import { useHref } from "react-router-dom";
import {
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  DropdownList,
  DropdownItem,
  Divider,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";

export default function ConfigEditorMenu() {
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
          aria-label={_("More options toggle")}
          isExpanded={isOpen}
          isFullHeight
          variant="plain"
        >
          <span>{_("More options")}<Icon name="keyboard_arrow_down" size="xs" /></span>
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem key="disk">
          {_("Use additional disk")}
        </DropdownItem>
        <DropdownItem key="vg">
          {_("Add LVM volume group")}
        </DropdownItem>
        <DropdownItem key="raid">
          {_("Add MD RAID")}
        </DropdownItem>
        <Divider />
        <DropdownItem key="boot">
          {_("Change boot options")}
        </DropdownItem>
        <DropdownItem key="reinstall">
          {_("Reinstall an existing system")}
        </DropdownItem>
        <Divider />
        <DropdownItem key="iscsi-link" to={useHref('/storage/iscsi')}>
          {_("Configure iSCSI")}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};
