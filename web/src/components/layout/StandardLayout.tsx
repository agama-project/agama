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
import InstallerL10nOptions from "~/components/core/InstallerL10nOptions";
import InstallerOptionsMenu from "~/components/core/InstallerOptionsMenu";
import ProgressStatusMonitor from "~/components/core/ProgressStatusMonitor";
import AppearanceSettings from "~/components/core/AppearanceSettings";
import Questions from "~/components/questions/Questions";

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
     * Whether the localization selector in the header shows its current values
     * (language and keyboard) next to the icons.
     *
     * Default: `false` (icon-only, to save space in the header)
     */
    showL10nValues?: boolean;
  }
>;

/**
 * Page layout with header, questions and optional progress tracking.
 *
 * It composes the header's trailing content shared by every page: any
 * page-specific content first, followed by the tools always available (the
 * localization selector, the progress status monitor, the appearance settings
 * and the installer options menu).
 */
export default function StandardLayout({
  progress,
  children,
  additionalContent,
  showProgressMonitor = true,
  showL10nValues = false,
  ...headerProps
}: StandardLayoutProps) {
  const headerContent = (
    <>
      {additionalContent}
      {showProgressMonitor && <ProgressStatusMonitor />}
      <InstallerL10nOptions showValues={showL10nValues} />
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
        {/* Where the header's "Skip to content" link lands, hence the id it
            points at and a focusable container that is not a tab stop. */}
        <PageGroup tabIndex={-1} id="main-content">
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
