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
import { Outlet, NavLink } from "react-router-dom";
import {
  Masthead, MastheadToggle, MastheadMain, MastheadBrand,
  Nav, NavItem, NavList,
  Page, PageSidebar, PageSidebarBody, PageToggleButton,
  Stack
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { About, LogsButton } from "~/components/core";
import { InstallerKeymapSwitcher, InstallerLocaleSwitcher } from "~/components/l10n";
import { _ } from "~/i18n";
import { rootRoutes } from "~/router";
import { useProduct } from "~/context/product";

const Header = () => {
  const { selectedProduct } = useProduct();
  // NOTE: Agama is a name, do not translate
  const title = selectedProduct?.name || _("Agama");

  // FIXME: do not use the style prop, find another way to play with the icon
  // color.
  return (
    <Masthead>
      <MastheadToggle>
        <PageToggleButton
          variant="plain"
          aria-label="Global navigation"
          id="uncontrolled-nav-toggle"
        >
          <Icon name="menu" style={{ color: "white" }} />
        </PageToggleButton>
      </MastheadToggle>
      <MastheadMain>
        <MastheadBrand component="h1"><NavLink to="/">{title}</NavLink></MastheadBrand>
      </MastheadMain>
    </Masthead>
  );
};

const Sidebar = () => {
  // TODO: Improve this and/or extract the NavItem to a wrapper component.
  const links = rootRoutes.map(r => {
    return (
      <NavItem
        key={r.path}
        component={
          ({ className }) =>
            <NavLink to={r.path} className={({ isActive }) => [className, isActive ? "pf-m-current" : ""].join(" ")}>
              <Icon size="s" name={r.handle?.icon} /> {r.handle?.name}
            </NavLink>
        }
      />
    );
  });

  return (
    <PageSidebar id="uncontrolled-sidebar">
      <PageSidebarBody isFilled>
        <Nav>
          <NavList>{links}</NavList>
        </Nav>
      </PageSidebarBody>
      <PageSidebarBody usePageInsets isFilled={false}>
        <Stack hasGutter>
          <InstallerLocaleSwitcher />
          <InstallerKeymapSwitcher />
          <About buttonVariant="tertiary" />
          <LogsButton />
        </Stack>
      </PageSidebarBody>
    </PageSidebar>
  );
};

/**
 * Root application component for laying out the content.
 */
export default function Root() {
  return (
    <Page
      isManagedSidebar
      header={<Header />}
      sidebar={<Sidebar />}
    >
      <Outlet />
    </Page>
  );
}
