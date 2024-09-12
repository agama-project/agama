/*
 * Copyright (c) [2023] SUSE LLC
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

// cspell:ignore wwpns npiv

import React, { useState } from "react";
import {
  Button,
  Grid,
  GridItem,
  Stack,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { Section, Page } from "~/components/core";
import { _ } from "~/i18n";
import { useZFCPConfig, useZFCPControllersChanges, useZFCPDisksChanges } from "~/queries/zfcp";
import ZFCPDisksTable from "./ZFCPDisksTable";
import ZFCPControllersTable from "./ZFCPControllersTable";
import { probeZFCP } from "~/api/zfcp";
import { PATHS } from "~/routes/storage";
import { useNavigate } from "react-router-dom";
import { inactiveLuns } from "~/utils/zfcp";

/**
 * Section for zFCP controllers.
 */
const ControllersSection = () => {
  const allowLUNScan = useZFCPConfig().allowLunScan;
  const controllers = useZFCPControllersChanges();

  const load = () => {
    probeZFCP();
  };

  const EmptyState = () => {
    return (
      <Stack hasGutter>
        <div>{_("No zFCP controllers found.")}</div>
        <div>{_("Please, try to read the zFCP devices again.")}</div>
        {/* TRANSLATORS: button label */}
        <Button variant="primary" onClick={load}>
          {_("Read zFCP devices")}
        </Button>
      </Stack>
    );
  };

  const Content = () => {
    const LUNScanInfo = () => {
      const msg = allowLUNScan
        ? // TRANSLATORS: the text in the square brackets [] will be displayed in bold
          _(
            "Automatic LUN scan is [enabled]. Activating a controller which is \
running in NPIV mode will automatically configures all its LUNs.",
          )
        : // TRANSLATORS: the text in the square brackets [] will be displayed in bold
          _(
            "Automatic LUN scan is [disabled]. LUNs have to be manually \
configured after activating a controller.",
          );

      const [msgStart, msgBold, msgEnd] = msg.split(/[[\]]/);

      return (
        <p>
          {msgStart}
          <b>{msgBold}</b>
          {msgEnd}
        </p>
      );
    };

    return (
      <>
        <LUNScanInfo />
        <ZFCPControllersTable />
      </>
    );
  };

  return (
    <Section title="Controllers">{controllers.length === 0 ? <EmptyState /> : <Content />}</Section>
  );
};

/**
 * Section for zFCP disks.
 */
const DisksSection = () => {
  const controllers = useZFCPControllersChanges();
  const disks = useZFCPDisksChanges();
  const navigate = useNavigate();

  const EmptyState = () => {
    const NoActiveControllers = () => {
      return <div>{_("Please, try to activate a zFCP controller.")}</div>;
    };

    const NoActiveDisks = () => {
      return (
        <>
          <div>{_("Please, try to activate a zFCP disk.")}</div>
          {/* TRANSLATORS: button label */}
          <Button variant="primary" onClick={() => navigate(PATHS.zfcp.activateDisk)}>
            {_("Activate zFCP disk")}
          </Button>
        </>
      );
    };

    return (
      <Stack hasGutter>
        <div>{_("No zFCP disks found.")}</div>
        {controllers.some((c) => c.active) ? <NoActiveDisks /> : <NoActiveControllers />}
      </Stack>
    );
  };

  const Content = () => {
    const isDisabled = inactiveLuns(controllers, disks).length === 0;

    return (
      <>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignRight" }}>
              {/* TRANSLATORS: button label */}
              <Button onClick={() => navigate(PATHS.zfcp.activateDisk)} isDisabled={isDisabled}>
                {_("Activate new disk")}
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <ZFCPDisksTable />
      </>
    );
  };

  return (
    // TRANSLATORS: section title
    <Section title={_("Disks")}>{disks.length === 0 ? <EmptyState /> : <Content />}</Section>
  );
};

/**
 * Page for managing zFCP devices.
 */
export default function ZFCPPage() {
  return (
    <Page>
      <Page.Header>
        <h2>{_("ZFCP")}</h2>
      </Page.Header>
      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12} xl={6}>
            <ControllersSection />
          </GridItem>
          <GridItem sm={12} xl={6}>
            <DisksSection />
          </GridItem>
        </Grid>
      </Page.MainContent>
      <Page.NextActions>
        <Page.Action navigateTo={PATHS.targetDevice}>{_("Close")}</Page.Action>
      </Page.NextActions>
    </Page>
  );
}
