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
import {
  Masthead,
  MastheadContent,
  MastheadToggle,
  MastheadMain,
  MastheadLogo,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  DropdownList,
  DropdownItem,
  Divider,
  Content,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { useProduct } from "~/queries/software";
import { _ } from "~/i18n";
import { InstallationPhase } from "~/types/status";
import { useInstallerStatus } from "~/queries/status";
import { Route } from "~/types/routes";
import { InstallButton, InstallerOptions } from "~/components/core";
import { useLocation, useMatches } from "react-router-dom";
import { ROOT } from "~/routes/paths";

export type HeaderProps = {
  /** Whether the application sidebar should be mounted or not */
  showSidebarToggle?: boolean;
  /** Whether the selected product name should be shown */
  showProductName?: boolean;
  /** Whether the installer options link should be mounted */
  showInstallerOptions?: boolean;
  /** Callback to be triggered for toggling the IssuesDrawer visibility */
  toggleIssuesDrawer?: () => void;
};

const OptionsDropdown = ({ showInstallerOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isInstallerOptionsOpen, setIsInstallerOptionsOpen] = useState(false);
  const toggle = () => setIsOpen(!isOpen);
  const toggleInstallerOptions = () => setIsInstallerOptionsOpen(!isInstallerOptionsOpen);

  return (
    <>
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
          <DropdownItem key="download-logs" to={ROOT.logs} download="agama-logs.tar.gz">
            {_("Download logs")}
          </DropdownItem>
          {showInstallerOptions && (
            <>
              <Divider />
              <DropdownItem key="installer-l10n" onClick={toggleInstallerOptions}>
                {_("Installer Options")}
              </DropdownItem>
            </>
          )}
        </DropdownList>
      </Dropdown>

      {showInstallerOptions && (
        <InstallerOptions
          isOpen={isInstallerOptionsOpen}
          onClose={() => setIsInstallerOptionsOpen(false)}
        />
      )}
    </>
  );
};

/**
 * Internal component for building the layout header
 *
 * It's just a wrapper for {@link https://www.patternfly.org/components/masthead | PF/Masthead} and
 * its expected children components.
 */
export default function Header({
  showSidebarToggle = true,
  showProductName = true,
  toggleIssuesDrawer,
}: HeaderProps): React.ReactNode {
  const location = useLocation();
  const { selectedProduct } = useProduct();
  const { phase } = useInstallerStatus({ suspense: true });
  const routeMatches = useMatches() as Route[];
  const currentRoute = routeMatches.at(-1);
  // TODO: translate title
  const title = (showProductName && selectedProduct?.name) || currentRoute?.handle?.title;

  const showInstallerOptions =
    phase !== InstallationPhase.Install &&
    // FIXME: Installer options should be available in the login too.
    !["/login", "/products/progress"].includes(location.pathname);

  return (
    <Masthead>
      <MastheadMain>
        {showSidebarToggle && (
          <MastheadToggle>
            <PageToggleButton
              id="uncontrolled-nav-toggle"
              variant="plain"
              aria-label={_("Main navigation")}
            >
              <Icon name="menu" color="color-light-100" />
            </PageToggleButton>
          </MastheadToggle>
        )}
        {title && (
          <MastheadLogo>
            <Content component="h1">{title}</Content>
          </MastheadLogo>
        )}
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignEnd" }} columnGap={{ default: "columnGapXs" }}>
              <ToolbarItem>
                <InstallButton onClickWithIssues={toggleIssuesDrawer} />
              </ToolbarItem>
              <ToolbarItem>
                <OptionsDropdown showInstallerOptions={showInstallerOptions} />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}
