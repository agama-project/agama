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
import { NavLink, useNavigate } from "react-router-dom";
import {
  Button,
  PageGroup, PageSection, PageSectionVariants,
} from "@patternfly/react-core";
import tabsStyles from '@patternfly/react-styles/css/components/Tabs/tabs';

import { _ } from "~/i18n";
import { Icon } from "~/components/layout";
import { If, PageMenu } from "~/components/core";

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
 * Component for rendering options related to the page. I.e., a menu.
 *
 * @note it is defined in its own file and then included here under Page.Menu
 * "alias".
 *
 * @see core/PageMenu to know more.
 */
const Menu = PageMenu;

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
 *
 * @note it will be used by default if a page is mounted without actions
 *
 * TODO: Explain below note better
 * @note that we cannot use navigate("..") because our routes are all nested in
 * the root.
 */
const BackAction = () => {
  return (
    <Action variant="secondary" onClick={() => history.back()}>
      {_("Back")}
    </Action>
  );
};

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
          {routes.filter(r => !r.index && r.handle?.name).map((r) => (
            <li className={tabsStyles.tabsItem} key={r.path}>
              <NavLink to={r.path} className={({ isActive }) => [tabsStyles.tabsLink, isActive ? "pf-m-current" : ""].join(" ")}>
                {r.handle?.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </PageSection>
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
 * @example <caption>Using custom actions</caption>
 *   <Page icon="manage_accounts" title="Users settings">
 *     <UserSectionContent />
 *
 *     <Page.Actions>
 *       <Page.Action onClick={() => alert("Are you sure?")}>
 *         Reset to defaults
 *       </Page.Action>
 *       <Page.Action callToAction>Accept</Page.Action>
 *     </Page.Actions>
 *   </Page>
 *
 * @example <caption>Using custom actions and a page menu</caption>
 *   <Page icon="manage_accounts" title="Users settings">
 *     <UserSectionContent />
 *
 *     <Page.Menu>
 *       <Page.Menu.Options>
 *         <Page.Menu.Option>Expert mode</Page.Menu.Option>
 *         <Page.Menu.Option>Help</Page.Menu.Option>
 *       </Page.Menu.Options>
 *     </Page.Menu>
 *
 *     <Page.Actions>
 *       <Page.Action onClick={() => alert("Are you sure?")}>
 *         Reset to defaults
 *       </Page.Action>
 *       <Page.Action callToAction>Accept</Page.Action>
 *     </Page.Actions>
 *   </Page>
 *
 * @example <caption>Using a page menu from external component</caption>
 *   ...
 *   import { UserPageMenu } from "somewhere";
 *   ...
 *   <Page icon="manage_accounts" title="Users settings">
 *     <UserSectionContent />
 *
 *     <UserPageMenu />
 *   </Page>
 *
 * @param {object} props
 * @param {string} [props.icon] - The icon for the page.
 * @param {string} [props.title="Agama"] - The title for the page. By default it
 *   uses the name of the tool, do not mark it for translation.
 * @param {boolean} [props.mountSidebar=true] - Whether include the core/Sidebar component.
 * @param {React.ReactNode} [props.children] - The page content.
 */
const Page = ({ icon, title = "Agama", routes = [], children }) => {
  return (
    <PageGroup>
      <PageSection variant={PageSectionVariants.light}>
        <h2 className="split">
          <If condition={icon} then={<Icon name={icon} />} />
          <span>{title}</span>
        </h2>
      </PageSection>
      <Navigation routes={routes} />
      <PageSection>
        {children}
      </PageSection>
    </PageGroup>
  );
};

Page.Actions = Actions;
Page.Action = Action;
Page.Menu = Menu;
Page.BackAction = BackAction;

export default Page;
