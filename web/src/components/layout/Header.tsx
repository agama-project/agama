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
  Button,
  Content,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  Masthead,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  MenuToggle,
  MenuToggleElement,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { useProduct } from "~/queries/software";
import { InstallationPhase } from "~/types/status";
import { useInstallerStatus } from "~/queries/status";
import { useInstallerL10n } from "~/context/installerL10n";
import { Route } from "~/types/routes";
import { ChangeProductOption, InstallButton, InstallerOptions, SkipTo } from "~/components/core";
import { useLocation, useMatches } from "react-router-dom";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";
import supportedLanguages from "~/languages.json";

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
          <ChangeProductOption />
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

const Language = ({ value }) => (
  <>
    <Icon name="language" /> {value}
  </>
);

const Keyboard = ({ value }) => (
  <>
    <Icon name="keyboard" /> {value}
  </>
);

const LanguageAndKeyboardButton = () => {
  const { language, keymap } = useInstallerL10n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        aria-label={_("Change display language and keyboard layout")}
        variant="plain"
        icon={
          <Flex
            gap={{ default: "gapXs" }}
            alignContent={{ default: "alignContentCenter" }}
            alignItems={{ default: "alignItemsCenter" }}
          >
            <Language value={supportedLanguages[language]} />
            <Keyboard value={keymap} />
          </Flex>
        }
      />
      <InstallerOptions isOpen={isOpen} onClose={() => setIsOpen(false)} />
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
  showSkipToContent = true,
  toggleIssuesDrawer,
  isSidebarOpen,
  toggleSidebar,
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
        {showSkipToContent && <SkipTo />}
        {showSidebarToggle && (
          <MastheadToggle>
            <PageToggleButton
              isSidebarOpen={isSidebarOpen}
              onSidebarToggle={toggleSidebar}
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
                <LanguageAndKeyboardButton />
              </ToolbarItem>
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
