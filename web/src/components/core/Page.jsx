/*
 * Copyright (c) [2023] SUSE LLC
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

// @ts-check

import React from "react";
import { NavLink, Outlet, useNavigate, useMatches, useLocation } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  PageGroup,
  PageSection,
  Stack,
} from "@patternfly/react-core";
import { _ } from "~/i18n";
import tabsStyles from "@patternfly/react-styles/css/components/Tabs/tabs";
import flexStyles from "@patternfly/react-styles/css/utilities/Flex/flex";

/**
 * @typedef {import("@patternfly/react-core").ButtonProps} ButtonProps
 */

/**
 * Wrapper component for holding Page actions
 *
 * Useful and required for placing the components to be used as Page actions, usually a
 * Page.Action or PF/Button
 *
 * @see Page examples.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Components to be rendered as actions.
 */
const Actions = ({ children }) => <>{children}</>;

/**
 * A convenient component representing a Page action
 *
 * Built on top of {@link https://www.patternfly.org/components/button PF/Button}
 *
 * @see Page examples.
 *
 * @typedef {object} ActionProps
 * @property {string} [navigateTo]
 *
 * @typedef {ActionProps & ButtonProps} PageActionProps
 *
 * @param {PageActionProps} props
 */
const Action = ({ navigateTo, children, ...props }) => {
  const navigate = useNavigate();

  const onClickFn = props.onClick;

  props.onClick = (e) => {
    if (typeof onClickFn === "function") onClickFn(e);
    if (navigateTo) navigate(navigateTo);
  };

  if (!props.size) props.size = "lg";

  return <Button {...props}>{children}</Button>;
};

/**
 * Simple action for navigating back
 * @param {ActionProps & { text?: string }} props
 */
const CancelAction = ({ text = _("Cancel"), navigateTo }) => {
  const navigate = useNavigate();

  return (
    <Action variant="link" onClick={() => navigate(navigateTo || "..")}>
      {text}
    </Action>
  );
};

// FIXME: would replace Actions
const NextActions = ({ children }) => (
  <PageGroup
    hasShadowTop
    className={flexStyles.flexGrow_0}
    stickyOnBreakpoint={{ default: "bottom" }}
  >
    <PageSection variant="light">
      <Flex justifyContent={{ default: "justifyContentFlexEnd" }}>{children}</Flex>
    </PageSection>
  </PageGroup>
);

const MainContent = ({ children, ...props }) => (
  <PageSection isFilled {...props}>
    {children}
  </PageSection>
);

const Navigation = ({ routes }) => {
  if (!Array.isArray(routes) || routes.length === 0) return;

  // FIXME: routes should have a "subnavigation" flag to decide if should be
  // rendered here. For example, Storage/iSCSI, Storage/DASD and so on might be
  // not part of this navigation but part of an expandable menu.
  //
  // FIXME: extract to a component since using PF/Tab is not possible to achieve
  // it because the tabs needs a content. As a reference, see https://github.com/patternfly/patternfly-org/blob/b2dbe716096e05cc68d3c85ada692e6140b4e992/packages/documentation-framework/templates/mdx.js#L304-L323
  return (
    <PageSection variant="light" type="tabs" stickyOnBreakpoint={{ default: "top" }}>
      <nav className={tabsStyles.tabs}>
        <ul className={tabsStyles.tabsList}>
          {routes
            .filter((r) => r.handle?.name)
            .map((r, i) => (
              <li className={tabsStyles.tabsItem} key={r.path || i}>
                <NavLink
                  end
                  to={r.path}
                  className={({ isActive }) =>
                    [tabsStyles.tabsLink, isActive ? "pf-m-current" : ""].join(" ")
                  }
                >
                  {r.handle?.name}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
    </PageSection>
  );
};

const Header = ({ hasGutter = true, children, ...props }) => {
  return (
    <PageSection variant="light" stickyOnBreakpoint={{ default: "top" }} {...props}>
      <Stack hasGutter={hasGutter}>{children}</Stack>
    </PageSection>
  );
};

const CardSection = ({ title, children, ...props }) => {
  return (
    <Card isRounded isCompact {...props}>
      {title && <CardHeader> {title} </CardHeader>}
      {children && <CardBody>{children}</CardBody>}
    </Card>
  );
};

/**
 * Displays an installation page
 * @component
 *
 * @note Sidebar is mounted as sibling of the page content to make it work
 * as expected (e.g., changing the inert attribute of its siblings according to its visibility).
 *
 * @example <caption>Simple usage</caption>
 *   <Page icon="manage_accounts" title="Users settings">
 *     <UserSectionContent />
 *   </Page>
 *
 * @param {object} props
 * @param {string} [props.icon] - The icon for the page.
 * @param {string} [props.title="Agama"] - The title for the page. By default it
 *   uses the name of the tool, do not mark it for translation.
 * @param {boolean} [props.mountSidebar=true] - Whether include the core/Sidebar component.
 * @param {React.ReactNode} [props.children] - The page content.
 */
const Page = () => {
  const location = useLocation();
  const matches = useMatches();
  const currentRoute = matches.find((r) => r.pathname === location.pathname);
  const titleFromRoute = currentRoute?.handle?.name;

  return (
    <PageGroup>
      <Outlet />
    </PageGroup>
  );
};

Page.CardSection = CardSection;
Page.Actions = Actions;
Page.NextActions = NextActions;
Page.Action = Action;
Page.MainContent = MainContent;
Page.CancelAction = CancelAction;
Page.Header = Header;

export default Page;
