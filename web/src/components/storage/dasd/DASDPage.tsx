/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { isEmpty } from "radashi";
import { EmptyState, EmptyStateBody } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import DASDTable from "./DASDTable";
import { useSystem } from "~/hooks/model/system/dasd";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Renders a PatternFly `EmptyState` block used when no DASD devices are detected
 * on the host machine.
 */
const NoDevicesAvailable = () => {
  return (
    <EmptyState headingLevel="h2" titleText={_("No devices available")} variant="sm">
      <EmptyStateBody>{_("No DASD devices were found in this machine.")}</EmptyStateBody>
    </EmptyState>
  );
};

/**
 * Data-aware content switcher for the DASD page.
 *
 * Reads the device list and renders the content based on it.
 */
const DASDPageContent = () => {
  const { devices = [] } = useSystem() || {};

  if (isEmpty(devices)) {
    return <NoDevicesAvailable />;
  }

  return <DASDTable devices={devices} />;
};

/**
 * Top-level page component for the DASD storage section.
 *
 * Wraps content in the shared `Page` shell which provides breadcrumb navigation
 * (Storage > DASD) and a standardised content layout. All data concerns are
 * delegated to internal `DASDPageContent` component.
 */
export default function DASDPage() {
  return (
    <Page
      breadcrumbs={[{ label: _("Storage"), path: STORAGE.root }, { label: _("DASD") }]}
      progress={{ scope: "dasd" }}
    >
      <Page.Content>
        <DASDPageContent />
      </Page.Content>
    </Page>
  );
}
