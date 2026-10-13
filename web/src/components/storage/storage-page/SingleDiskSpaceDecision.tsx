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
import { Flex } from "@patternfly/react-core";
import { isEmpty } from "radashi";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import { useDevice } from "~/hooks/model/system/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";

/**
 * What may happen to the existing content of the installation disk, offered on
 * the page itself where the installation uses only that disk.
 *
 * It sits right under the result because it is the decision that changes it:
 * a reader who picks another answer sees what it did without scrolling back.
 *
 * Nothing is offered where the disk holds no partitions, since there is nothing
 * to decide about.
 */
export default function SingleDiskSpaceDecision(): React.ReactNode {
  const config = useConfigModel();
  const canChangeTarget = configModel.canChangeTargetDrive(config);
  const device = useDevice(config.drives[0]?.name || "");

  if (!canChangeTarget || isEmpty(device?.partitions)) return null;

  return (
    <Flex
      gap={{ default: "gapSm" }}
      alignItems={{ default: "alignItemsCenter" }}
      justifyContent={{ default: "justifyContentCenter" }}
      flexWrap={{ default: "wrap" }}
    >
      <SpaceDecision collection="drives" index={0} />
    </Flex>
  );
}
