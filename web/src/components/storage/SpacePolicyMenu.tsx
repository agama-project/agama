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

import React, { forwardRef } from "react";
import { Button, Flex, FlexItem } from "@patternfly/react-core";
import MenuButton, { CustomToggleProps } from "~/components/core/MenuButton";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import { useNavigate } from "react-router";
import { useSetSpacePolicy } from "~/hooks/storage/space-policy";
import { SPACE_POLICIES } from "~/components/storage/utils";
import { apiModel } from "~/api/storage";
import { storage as system } from "~/api/system";
import { STORAGE as PATHS } from "~/routes/paths";
import * as driveUtils from "~/components/storage/utils/drive";
import { generateEncodedPath } from "~/utils";
import { model } from "~/storage";
import { isEmpty } from "radashi";

const PolicyItem = ({ policy, modelDevice, isSelected, onClick }) => {
  return (
    <MenuButton.Item
      itemId={policy.id}
      isSelected={isSelected}
      description={driveUtils.contentActionsDescription(modelDevice, policy.id)}
      onClick={() => onClick(policy.id)}
    >
      <Text isBold={isSelected}>{policy.label}</Text>
    </MenuButton.Item>
  );
};

type SpacePolicyMenuToggleProps = CustomToggleProps & {
  drive: model.Drive;
};

const SpacePolicyMenuToggle = forwardRef(({ drive, ...props }: SpacePolicyMenuToggleProps, ref) => {
  return (
    <Button variant="link" ref={ref} style={{ display: "inline", width: "fit-content" }} {...props}>
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapSm" }}
        flexWrap={{ default: "nowrap" }}
        style={{ whiteSpace: "normal", textAlign: "start" }}
      >
        <FlexItem>{driveUtils.contentActionsSummary(drive)}</FlexItem>
        <FlexItem>
          <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
        </FlexItem>
      </Flex>
    </Button>
  );
});

type SpacePolicyMenuProps = {
  modelDevice: model.Drive | model.MdRaid;
  device: system.Device;
};

export default function SpacePolicyMenu({ modelDevice, device }: SpacePolicyMenuProps) {
  const navigate = useNavigate();
  const setSpacePolicy = useSetSpacePolicy();
  const { list, listIndex } = modelDevice;
  const existingPartitions = device.partitions?.length;

  if (isEmpty(existingPartitions)) return;

  const onSpacePolicyChange = (spacePolicy: apiModel.SpacePolicy) => {
    if (spacePolicy === "custom") {
      return navigate(generateEncodedPath(PATHS.editSpacePolicy, { list, listIndex }));
    } else {
      setSpacePolicy(list, listIndex, { type: spacePolicy });
    }
  };

  const currentPolicy = driveUtils.spacePolicyEntry(modelDevice);

  return (
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
      customToggle={<SpacePolicyMenuToggle drive={modelDevice} />}
    />
  );
}
