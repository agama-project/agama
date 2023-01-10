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

import logoUrl from "@assets/suse-horizontal-logo.svg";
import { createTeleporter } from "react-teleporter";

const PageTitle = createTeleporter();
const HeaderActions = createTeleporter();
const HeaderIcon = createTeleporter();
const FooterActions = createTeleporter();
const FooterInfoArea = createTeleporter();

/**
 * D-Installer main layout component.
 *
 * It displays the content in a single vertical responsive column with fixed
 * header and footer.
 *
 * @example
 *   <Layout>
 *     <PageIcon><DashboardIcon /></PageIcon>
 *     <PageActions><DahboardActions /></PageActions>
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
    <>
      <header className="split justify-between">
        <h1 className="split">
          <HeaderIcon.Target as="span" />
          <PageTitle.Target as="span" />
        </h1>

        <HeaderActions.Target as="span" />
      </header>

      <main className="stack">{children}</main>

      <footer className="split justify-between" data-state="reversed">
        <FooterActions.Target
          role="navigation"
          aria-label="Installer Actions"
        />
        <FooterInfoArea.Target />
        <img src={logoUrl} alt="Logo of SUSE" />
      </footer>
    </>
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
 *   import { AdditionaInfo } from "dinstaller-layout";
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

export {
  Layout as default,
  Title,
  PageIcon,
  PageActions,
  MainActions,
  AdditionalInfo
};
