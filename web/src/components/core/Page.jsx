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

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { partition } from "~/utils";
import { Icon } from "~/components/layout";
import { If, PageMenu, Sidebar } from "~/components/core";
import logoUrl from "~/assets/suse-horizontal-logo.svg";

/**
 * Wrapper component for holding Page actions
 *
 * Useful and required for placing the components to be used as Page actions, usually a
 * Page.Action or PF/Button
 *
 * @see Page examples.
 *
 * @param {React.ReactNode} [props.children] - a collection of Action components
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
 * @param {React.ReactNode} props.children - content of the action
 * @param {object} [props] - PF/Button props, see {@link https://www.patternfly.org/components/button#props}
 */
const Action = ({ children, navigateTo, onClick, ...props }) => {
  const navigate = useNavigate();

  props.onClick = () => {
    if (typeof onClick === "function") onClick();
    if (navigateTo) navigate(navigateTo);
  };

  if (!props.size) props.size = "lg";

  return <Button { ...props }>{children}</Button>;
};

/**
 * Simple action for navigating back
 *
 * @note it will be used by default if a page is mounted without actions
 *
 * TODO: Explain below note better
 * @note that we cannot use navigate("..") because our routes are all nested in
 * the root.
 *
 * @param {React.ReactNode} props.children - content of the action
 * @param {object} [props] - {@link Action} props
 */
const BackAction = () => {
  return (
    <Action variant="secondary" onClick={() => history.back()}>
      {_("Back")}
    </Action>
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
 * @param {JSX.Element} [props.children] - The page content.
 *
 */
const Page = ({ icon, title = "Agama", children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * To make possible placing everything in the right place, it's
   * needed to work with given children to look for actions, menus, and or other
   * kind of things can be added in the future.
   *
   * To do so, below lines will extract some children based on their type.
   *
   * As for actions, the check is straightforward since it is just a convenience
   * component that consumers will use directly as <Page.Actions>...</Page.Actions>.
   * However, <Page.Menu> could be wrapped by another component holding all the logic
   * to build and render an specific menu. Hence, the only option for them at this
   * moment is to look for children whose type ends in "PageMenu".
   *
   * @note: hot reloading could make weird things when working with this
   * component because of the type check.
   *
   * @see https://stackoverflow.com/questions/55729582/check-type-of-react-component
   */
  const [actions, rest] = partition(React.Children.toArray(children), child => child.type === Actions);
  const [menu, content] = partition(rest, child => child.type.name?.endsWith("PageMenu"));

  if (actions.length === 0) {
    actions.push(<BackAction key="back-action" />);
  }

  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div data-type="agama/page" data-layout="agama/base">
      <header>
        <h1>
          <If condition={icon} then={<Icon name={icon} />} />
          <span>{title}</span>
        </h1>
        <div data-type="agama/header-actions">
          { menu }
          <button
            onClick={openSidebar}
            className="plain-control"
            aria-label={_("Show global options")}
            aria-controls="global-options"
            aria-expanded={sidebarOpen}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      <main>
        { content }
      </main>

      <footer>
        <div role="navigation" aria-label={_("Page Actions")}>
          { actions }
        </div>
        <img src={logoUrl} alt="Logo of SUSE" />
      </footer>

      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
    </div>
  );
};

Page.Actions = Actions;
Page.Action = Action;
Page.Menu = Menu;
Page.BackAction = BackAction;

export default Page;
