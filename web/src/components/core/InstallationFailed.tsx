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
import { Flex, Stack } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import RebootButton from "~/components/core/RebootButton";
import SplitInfoLayout from "../layout/SplitInfoLayout";
import { _ } from "~/i18n";
import DownloadLogsButton from "./DownloadLogsButton";

/**
 * Installation failure screen
 *
 * Displays an error page when the installation process fails, providing users
 * with options to download logs and reboot the system to retry.
 *
 */
export default function InstallationFailed() {
  return (
    <Page variant="minimal">
      <Page.Content>
        <SplitInfoLayout
          icon="report"
          firstRowStart={_("Installation failed")}
          secondRowStart={
            <Stack hasGutter>
              <Text>{_("Download logs to troubleshoot or share with support.")}</Text>
              <Text component="small">{_("Reboot to try again.")}</Text>
            </Stack>
          }
          firstRowEnd={
            <Flex
              gap={{ default: "gapSm" }}
              direction={{ default: "row" }}
              alignItems={{ default: "alignItemsCenter" }}
              alignContent={{ sm: "alignContentCenter" }}
              justifyContent={{ sm: "justifyContentCenter", md: "justifyContentFlexStart" }}
            >
              <RebootButton size="default" />
              <DownloadLogsButton />
            </Flex>
          }
        />
      </Page.Content>
    </Page>
  );
}
