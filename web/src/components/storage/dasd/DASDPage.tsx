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

import React, { useState } from "react";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Button,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Grid,
  GridItem,
  Split,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import Popup from "~/components/core/Popup";
import Text from "~/components/core/Text";
import NestedContent from "~/components/core/NestedContent";
import DASDTable from "./DASDTable";
import Icon from "~/components/layout/Icon";
import { useConfig } from "~/hooks/model/config/dasd";
import { useSystem } from "~/hooks/model/system/dasd";
import { STORAGE } from "~/routes/paths";
import { extendCollection } from "~/utils";
import { _, n_ } from "~/i18n";

/**
 * Information shown when no DASD devices are found on the system at all.
 *
 * This is a system-level constraint, user can do nothing.
 */
const NoDevicesAvailable = () => {
  return (
    <EmptyState
      headingLevel="h2"
      titleText={_("No devices available")}
      icon={() => <Icon name="search_off" />}
      variant="sm"
    >
      <EmptyStateBody>{_("No DASD devices were found in this machine.")}</EmptyStateBody>
    </EmptyState>
  );
};

/**
 * Information shown when the system has DASD devices but none have been added
 * to configuration yet.
 *
 * Prompts the user to open the device selector to get started.
 */
const NoDevicesConfigured = ({ openDevicesSelector }) => {
  return (
    <EmptyState
      headingLevel="h2"
      titleText={_("No DASD devices added yet")}
      icon={() => <Icon name="data_table" />}
      variant="sm"
    >
      <EmptyStateBody>
        {_("Add devices to make them available when setting up storage.")}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="secondary" onClick={openDevicesSelector}>
            {_("Add devices")}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
};

/**
 * Information replacing table when active filters produce no results.
 *
 * Provides a quick way to reset filters.
 */
const NoMatchesFound = ({ onClearFilters }) => {
  return (
    <EmptyState
      headingLevel="h2"
      titleText={_("No devices match filters")}
      icon={() => <Icon name="search_off" />}
      variant="xs"
    >
      <EmptyStateBody>{_("Change filters and try again.")}</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="secondary" onClick={onClearFilters}>
            {_("Clear all filters")}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
};

/**
 * Renders the descriptive content of the DASD intro section.
 *
 * Adapts messaging based on whether all available devices have been added
 * or if some are still available, showing counts accordingly.
 */
const DASDIntroSectionContent = ({ configured, available }) => {
  const configuredQty = configured.length;
  const availableQty = available.length;

  if (availableQty === 0) {
    return (
      <>
        <Content isEditorial>
          <Text isBold>
            {sprintf(
              n_(
                "The %d available device has been added.",
                "All %d available devices have been added.",
                configuredQty,
              ),
              configuredQty,
            )}
          </Text>
        </Content>
        <Content>
          {n_(
            "Review and configure it as needed using the table below.",
            "Review and configure each device as needed using the table below.",
            configuredQty,
          )}
        </Content>
      </>
    );
  }

  return (
    <>
      <Content isEditorial>
        <Text isBold>
          {sprintf(
            n_(
              "There is %d device added and %d more available.",
              "There are %d devices added and %d more available.",
              configuredQty,
            ),
            configuredQty,
            availableQty,
          )}
        </Text>
      </Content>
      <Content>
        {_("Review and configure each added device as needed using the table below.")}
      </Content>
    </>
  );
};

const DASDIntroSectionActions = ({ onClick }) => {
  return (
    <Button variant="secondary" onClick={onClick}>
      {_("Add more devices")}
    </Button>
  );
};

/**
 * Modal selector for adding system DASD devices to the installation configuration.
 *
 * Only shows devices not added yet. The `onSelect` callback is responsible
 * for persisting the selection before closing.
 */
const DevicesSelector = ({ devices, onSelect, onClose }) => {
  return (
    <Popup
      isOpen
      title={_("Add DASD devices")}
      description={_(
        "Select devices to make them available when setting up storage. Devices already added are not shown.",
      )}
      variant="large"
      style={{ minBlockSize: "70dvh" }}
    >
      <DASDTable
        devices={devices}
        omitColumns={["format"]}
        noMatchesState={(resetFilters) => <NoMatchesFound onClearFilters={resetFilters} />}
        itemActions={() => []}
      />

      <Popup.Actions>
        <Popup.Confirm onClick={onSelect}>{_("Add")}</Popup.Confirm>
        <Popup.Cancel onClick={onClose} />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Intro section combining status summary and the "Add devices" action.
 *
 * The action button is only shown when there are still devices available to
 * add.
 */
const DASDIntroSection = ({ configured, available, onAddMore }) => {
  return (
    <Page.Section
      actions={
        <Split hasGutter>
          {!isEmpty(available) && (
            <Button variant="primary" onClick={onAddMore}>
              {_("Add more devices")}
            </Button>
          )}
        </Split>
      }
    >
      <DASDIntroSectionContent configured={configured} available={available} />
    </Page.Section>
  );
};

/**
 * Main content area for the DASD page.
 *
 * Handles three distinct states:
 *  - No devices found on the system, renders an empty state
 *  - Devices found but none added, renders an empty state with selector trigger
 *  - Some or all devices added, renders an intro section and a filterable table
 */
const DASDPageContent = () => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const openSelector = () => setSelectorOpen(true);
  const closeSelector = () => setSelectorOpen(false);

  // const { devices: configDevices = [] } = useConfig() || {};
  // const { devices: systemDevices = [] } = useSystem() || {};

  // const configDevices: ConfigDevice[] = [
  //   {
  //     channel: "0.0.0160",
  //     diag: false,
  //     format: true,
  //     state: "offline",
  //   },
  // ];

  const configDevices = [];

  const systemDevices: SystemDevice[] = [
    {
      channel: "0.0.0160",
      active: false,
      deviceName: "",
      type: "",
      formatted: false,
      diag: true,
      status: "active",
      accessType: "",
      partitionInfo: "",
    },
    {
      channel: "0.0.0200",
      active: true,
      deviceName: "dasda",
      type: "eckd",
      formatted: false,
      diag: false,
      status: "active",
      accessType: "rw",
      partitionInfo: "1",
    },
  ];

  // const systemDevices = [];

  if (isEmpty(systemDevices)) {
    return <NoDevicesAvailable />;
  }

  const { extended: configured, unmatched: available } = extendCollection(configDevices, {
    with: systemDevices,
    matching: "channel",
  });

  if (isEmpty(configDevices)) {
    return (
      <>
        <NoDevicesConfigured openDevicesSelector={() => setSelectorOpen(true)} />
        {selectorOpen && (
          <DevicesSelector
            devices={available}
            onSelect={() => setSelectorOpen(false)}
            onClose={() => setSelectorOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Grid hasGutter>
        <GridItem sm={12}>
          <DASDIntroSection
            configured={configured}
            available={available}
            onAddMore={openSelector}
          />
        </GridItem>
        <GridItem sm={12}>
          <NestedContent>
            <DASDTable
              devices={configured}
              noMatchesState={(resetFilters) => <NoMatchesFound onClearFilters={resetFilters} />}
              omitColumns={["formatted", "partitionInfo"]}
            />
          </NestedContent>
        </GridItem>
      </Grid>
      {selectorOpen && (
        <DevicesSelector devices={available} onSelect={openSelector} onClose={closeSelector} />
      )}
    </>
  );
};

export default function DASDPage() {
  return (
    <Page breadcrumbs={[{ label: _("Storage"), path: STORAGE.root }, { label: _("DASD") }]}>
      <Page.Content>
        <DASDPageContent />
      </Page.Content>
    </Page>
  );
}
