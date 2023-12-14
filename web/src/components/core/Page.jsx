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

import logoUrl from "~/assets/suse-horizontal-logo.svg";

import { _ } from "~/i18n";
import { partition } from "~/utils";
import { Icon } from "~/components/layout";
import { InstallerKeymapSwitcher, InstallerLocaleSwitcher } from "~/components/l10n";
import {
  About,
  Disclosure,
  If,
  IssuesLink,
  LogsButton,
  ShowLogButton,
  ShowTerminalButton,
  Sidebar
} from "~/components/core";

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
 * FIXME: Improve the note below
 * @note Sidebar must be mounted as sibling of the page content to make it work
 * as expected (allow it to be hidden, making inert siblings when open, etc).
 * Remember that Sidebar is going to content only things related to Agama itself
 *
 * @example <caption>Simple usage</caption>
 *   <Page icon="manage_accounts" title="Users settings">
 *     <UserSectionContent />
 *   </Page>
 *
 * @example <caption>Using a custom actions</caption>
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
 * @param {object} props
 * @param {string} [props.icon] - The icon for the page.
 * @param {string} [props.title="Agama"] - The title for the page. By default it
 *   uses the name of the tool, do not mark it for translation.
 * @param {JSX.Element} [props.children] - The page content.
 *
 */
const Page = ({ icon, title = "Agama", children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // NOTE: hot reloading could make weird things when working with this
  // component because the type check.
  //
  // @see https://stackoverflow.com/questions/55729582/check-type-of-react-component
  const [actions, rest] = partition(React.Children.toArray(children), child => child.type === Actions);

  // TODO: move PageOptions to an internal Page component
  // TODO: Improve and document below line
  const [options, content] = partition(rest, child => child.type.name?.endsWith("PageOptions"));

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
          { options }
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

      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar}>
        <div className="flex-stack">
          <IssuesLink />
          <Disclosure label={_("Diagnostic tools")} data-keep-sidebar-open>
            <ShowLogButton />
            <LogsButton data-keep-sidebar-open="true" />
            <ShowTerminalButton />
          </Disclosure>
          <About />
        </div>
        <div className="full-width highlighted">
          <div className="flex-stack">
            <div className="locale-container">
              <div><InstallerLocaleSwitcher /></div>
              <div><InstallerKeymapSwitcher /></div>
            </div>
          </div>
        </div>
      </Sidebar>
    </div>
  );
};

Page.Actions = Actions;
Page.Action = Action;
Page.BackAction = BackAction;

export default Page;
