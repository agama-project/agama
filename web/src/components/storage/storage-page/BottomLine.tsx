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
import { HelperText, HelperTextItem, Stack, Flex, FlexItem } from "@patternfly/react-core";
import ConfigureDeviceMenu from "~/components/storage/ConfigureDeviceMenu";
import { useSingleDevice, useHasExistingContent } from "~/components/storage/storage-page/queries";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import RetargetOffer from "~/components/storage/shared/RetargetOffer";
import { _ } from "~/i18n";
import { useDevice } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import type { Partitionable } from "~/model/storage/config-model";

export default function BottomLinee(): React.ReactNode {
  const singleDevice = useSingleDevice();
  const device = useDevice(singleDevice?.device.name || "");
  const hasExistingContent = useHasExistingContent(singleDevice?.device.name);
  const spaceDecision = singleDevice && hasExistingContent;
  const reused =
    singleDevice &&
    configModel.partitionable.isReusingPartitions(singleDevice.device as Partitionable.Device);

  return (
    <Stack hasGutter>
      {spaceDecision && (
        <Flex
          gap={{ default: "gapSm" }}
          alignItems={{ default: "alignItemsCenter" }}
          justifyContent={{ default: "justifyContentCenter" }}
          flexWrap={{ default: "wrap" }}
        >
          <SpaceDecision collection={singleDevice.collection} index={singleDevice.index} />
        </Flex>
      )}
      {singleDevice && (
        <Flex
          gap={{ default: "gapSm" }}
          alignItems={{ default: "alignItemsCenter" }}
          justifyContent={{ default: "justifyContentCenter" }}
          flexWrap={{ default: "wrap" }}
        >
          <RetargetOffer entry={singleDevice.device} device={device} />
          <ConfigureDeviceMenu
            // TRANSLATORS: offered at the foot of the list of what the
            // installation is made of: bring more disks into it.
            label={_("Add more devices")}
            popperProps={{ position: "right" }}
          />
        </Flex>
      )}
      {reused && (
        <Flex
          gap={{ default: "gapSm" }}
          alignItems={{ default: "alignItemsCenter" }}
          justifyContent={{ default: "justifyContentCenter" }}
          flexWrap={{ default: "wrap" }}
        >
          <HelperText>
            <HelperTextItem>
              {_("Some options are not available because some partitions will be reused.")}
            </HelperTextItem>
          </HelperText>
        </Flex>
      )}
      {!singleDevice && (
        <Flex className="agm-entries-table__add">
          <FlexItem>
            <ConfigureDeviceMenu
              // TRANSLATORS: offered at the foot of the list of what the
              // installation is made of: bring more disks into it.
              label={_("Add more devices")}
              popperProps={{ position: "left" }}
            />
          </FlexItem>
        </Flex>
      )}
    </Stack>
  );
}
