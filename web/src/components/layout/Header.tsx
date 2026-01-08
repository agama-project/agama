/*
 * Copyright (c) [2024-2026] SUSE LLC
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
  Masthead,
  MastheadContent,
  MastheadMain,
  MenuToggle,
  MenuToggleElement,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { ChangeProductOption, InstallerOptions, InstallButton, SkipTo } from "~/components/core";
import ProgressStatusMonitor from "../core/ProgressStatusMonitor";
import Breadcrumb from "~/components/core/Breadcrumb";
import { useProductInfo } from "~/hooks/model/config/product";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

export type HeaderProps = {
  /** Whether the application sidebar should be mounted or not */
  showSidebarToggle?: boolean;
  /** Whether the selected product name should be shown */
  showProductName?: boolean;
  /** Whether the "Skip to content" link should be mounted */
  showSkipToContent?: boolean;
  /** Whether the installer options link should be mounted */
  showInstallerOptions?: boolean;
  /** Callback to be triggered for toggling the IssuesDrawer visibility */
  toggleIssuesDrawer?: () => void;
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
};

const OptionsDropdown = () => {
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
          <Icon name="expand_circle_down" />
        </MenuToggle>
      )}
    >
      <DropdownList>
        <ChangeProductOption />
        <DropdownItem key="download-logs" to={ROOT.logs} download="agama-logs.tar.gz">
          {_("Download logs")}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

/**
 * Internal component for building the page header
 *
 * Built on top of {@link https://www.patternfly.org/components/masthead | PF/Masthead}
 */
export default function Header({
  breadcrumb,
  showSkipToContent = true,
  showInstallerOptions = true,
}: HeaderProps): React.ReactNode {
  const product = useProductInfo();

  return (
    <Masthead>
      <MastheadMain className={spacingStyles.pXs}>
        {showSkipToContent && <SkipTo />}
        <Breadcrumb>
          {product && breadcrumb && (
            <Breadcrumb.Item
              hideDivider
              isEditorial
              path={ROOT.confirm}
              label={
                <Icon
                  name="list_alt"
                  width="1.4em"
                  height="1.4em"
                  style={{ verticalAlign: "middle" }}
                />
              }
            />
          )}
          {breadcrumb &&
            breadcrumb.map(({ label, path }, i) => (
              <Breadcrumb.Item isEditorial={i === 0} key={i} label={label} path={path} />
            ))}
        </Breadcrumb>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignEnd" }} columnGap={{ default: "columnGapXs" }}>
              <ToolbarItem>
                <ProgressStatusMonitor />
              </ToolbarItem>
              {showInstallerOptions && (
                <ToolbarItem>
                  <InstallerOptions />
                </ToolbarItem>
              )}
              <ToolbarItem>
                <InstallButton />
              </ToolbarItem>
              <ToolbarItem>
                <OptionsDropdown />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}
