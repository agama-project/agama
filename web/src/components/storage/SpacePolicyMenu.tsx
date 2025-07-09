/*
 * Copyright (c) [2025] SUSE LLC
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
import { Flex, Content } from "@patternfly/react-core";
import MenuButton from "~/components/core/MenuButton";
import { useNavigate, generatePath } from "react-router-dom";
import { useSetSpacePolicy } from "~/hooks/storage/space-policy";
import { SPACE_POLICIES } from "~/components/storage/utils";
import { apiModel } from "~/api/storage/types";
import { STORAGE as PATHS } from "~/routes/paths";
import * as driveUtils from "~/components/storage/utils/drive";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

const PolicyItem = ({ policy, modelDevice, isSelected, onClick }) => {
  return (
    <MenuButton.Item
      itemId={policy.id}
      isSelected={isSelected}
      description={driveUtils.contentActionsDescription(modelDevice, policy.id)}
      onClick={() => onClick(policy.id)}
    >
      <Content className={isSelected && textStyles.fontWeightBold}>{policy.label}</Content>
    </MenuButton.Item>
  );
};

export default function SpacePolicyMenu({ modelDevice, device }) {
  const navigate = useNavigate();
  const setSpacePolicy = useSetSpacePolicy();
  const { isBoot, isTargetDevice, list, listIndex } = modelDevice;
  const existingPartitions = device.partitionTable?.partitions.length;
  const hasPartitions = modelDevice.partitions.some((p: Partition) => p.mountPath);

  if (isEmpty(existingPartitions)) return;
  if (!isBoot && !isTargetDevice && !hasPartitions) return;

  const onSpacePolicyChange = (spacePolicy: apiModel.SpacePolicy) => {
    if (spacePolicy === "custom") {
      return navigate(generatePath(PATHS.editSpacePolicy, { list, listIndex }));
    } else {
      setSpacePolicy(list, listIndex, { type: spacePolicy });
    }
  };

  const currentPolicy = driveUtils.spacePolicyEntry(modelDevice);

  return (
    <Flex gap={{ default: "gapXs" }}>
      <strong>{_("Find space")}</strong>
      <MenuButton
        toggleProps={{
          variant: "plainText",
        }}
        items={SPACE_POLICIES.map((policy) => (
          <PolicyItem
            key={policy.id}
            policy={policy}
            modelDevice={modelDevice}
            isSelected={policy.id === currentPolicy.id}
            onClick={onSpacePolicyChange}
          />
        ))}
      >
        {driveUtils.contentActionsSummary(modelDevice)}
      </MenuButton>
    </Flex>
  );
}
