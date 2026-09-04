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
import { useLocation } from "react-router";
import {
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  MenuToggle,
  MenuToggleElement,
} from "@patternfly/react-core";
import Icon, { IconProps } from "~/components/layout/Icon";
import VisualTooltip from "~/components/core/VisualTooltip";
import ChangeProductOption from "~/components/core/ChangeProductOption";
import ConfigDialog from "~/components/core/ConfigDialog";
import DownloadLogsFeedback from "~/components/core/DownloadLogsFeedback";
import { PRODUCT, ROOT } from "~/routes/paths";
import { useTerminal } from "~/context/terminal";
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
};

/** Renders a menu item label with a leading icon, aligned consistently. */
const ItemContent = ({ icon, text }: { icon: IconProps["name"]; text: string }) => (
  <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
    <Icon name={icon} size="lg" />
    {text}
  </Flex>
);

/**
 * A dropdown menu containing some installer options, such as
 * product switching and log downloading.
 */
export default function InstallerOptionsMenu({ hideLabel = false }: InstallerOptionsMenuProps) {
  const location = useLocation();
  // Changing the product or mode makes no sense on the product selection page
  // itself nor during/after the installation.
  const showChangeProductOption = ![
    PRODUCT.changeProduct,
    ROOT.installation,
    ROOT.installationProgress,
    ROOT.installationFinished,
    ROOT.installationExit,
  ].includes(location.pathname);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { isOpen: isTerminalOpen, toggle: toggleTerminal } = useTerminal();
  const toggle = () => setIsMenuOpen(!isMenuOpen);
  const toggleConfig = () => setIsConfigOpen(!isConfigOpen);
  // TRANSLATORS: label for the button that opens the menu with additional
  // actions (show settings, download logs, change product...)
  const toggleLabel = _("More options");

  // DownloadLogsFeedback must wrap the entire Dropdown rather than just the
  // DropdownItem. When the dropdown closes, PatternFly unmounts its children,
  // which would reset the feedback alert state and dismiss the pending toast
  // prematurely. Keeping it as the outermost element ensures it stays mounted
  // regardless of the dropdown lifecycle.
  return (
    <>
      <DownloadLogsFeedback>
        {({ download: downloadLogs }) => (
          <Dropdown
            popperProps={{ position: "right", appendTo: () => document.body }}
            isOpen={isMenuOpen}
            onOpenChange={toggle}
            onSelect={toggle}
            onActionClick={toggle}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <VisualTooltip content={toggleLabel}>
                <MenuToggle
                  ref={toggleRef}
                  onClick={toggle}
                  aria-label={toggleLabel}
                  isExpanded={isMenuOpen}
                  isFullHeight
                  variant="plain"
                >
                  <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
                    {!hideLabel && _("More")} <Icon name="expand_circle_down" isMiddleAligned />
                  </Flex>
                </MenuToggle>
              </VisualTooltip>
            )}
          >
            <DropdownList>
              <DropdownItem key="show-settings" onClick={toggleConfig}>
                {/* TRANSLATORS: menu entry that opens the installation
                    configuration as a JSON file: the machine-readable
                    representation of the same settings the UI otherwise shows
                    as widgets across its screens. */}
                <ItemContent icon="file_json" text={_("Show configuration")} />
              </DropdownItem>
              <DropdownItem key="download-logs" onClick={downloadLogs}>
                {/* TRANSLATORS: menu entry to download the installer logs as an archive */}
                <ItemContent icon="archive" text={_("Download logs")} />
              </DropdownItem>
              <DropdownItem key="toggle-terminal" onClick={toggleTerminal}>
                {/* TRANSLATORS: menu entry that opens or closes the terminal
                    panel, starting or ending its shell session. */}
                <ItemContent
                  icon="terminal"
                  text={isTerminalOpen ? _("Close terminal") : _("Open terminal")}
                />
              </DropdownItem>
              {showChangeProductOption && (
                <>
                  <Divider component="li" />
                  <ChangeProductOption component="dropdownitem" showIcon />
                </>
              )}
            </DropdownList>
          </Dropdown>
        )}
      </DownloadLogsFeedback>
      {isConfigOpen && <ConfigDialog onClose={toggleConfig} />}
    </>
  );
}
