/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { Suspense } from "react";
import { Outlet } from "react-router";
import { Page as PFPage, PageGroup } from "@patternfly/react-core";
import type { ProgressBackdropProps } from "~/components/core/ProgressBackdrop";
import ProgressBackdrop from "~/components/core/ProgressBackdrop";
import Header, { HeaderProps } from "~/components/layout/Header";
import Loading from "~/components/layout/Loading";
import { MAIN_CONTENT_ID } from "~/components/core/SkipTo";
import InstallerL10nOptions from "~/components/core/InstallerL10nOptions";
import NetworkIndicator from "~/components/network/NetworkIndicator";
import InstallerOptionsMenu from "~/components/core/InstallerOptionsMenu";
import ProgressStatusMonitor from "~/components/core/ProgressStatusMonitor";
import AppearanceSettings from "~/components/core/AppearanceSettings";
import Questions from "~/components/questions/Questions";

import type { ShowValues } from "~/components/core/InstallerL10nOptions";

export type StandardLayoutProps = React.PropsWithChildren<
  HeaderProps & {
    /** Optional progress tracking configuration */
    progress?: ProgressBackdropProps;

    /**
     * Whether the header shows the installation progress status.
     *
     * Default: `true`. Turn it off on the pages that report the progress
     * themselves.
     */
    showProgressMonitor?: boolean;

    /**
     * Which current values the localization selector in the header shows next
     * to its icons: all (language and keyboard), only the keymap, or none.
     *
     * Default: `"keymap"`, the keyboard in use, which matters whenever
     * something is typed; the language is the one being read.
     */
    showL10nValues?: ShowValues;

    /**
     * Whether to leave the localization selector out of the header, on the
     * page that already is about the installer language and keyboard.
     */
    hideL10nOptions?: boolean;
  }
>;

/**
 * Page layout with header, questions and optional progress tracking.
 *
 * It composes the header's trailing content shared by every page: any
 * page-specific content first, followed by the tools always available (the
 * progress status monitor, the network state, the localization selector, the
 * appearance settings and the installer options menu).
 */
export default function StandardLayout({
  progress,
  children,
  additionalContent,
  showProgressMonitor = true,
  showL10nValues = "keymap",
  hideL10nOptions = false,
  ...headerProps
}: StandardLayoutProps) {
  const headerContent = (
    <>
      {additionalContent}
      {showProgressMonitor && <ProgressStatusMonitor />}
      <NetworkIndicator />
      {!hideL10nOptions && <InstallerL10nOptions showValues={showL10nValues} />}
      <AppearanceSettings />
      <InstallerOptionsMenu hideLabel />
    </>
  );

  return (
    <PFPage
      isContentFilled
      masthead={<Header {...headerProps} additionalContent={headerContent} />}
    >
      <Suspense fallback={<Loading />}>
        {/* Focusable, so that the "Skip to content" link moves the focus here,
            but not a tab stop of its own. */}
        <PageGroup tabIndex={-1} id={MAIN_CONTENT_ID}>
          {/* Own content when used as a page, the active route when used as a
              layout. */}
          {children || <Outlet />}
          {progress && <ProgressBackdrop {...progress} />}
        </PageGroup>
      </Suspense>
      <Questions />
    </PFPage>
  );
}
