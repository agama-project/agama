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

import React, { forwardRef } from "react";
import { Button, Flex, FlexItem } from "@patternfly/react-core";
import MenuButton, { CustomToggleProps } from "~/components/core/MenuButton";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import { useNavigate } from "react-router";
import {
  PARTITIONABLE_SPACE_POLICIES,
  VOLUME_GROUP_SPACE_POLICIES,
} from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import * as driveUtils from "~/components/storage/utils/drive";
import * as volumeGroupUtils from "~/components/storage/utils/volume-group";
import { generateEncodedPath } from "~/utils";
import { isEmpty } from "radashi";
import {
  useDevice as useDeviceConfig,
  useSetSpacePolicy,
} from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import type { ConfigModel } from "~/model/storage/config-model";
import type { SpacePolicy } from "~/components/storage/utils";
import { _ } from "~/i18n";

type PolicyItemProps = {
  policy: SpacePolicy;
  collection: "drives" | "mdRaids" | "volumeGroups";
  index: number;
};

const PolicyItem = ({ policy, collection, index }: PolicyItemProps) => {
  const navigate = useNavigate();
  const setSpacePolicy = useSetSpacePolicy();
  const deviceConfig = useDeviceConfig(collection, index);

  const changePolicy = () => {
    if (policy.id === "custom") {
      return navigate(generateEncodedPath(PATHS.editSpacePolicy, { collection, index }));
    } else {
      setSpacePolicy(collection, index, { type: policy.id });
    }
  };

  const description = (): string | null => {
    switch (collection) {
      case "drives":
      case "mdRaids": {
        return driveUtils.contentActionsDescription(deviceConfig as ConfigModel.Drive, policy.id);
      }
      case "volumeGroups": {
        return volumeGroupUtils.contentActionsDescription(
          deviceConfig as ConfigModel.VolumeGroup,
          policy.id,
        );
      }
    }
  };

  const isSelected = policy.id === deviceConfig.spacePolicy;

  return (
    <MenuButton.Item
      itemId={policy.id}
      isSelected={isSelected}
      description={description()}
      onClick={changePolicy}
    >
      {/* eslint-disable-next-line agama-i18n/string-literals */}
      <Text isBold={isSelected}>{_(policy.label)}</Text>
    </MenuButton.Item>
  );
};

type SpacePolicyMenuToggleProps = CustomToggleProps & {
  collection: "drives" | "volumeGroups" | "mdRaids";
  index: number;
};

const SpacePolicyMenuToggle = forwardRef(
  ({ collection, index, ...props }: SpacePolicyMenuToggleProps, ref) => {
    const deviceConfig = useDeviceConfig(collection, index);

    const summary = (): string | null => {
      switch (collection) {
        case "drives":
        case "mdRaids": {
          return driveUtils.contentActionsSummary(deviceConfig as ConfigModel.Drive);
        }
        case "volumeGroups": {
          return volumeGroupUtils.contentActionsSummary(deviceConfig as ConfigModel.VolumeGroup);
        }
      }
    };

    return (
      <Button
        variant="link"
        ref={ref}
        style={{ display: "inline", width: "fit-content" }}
        {...props}
      >
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          gap={{ default: "gapSm" }}
          flexWrap={{ default: "nowrap" }}
          style={{ whiteSpace: "normal", textAlign: "start" }}
        >
          <FlexItem>{summary()}</FlexItem>
          <FlexItem>
            <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
          </FlexItem>
        </Flex>
      </Button>
    );
  },
);

type SpacePolicyMenuProps = {
  collection: "drives" | "mdRaids" | "volumeGroups";
  index: number;
};

export default function SpacePolicyMenu({ collection, index }: SpacePolicyMenuProps) {
  const deviceConfig = useDeviceConfig(collection, index);
  const device = useDevice(deviceConfig.name);
  const hasVolumes = device && !isEmpty(device.partitions || device.logicalVolumes || []);

  if (!hasVolumes) return;

  const policies = (): SpacePolicy[] => {
    switch (collection) {
      case "drives":
      case "mdRaids": {
        return PARTITIONABLE_SPACE_POLICIES;
      }
      case "volumeGroups": {
        return VOLUME_GROUP_SPACE_POLICIES;
      }
    }
  };

  return (
    <MenuButton
      toggleProps={{
        variant: "plainText",
      }}
      items={policies().map((policy) => (
        <PolicyItem key={policy.id} policy={policy} collection={collection} index={index} />
      ))}
      customToggle={<SpacePolicyMenuToggle collection={collection} index={index} />}
    />
  );
}
