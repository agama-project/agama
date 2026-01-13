/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { Title } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import HostnameSummary from "~/components/overview/HostnameSummary";
import L10nSummary from "~/components/overview/L10nSummary";
import StorageSummary from "~/components/overview/StorageSummary";
import NetworkSummary from "~/components/overview/NetworkSummary";
import SoftwareSummary from "~/components/overview/SoftwareSummary";
import { _ } from "~/i18n";

import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";

/**
 * InstallationSummarySection
 *
 * Renders a summary section displaying the main installation settings
 *
 *  TODO: Extract the two-columns hardcoded CSS grid to a reusable component
 */
export default function InstallationSummarySection() {
  return (
    <>
      <Title headingLevel="h2" className={a11yStyles.screenReader}>
        {_("Installation settings")}
      </Title>
      <NestedContent margin="mMd">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(250px, 1fr))",
            gap: "0.5em",
          }}
        >
          <HostnameSummary />
          <L10nSummary />
          <NetworkSummary />
          <StorageSummary />
          <SoftwareSummary />
        </div>
      </NestedContent>
    </>
  );
}
