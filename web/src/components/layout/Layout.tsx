/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { Suspense, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Masthead, Page, PageProps } from "@patternfly/react-core";
import { Questions } from "~/components/questions";
import Header, { HeaderProps } from "~/components/layout/Header";
import { Loading, Sidebar } from "~/components/layout";
import { IssuesDrawer, SkipTo } from "~/components/core";
import { ROOT } from "~/routes/paths";

export type LayoutProps = React.PropsWithChildren<{
  className?: string;
  mountHeader?: boolean;
  mountSidebar?: boolean;
  mountSkipToContent?: boolean;
  headerOptions?: HeaderProps;
}>;

const focusDrawer = (drawer: HTMLElement | null) => {
  if (drawer === null) return;

  const firstTabbableItem = drawer.querySelector("a, button") as
    | HTMLAnchorElement
    | HTMLButtonElement
    | null;
  firstTabbableItem?.focus();
};

/**
 * Custom width breakpoints for the Agama layout.
 *
 * These values override PatternFly's default breakpoints to better fit Agama's
 * needs. Each value is specified in pixels and is derived from rem-based
 * measurements, multiplied by the standard root font size (16px).
 *
 * Breakpoints:
 * - sm:  36rem  / 576px
 * - md:  48rem  / 768px
 * - lg:  64rem  / 1024px
 * - xl:  75rem  / 1200px
 * - 2xl: 90rem  / 1440px
 */
const agamaWidthBreakpoints = {
  sm: parseInt("36rem") * 16,
  md: parseInt("48rem") * 16,
  lg: parseInt("64rem") * 16,
  xl: parseInt("75rem") * 16,
  "2xl": parseInt("90rem") * 16,
};

/**
 * Maps a viewport width (in pixels) to the appropriate Agama breakpoint.
 *
 * This function is used to determine the responsive breakpoint level
 * based on the current viewport width, aligning with the custom
 * `agamaWidthBreakpoints`.
 *
 * @param width - The current viewport width in pixels.
 * @returns A breakpoint string: 'default', 'sm', 'md', 'lg', 'xl', or '2xl'.
 */
const getBreakpoint = (width: number): "default" | "sm" | "md" | "lg" | "xl" | "2xl" => {
  if (width === null) {
    return null;
  }
  if (width >= agamaWidthBreakpoints["2xl"]) {
    return "2xl";
  }
  if (width >= agamaWidthBreakpoints.xl) {
    return "xl";
  }
  if (width >= agamaWidthBreakpoints.lg) {
    return "lg";
  }
  if (width >= agamaWidthBreakpoints.md) {
    return "md";
  }
  if (width >= agamaWidthBreakpoints.sm) {
    return "sm";
  }
  return "default";
};

/**
 * Component for laying out the application content inside a PF/Page that might
 * or might not mount a header and a sidebar depending on the given props.
 *
 * FIXME: move the focus to the notification drawer when it is open
 */
const Layout = ({
  mountHeader = true,
  mountSidebar = true,
  mountSkipToContent = true,
  headerOptions = {},
  children,
  ...props
}: LayoutProps) => {
  const drawerRef = useRef();
  const location = useLocation();
  const [issuesDrawerVisible, setIssuesDrawerVisible] = useState<boolean>(false);
  const closeIssuesDrawer = () => setIssuesDrawerVisible(false);
  const toggleIssuesDrawer = () => setIssuesDrawerVisible(!issuesDrawerVisible);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [windowSize, setWindowSize] = useState<number>();

  const onPageResize = (_, { windowSize: newWindowSize }: { windowSize: number }) => {
    if (newWindowSize === windowSize) return;
    setWindowSize(newWindowSize);
    mountSidebar && setIsSidebarOpen(newWindowSize >= agamaWidthBreakpoints.lg);
  };

  const pageProps: Omit<PageProps, keyof React.HTMLProps<HTMLDivElement>> = {};

  if (mountSidebar) {
    pageProps.sidebar = <Sidebar isSidebarOpen={isSidebarOpen} />;
  }
  if (mountHeader) {
    pageProps.masthead = (
      <Header
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        showSidebarToggle={mountSidebar}
        toggleIssuesDrawer={toggleIssuesDrawer}
        showSkipToContent={mountSkipToContent}
        {...headerOptions}
      />
    );
    // notificationDrawer is open/close from the header, it does not make sense
    // to mount it if there is no header.
    pageProps.notificationDrawer = <IssuesDrawer onClose={closeIssuesDrawer} ref={drawerRef} />;
    pageProps.isNotificationDrawerExpanded = issuesDrawerVisible;
  } else {
    // FIXME: render an empty Masthead instead of nothing, in order to have
    // everything working as designed by PatternFly (there are some CSS rules
    // that expect the masthead to be there :shrug:)
    pageProps.masthead = <Masthead>{mountSkipToContent && <SkipTo />}</Masthead>;
  }

  return (
    <>
      <Page
        onPageResize={onPageResize}
        getBreakpoint={getBreakpoint}
        isContentFilled
        {...pageProps}
        {...props}
        onNotificationDrawerExpand={() => focusDrawer(drawerRef.current)}
      >
        <Suspense fallback={<Loading />}>{children || <Outlet />}</Suspense>
      </Page>
      {location.pathname !== ROOT.login && location.pathname !== ROOT.installationExit && (
        <Questions />
      )}
    </>
  );
};

/** Default props for FullLayout */
const fullProps: LayoutProps = {
  className: "agm-full-layout",
  mountHeader: true,
  mountSidebar: true,
  headerOptions: {
    showProductName: true,
    showInstallerOptions: true,
  },
};

/**
 * A Layout component variant intended to mount a dark header with all possible options,
 * sidebar included.
 */
const Full = (props: LayoutProps) => <Layout {...fullProps} {...props} />;

/** Default props for PlainLayout */
const plainProps: LayoutProps = {
  className: "agm-plain-layout",
  mountHeader: true,
  mountSidebar: false,
  headerOptions: {
    showProductName: false,
    showInstallerOptions: true,
  },
};

/**
 * A Layout component variant intended to mount a light header without sidebar and limited options.
 */
const Plain = (props: LayoutProps) => <Layout {...plainProps} {...props} />;

export default Layout;
export { Full, Plain };
