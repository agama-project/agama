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

import React from "react";
import { NavLink } from "react-router-dom";
import { Nav, NavItem, NavList, PageSidebar, PageSidebarBody, Stack } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { ChangeProductLink } from "~/components/core";
import { rootRoutes } from "~/router";
import { _ } from "~/i18n";

const MainNavigation = (): React.ReactNode => {
  const links = rootRoutes().map((r) => {
    if (!r.handle) return null;

    // eslint-disable-next-line agama-i18n/string-literals
    const name = _(r.handle.name);
    const iconName = r.handle.icon;

    return (
      <NavItem
        key={r.path}
        component={({ className }) => (
          <NavLink
            to={r.path}
            className={({ isActive }) => [className, isActive ? "pf-m-current" : ""].join(" ")}
          >
            {iconName && <Icon size="s" name={iconName} />} {name}
          </NavLink>
        )}
      />
    );
  });

  return (
    <Nav>
      <NavList>{links}</NavList>
    </Nav>
  );
};

export default function Sidebar(): React.ReactNode {
  return (
    <PageSidebar id="agama-sidebar">
      <PageSidebarBody isFilled>
        <MainNavigation />
      </PageSidebarBody>
      <PageSidebarBody isFilled={false} usePageInsets>
        <Stack hasGutter>
          <ChangeProductLink />
        </Stack>
      </PageSidebarBody>
    </PageSidebar>
  );
}
