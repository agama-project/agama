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

import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Button,
  Drawer, DrawerActions, DrawerCloseButton, DrawerContent, DrawerHead, DrawerPanelBody, DrawerPanelContent,
  Masthead, MastheadContent, MastheadToggle, MastheadMain, MastheadBrand,
  Nav, NavItem, NavList,
  Page, PageSidebar, PageSidebarBody, PageToggleButton,
  Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { About, InstallerOptions, TerminalDialog, Terminal } from "~/components/core";
import { _ } from "~/i18n";
import { rootRoutes } from "~/router";
import { useProduct } from "~/context/product";

const Header = ({ onTerminalClick }) => {
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
        <MastheadBrand component="h1">{title}</MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignRight" }}>
              <ToolbarItem>
                <Button
                  variant="plain"
                  icon={<Icon name="terminal" />}
                  onClick={onTerminalClick}
                  aria-label={_("Show terminal")}
                />
                <InstallerOptions />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
};

const ChangeProductButton = () => {
  const navigate = useNavigate();
  const { products } = useProduct();

  if (!products.length) return null;

  return (
    <PageSidebarBody isFilled={false}>
      <Button variant="plain" style={{ color: "white" }} onClick={() => navigate("/products")}>
        {_("Change product")}
      </Button>
    </PageSidebarBody>
  );
};

const Sidebar = () => {
  // TODO: Improve this and/or extract the NavItem to a wrapper component.
  const links = rootRoutes.map(r => {
    if (!r.handle || r.handle.hidden) return null;

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
      <ChangeProductButton />
      <PageSidebarBody isFilled={false}>
        <About buttonVariant="plain" style={{ color: "white" }} />
      </PageSidebarBody>
    </PageSidebar>
  );
};

/**
 * Root application component for laying out the content.
 */
export default function Root() {
  const [showTerminal, setShowTerminal] = useState();

  const openTerminal = () => setShowTerminal(true);
  const closeTerminal = () => setShowTerminal(false);

  return (
    <Page
      isManagedSidebar
      header={<Header onTerminalClick={openTerminal} />}
      sidebar={<Sidebar />}
    >
      <Drawer isExpanded={showTerminal} position="bottom">
        <DrawerContent
          panelContent={
            <DrawerPanelContent
              isResizable
              minSize="66%"
              colorVariant="dark-200"
            >
              <DrawerHead>
                <h2>{_("Terminal")}</h2>
                <DrawerActions>
                  <DrawerCloseButton onClick={closeTerminal} />
                </DrawerActions>
              </DrawerHead>
              <DrawerPanelBody>
                <Terminal />
              </DrawerPanelBody>
            </DrawerPanelContent>
          }
        >
          <Outlet />
        </DrawerContent>
      </Drawer>
    </Page>
  );
}
