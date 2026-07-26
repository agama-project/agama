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

import React from "react";
import { Masthead, Page as PFPage, PageGroup } from "@patternfly/react-core";

export type MinimalLayoutProps = React.PropsWithChildren;

/**
 * Page layout with an empty masthead, for the pages that stand on their own.
 *
 * Login, error and installation exit pages have nowhere to navigate to and
 * nothing to configure, so they show none of the shared page tools. The
 * masthead stays in place, empty, to keep the content where users expect it.
 */
export default function MinimalLayout({ children }: MinimalLayoutProps) {
  return (
    <PFPage isContentFilled masthead={<Masthead />}>
      {/* Same content container as the standard layout, focusable and named
          alike, so anything moving the focus to the main content keeps working
          on these pages too. */}
      <PageGroup tabIndex={-1} id="main-content">
        {children}
      </PageGroup>
    </PFPage>
  );
}
