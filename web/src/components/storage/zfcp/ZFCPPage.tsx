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
import { sprintf } from "sprintf-js";
import {
  Content,
  Divider,
  EmptyState,
  EmptyStateBody,
  Flex,
  Grid,
  GridItem,
  Split,
} from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import SubtleContent from "~/components/core/SubtleContent";
import ZFCPDevicesTable from "~/components/storage/zfcp/ZFCPDevicesTable";
import { useControllers, useDevices } from "~/hooks/model/system/zfcp";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import IssuesAlert from "~/components/core/IssuesAlert";
import { useIssues } from "~/hooks/model/issue";
import type { ZFCP as System } from "~/model/system";

/**
 * Renders a PatternFly `EmptyState` block used when no zFCP controllers are detected on the host
 * machine.
 */
const NoZFCPAvailable = (): React.ReactNode => {
  return (
    <EmptyState headingLevel="h2" titleText={_("zFCP is not available")} variant="sm">
      <EmptyStateBody>{_("No zFCP controllers found in this machine.")}</EmptyStateBody>
    </EmptyState>
  );
};

/**
 * Renders a PatternFly `EmptyState` block used when no ZFCP devices are detected on the host
 * machine.
 */
const NoDevicesAvailable = (): React.ReactNode => {
  return (
    <EmptyState headingLevel="h2" titleText={_("No devices available")} variant="sm">
      <EmptyStateBody>{_("No zFCP devices found in this machine.")}</EmptyStateBody>
    </EmptyState>
  );
};

type ZFCPControllersDescriptionProps = {
  controllers: System.Controller[];
};

/**
 * Descripton to show in the controllers section.
 */
const ZFCPControllersDescription = ({
  controllers,
}: ZFCPControllersDescriptionProps): React.ReactNode => {
  const deactivatedControllers = controllers.filter((c) => !c.active);

  if (!isEmpty(deactivatedControllers)) {
    const text =
      deactivatedControllers.length === 1
        ? _("There is a deactivated zFCP controller.")
        : sprintf(_("There are %s deactivated zFCP controllers."), deactivatedControllers.length);
    return <Text>{text}</Text>;
  }

  return <Text>{_("All the available zFCP controllers are already activated.")}</Text>;
};

/**
 * Content switcher for the zFCP controllers.
 */
const ZFCPControllersContent = (): React.ReactNode => {
  const controllers = useControllers();
  const deactivatedControllers = controllers.filter((c) => !c.active);

  return (
    <Page.Section
      aria-label={_("zFCP controllers")}
      actions={
        !isEmpty(deactivatedControllers) && (
          <Split hasGutter>
            <Link to={STORAGE.zfcp.controllers} variant="primary">
              {_("Activate controllers")}
            </Link>
          </Split>
        )
      }
    >
      <Flex direction={{ default: "column" }}>
        <Content isEditorial>
          <Flex gap={{ default: "gapXs" }}>
            <Text isBold>{_("zFCP controllers")}</Text>{" "}
            <Text component="small">{controllers.map((c) => c.channel).join(", ")}</Text>
          </Flex>
        </Content>
        <SubtleContent>
          <ZFCPControllersDescription controllers={controllers} />
        </SubtleContent>
      </Flex>
    </Page.Section>
  );
};

/**
 * Content switcher for the zFCP devices.
 */
const ZFCPDevicesContent = (): React.ReactNode => {
  const devices = useDevices();

  if (isEmpty(devices)) {
    return <NoDevicesAvailable />;
  }

  return <ZFCPDevicesTable devices={devices} />;
};

/**
 * Content switcher for the zFCP page.
 */
const ZFCPPageContent = (): React.ReactNode => {
  const controllers = useControllers();

  if (isEmpty(controllers)) {
    return <NoZFCPAvailable />;
  }

  return (
    <Grid hasGutter>
      <GridItem sm={12}>
        <ZFCPControllersContent />
      </GridItem>
      <Divider />
      <GridItem sm={12}>
        <ZFCPDevicesContent />
      </GridItem>
    </Grid>
  );
};

/**
 * Top-level page component for zFCP storage.
 */
export default function ZFCPPage(): React.ReactNode {
  const issues = useIssues("zfcp");

  return (
    <Page
      breadcrumbs={[{ label: _("Storage"), path: STORAGE.root }, { label: _("zFCP") }]}
      progress={{ scope: "zfcp" }}
    >
      <Page.Content>
        <IssuesAlert issues={issues} />
        <ZFCPPageContent />
      </Page.Content>
    </Page>
  );
}
