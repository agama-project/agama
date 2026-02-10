/*
 * Copyright (c) [2026] SUSE LLC
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
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  MenuToggle,
  MenuToggleElement,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import ChangeProductOption from "~/components/core/ChangeProductOption";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Props for the InstallerOptionsMenu component.
 */
export type InstallerOptionsMenuProps = {
  /**
   * Whether to hide the "Options" text label next to the icon. Useful when
   * space is limited or when placed in a narrow slot.
   */
  hideLabel?: boolean;
  /**
   * Whether to include the "Change product" entry in the dropdown list. Set
   * this to `true` only on pages where including the link for switching to
   * another product or mode make sense (e.g., the Overview page).
   */
  showChangeProductOption?: boolean;
};

/**
 * A dropdown menu containing some installer options, such as
 * product switching and log downloading.
 */
export default function InstallerOptionsMenu({
  hideLabel = false,
  showChangeProductOption = false,
}: InstallerOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);

  return (
    <Dropdown
      popperProps={{ position: "right", appendTo: () => document.body }}
      isOpen={isOpen}
      onOpenChange={toggle}
      onSelect={toggle}
      onActionClick={toggle}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={toggle}
          aria-label={_("Options toggle")}
          isExpanded={isOpen}
          isFullHeight
          variant="plain"
        >
          <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
            {!hideLabel && _("Options")} <Icon name="expand_circle_down" />
          </Flex>
        </MenuToggle>
      )}
    >
      <DropdownList>
        {showChangeProductOption && <ChangeProductOption />}
        <DropdownItem key="download-logs" to={ROOT.logs} download="agama-logs.tar.gz">
          {_("Download logs")}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
}
