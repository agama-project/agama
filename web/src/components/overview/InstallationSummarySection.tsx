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
import { Flex, Title } from "@patternfly/react-core";
import Details from "~/components/core/Details";
import HostnameDetailsItem from "~/components/system/HostnameDetailsItem";
import L10nDetailsItem from "~/components/l10n/L10nDetailsItem";
import StorageDetailsItem from "~/components/storage/StorageDetailsItem";
import NetworkDetailsItem from "~/components/network/NetworkDetailsItem";
import SoftwareDetailsItem from "~/components/software/SoftwareDetailsItem";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { NestedContent } from "../core";

export default function InstallationSummarySection() {
  return (
    <Flex gap={{ default: "gapSm" }} direction={{ default: "column" }}>
      <Title headingLevel="h2" className={textStyles.fontSizeLg}>
        {_("Installation settings")}
      </Title>
      <NestedContent margin="mxSm">
        <Details isHorizontal isCompact>
          <HostnameDetailsItem />
          <L10nDetailsItem />
          <NetworkDetailsItem />
          <StorageDetailsItem />
          <SoftwareDetailsItem />
        </Details>
      </NestedContent>
    </Flex>
  );
}
