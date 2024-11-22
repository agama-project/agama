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

import React, { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Page } from "@patternfly/react-core";
import Header, { HeaderProps } from "~/components/layout/Header";
import { Loading, Sidebar } from "~/components/layout";
import { IssuesDrawer } from "~/components/core";

type LayoutProps = React.PropsWithChildren<{
  mountHeader?: boolean;
  mountSidebar?: boolean;
  headerOptions?: HeaderProps;
}>;

/**
 * Component for laying out the application content inside a PF/Page that might
 * or might not mount a header and a sidebar depending on the given props.
 *
 * FIXME: move the focus to the notification drawer when it is open
 */
const Layout = ({
  mountHeader = true,
  mountSidebar = true,
  headerOptions = {},
  children,
}: LayoutProps) => {
  const [issuesDrawerVisible, setIssuesDrawerVisible] = useState<boolean>(false);
  const closeIssuesDrawer = () => setIssuesDrawerVisible(false);
  const toggleIssuesDrawer = () => setIssuesDrawerVisible(!issuesDrawerVisible);

  return (
    <Page
      isManagedSidebar
      header={
        mountHeader && (
          <Header
            showSidebarToggle={mountSidebar}
            toggleIssuesDrawer={toggleIssuesDrawer}
            {...headerOptions}
          />
        )
      }
      sidebar={mountSidebar && <Sidebar />}
      notificationDrawer={<IssuesDrawer onClose={closeIssuesDrawer} />}
      isNotificationDrawerExpanded={issuesDrawerVisible}
    >
      <Suspense fallback={<Loading />}>{children || <Outlet />}</Suspense>
    </Page>
  );
};

/** Default props for FullLayout */
const fullProps: LayoutProps = {
  mountHeader: true,
  mountSidebar: true,
  headerOptions: {
    showProductName: true,
    showInstallerOptions: true,
    background: "dark",
  },
};

/**
 * A Layout component variant intended to mount a dark header with all possible options,
 * sidebar included.
 */
const Full = (props: LayoutProps) => <Layout {...fullProps} {...props} />;

/** Default props for PlainLayout */
const plainProps: LayoutProps = {
  mountHeader: true,
  mountSidebar: false,
  headerOptions: {
    showProductName: false,
    showInstallerOptions: true,
    background: "light200",
  },
};

/**
 * A Layout component variant intended to mount a light header without sidebar and limited options.
 */
const Plain = (props: LayoutProps) => <Layout {...plainProps} {...props} />;

export default Layout;
export { Full, Plain };
