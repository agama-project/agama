/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import {
  Masthead,
  MastheadContent,
  MastheadToggle,
  MastheadMain,
  MastheadBrand,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { InstallerOptions } from "~/components/core";
import { useProduct } from "~/queries/software";
import { _ } from "~/i18n";

/**
 * Internal component for building the layout header
 *
 * It's just a wrapper for {@link https://www.patternfly.org/components/masthead | PF/Masthead} and
 * its expected children components.
 */
export default function Header({
  hideProductName = false,
  hideInstallerOptions = false,
}: {
  hideProductName?: boolean;
  hideInstallerOptions?: boolean;
}): React.ReactNode {
  const { selectedProduct } = useProduct();

  return (
    <Masthead>
      <MastheadToggle>
        <PageToggleButton
          id="uncontrolled-nav-toggle"
          variant="plain"
          aria-label={_("Main navigation")}
        >
          <Icon name="menu" color="color-light-100" />
        </PageToggleButton>
      </MastheadToggle>
      <MastheadMain>
        {hideProductName || <MastheadBrand component="h1">{selectedProduct.name}</MastheadBrand>}
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignRight" }}>
              <ToolbarItem>{hideInstallerOptions || <InstallerOptions />}</ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
}
