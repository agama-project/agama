/*
 * Copyright (c) [2022] SUSE LLC
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

import logoUrl from "~/assets/suse-horizontal-logo.svg";
import { createTeleporter } from "react-teleporter";
import { Sidebar } from "~/components/core";

const PageTitle = createTeleporter();
const PageOptions = createTeleporter();
const HeaderActions = createTeleporter();
const HeaderIcon = createTeleporter();
const FooterActions = createTeleporter();
const FooterInfoArea = createTeleporter();

/**
 *
 * The D-Installer main layout component.
 *
 * It displays the content in a single column with a fixed header and footer.
 *
 * To achieve a {@link https://gregberge.com/blog/react-scalable-layout scalable layout},
 * it uses {@link https://reactjs.org/docs/portals.html React Portals} through
 * {@link https://github.com/gregberge/react-teleporter react-teleporter}. In other words,
 * it is mounted only once and gets influenced by other components by using the created
 * slots (Title, PageIcon, MainActions, etc).
 *
 * So, please ensure that {@link test-utils!mockLayout } gets updated when adding or deleting
 * slots here. It's needed in order to allow testing the output of components that interact
 * with the layout using that mechanism.
 *
 * @example
 *   <Layout>
 *     <PageIcon><DashboardIcon /></PageIcon>
 *     <PageActions><DashboardActions /></PageActions>
 *     <MainActions><Install /></MainActions>
 *     <Title>Dashboard</Title>
 *
 *     <Content />
 *
 *     <AdditionalInfo>
 *       <About />
 *       <TheTeam />
 *     </AdditionalInfo
 *   </Layout>
 *
 * @param {object} props - component props
 * @param {React.ReactNode} [props.children] - the section content
 *
 */
function Layout({ children }) {
  return (
    <div className="wrapper shadow">
      <header className="split justify-between bottom-shadow">
        <h1 className="split">
          <HeaderIcon.Target as="span" />
          <PageTitle.Target as="span" />
        </h1>

        <HeaderActions.Target as="span" />
      </header>

      <Sidebar />

      <main className="stack">
        {children}
      </main>

      <footer className="split justify-between top-shadow" data-state="reversed">
        <FooterActions.Target
          role="navigation"
          aria-label="Installer Actions"
        />
        <img src={logoUrl} alt="Logo of SUSE" />
      </footer>
    </div>
  );
}

/**
 * Component for setting the title shown at the header
 *
 * @example
 *   <Title>Partitioner</Title>
 */
const Title = PageTitle.Source;

/**
 * Component for setting the icon shown at the header left
 *
 * @example
 *   import { PageIcon } from "dinstaller-layout";
 *   import { FancyIcon } from "icons-package";
 *   ...
 *   <PageIcon><FancyIcon color="white" /></PageIcon>
 */
const PageIcon = HeaderIcon.Source;

/**
 * Component for setting page actions shown on the header right
 *
 * @example
 *   import { PageActions } from "dinstaller-layout";
 *   import { FancyButton } from "somewhere";
 *   ...
 *   <PageActions>
 *     <FancyButton onClick={() => console.log("do something")} />
 *   </PageActions>
 */
const PageActions = HeaderActions.Source;

/**
 * Component for setting the main actions shown on the footer right
 *
 * @example
 *   import { MainActions } from "dinstaller-layout";
 *   import { FancyButton } from "somewhere";
 *   ...
 *   <MainActions>
 *     <FancyButton onClick={() => console.log("do something")} />
 *   </MainActions>
 */
const MainActions = FooterActions.Source;

/**
 * Component for setting the additional content shown at the footer
 *
 * @example
 *   import { AdditionalInfo } from "dinstaller-layout";
 *   import { About, HostIp } from "somewhere";
 *
 *   ...
 *
 *   <AdditionalInfo>
 *     <About onClick={() => console.log("show a pop-up with more information")} />
 *     <HotIp />
 *   </AdditionalInfo>
 */
const AdditionalInfo = FooterInfoArea.Source;

/**
 * Component for setting the slot to place related options, usually in the Sidebar
 */
const PageOptionsSlot = PageOptions.Target;

/**
 * Component for teleporting page related options to the PageOptions slot
 */
const PageOptionsContent = PageOptions.Source;

export {
  Layout as default,
  Title,
  PageIcon,
  PageActions,
  MainActions,
  AdditionalInfo,
  PageOptionsSlot,
  PageOptionsContent,
};
