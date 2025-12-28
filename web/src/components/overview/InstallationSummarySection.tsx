/*
 * Copyright (c) [2025] SUSE LLC
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
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import Details from "~/components/core/Details";
import HostnameDetailsItem from "~/components/system/HostnameDetailsItem";
import L10nDetailsItem from "~/components/l10n/L10nDetailsItem";
import { _ } from "~/i18n";
import StorageDetailsItem from "../storage/StorageDetailsItem";
import NetworkDetailsItem from "../network/NetworkDetailsItem";

export default function InstallationSummarySection() {
  return (
    <Page.Section title={_("Installation summary")}>
      <NestedContent margin="mMd">
        <Details isHorizontal isCompact>
          <HostnameDetailsItem />
          <L10nDetailsItem />
          <StorageDetailsItem />
          <NetworkDetailsItem />
        </Details>
      </NestedContent>
    </Page.Section>
  );
}
