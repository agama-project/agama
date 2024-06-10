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
import { Outlet } from "react-router-dom";
import {
  Masthead, MastheadContent,
  Page,
  Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem
} from "@patternfly/react-core";
import { InstallerOptions } from "~/components/core";
import { _ } from "~/i18n";

/**
 * Simple layout for displaying content that comes before product configuration
 * TODO: improve documentation
 */
export default function SimpleLayout() {
  return (
    <Page>
      <Masthead backgroundColor="light200">
        <MastheadContent>
          <Toolbar>
            <ToolbarContent>
              <ToolbarGroup align={{ default: "alignRight" }}>
                <ToolbarItem>
                  <InstallerOptions />
                </ToolbarItem>
              </ToolbarGroup>
            </ToolbarContent>
          </Toolbar>
        </MastheadContent>
      </Masthead>
      <Outlet />
    </Page>
  );
}
