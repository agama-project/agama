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
import { Outlet, NavLink, useMatches } from "react-router-dom";
import {
  Breadcrumb, BreadcrumbItem,
  Masthead, MastheadToggle, MastheadMain, MastheadBrand,
  Nav, NavItem, NavList,
  Page, PageSidebar, PageSidebarBody, PageToggleButton,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";
import { rootRoutes } from "~/router";

const Header = () => {
  return (
    <Masthead>
      <MastheadToggle>
        <PageToggleButton
          variant="plain"
          aria-label="Global navigation"
          id="uncontrolled-nav-toggle"
        >
          <Icon name="menu" />
        </PageToggleButton>
      </MastheadToggle>
      <MastheadMain>
        <MastheadBrand component="h1"><NavLink to="/">{_("Agama")}</NavLink></MastheadBrand>
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
      <PageSidebarBody>
        <Nav>
          <NavList>{links}</NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );
};

/**
 * Root application component for laying out the content.
 */
export default function Root() {
  const Breadcrumbs = () => {
    const matches = useMatches();
    const breadcrumbs = matches.filter(m => m.handle);

    if (breadcrumbs.length < 2) return;

    return (
      <Breadcrumb>
        {matches.filter(m => m.handle).slice(0, -1)
          .map(m => (
            <BreadcrumbItem
              key={m.pathname}
              to={m.pathname}
              render={({ className }) => (
                <NavLink end to={m.pathname} className={({ isActive }) => [className, isActive ? "pf-m-current" : ""].join(" ")}>
                  {m.handle.name}
                </NavLink>
              )}
            />
          ))}
      </Breadcrumb>
    );
  };

  return (
    <Page
      isManagedSidebar
      header={<Header />}
      sidebar={<Sidebar />}
      breadcrumb={<Breadcrumbs />}
    >
      <Outlet />
    </Page>
  );
}
