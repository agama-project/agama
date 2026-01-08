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
import xbytes from "xbytes";
import Details from "~/components/core/Details";
import FormattedIPsList from "~/components/network/FormattedIpsList";
import NestedContent from "~/components/core/NestedContent";
import { useSystem } from "~/hooks/model/system";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

export default function SystemInformationSection() {
  const { hardware } = useSystem();

  return (
    <Flex gap={{ default: "gapMd" }} direction={{ default: "column" }}>
      <Title headingLevel="h2" className={textStyles.fontSizeLg}>
        {_("System Information")}
      </Title>
      <NestedContent margin="mxSm">
        <Details isHorizontal isCompact>
          <Details.Item label={_("Model")}>{hardware.model}</Details.Item>
          <Details.Item label={_("CPU")}>{hardware.cpu}</Details.Item>
          <Details.Item label={_("Memory")}>
            {hardware.memory ? xbytes(hardware.memory, { iec: true }) : undefined}
          </Details.Item>
          <Details.Item label={_("IPs")}>
            <FormattedIPsList />
          </Details.Item>
        </Details>
      </NestedContent>
    </Flex>
  );
}
