/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import {
  Flex,
  Form,
  FormGroup,
  Stack,
  SelectOptionProps,
  FlexItem,
  Radio,
  TextInput,
} from "@patternfly/react-core";
import { Page } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import SelectToggle, { SelectToggleOption } from "~/components/core/SelectToggle";
import { _ } from "~/i18n";

const mountPointOptions: SelectOptionProps[] = [
  { value: "/", children: "root (/)" },
  { value: "/home", children: "/home" },
  { value: "/var/log", children: "/var/log" },
  { value: "swap", children: "swap" },
];

const targetOptions: SelectToggleOption[] = [
  { value: "new", label: _("Create as a new partition on /dev/vdc") },
  { value: "/dev/vdc1", label: _("Reuse partition /dev/vdc1"), description: _("XFS 10 GiB") },
];

const filesystemOptions: SelectToggleOption[] = [
  {
    value: "reuse",
    label: "Reuse file system from /dev/vdc1",
    description: "Do not format existing XFS file system",
  },
  {
    value: "btrfsSnapshots",
    label: "Btrfs with snapshots",
    description: "Default file system for root",
  },
  { value: "btrfs", label: "Btrfs" },
  { value: "xfs", label: "XFS" },
  { value: "ext4", label: "EXT4" },
];

function CustomSize({ isDisabled = false }) {
  const [option, setOption] = React.useState("fixed");

  const options = [
    {
      value: _("fixed"),
      label: _("Do not allow growing"),
      description: _("The partition is created exactly with the given size"),
    },
    {
      value: _("unlimited"),
      label: _("Allow growing as much as possible"),
      description: _("The partition can grow if there is free space"),
    },
    {
      value: _("max"),
      label: _("Allow growing until a maximum"),
      description: _("The partition can grow until a max size"),
    },
  ];

  return (
    <Flex>
      <FlexItem>
        <TextInput id="minSize" placeholder={_("E.g., 5 GiB")} isDisabled={isDisabled} />
      </FlexItem>
      <FlexItem>
        <SelectToggle
          options={options}
          value={option}
          onChange={setOption}
          isDisabled={isDisabled}
        />
      </FlexItem>
      {option === "max" && (
        <FlexItem>
          <TextInput id="maxSize" placeholder={_("Max limit")} isDisabled={isDisabled} />
        </FlexItem>
      )}
    </Flex>
  );
}

function PartitionSize({ option, onChange }) {
  return (
    <FormGroup role="radiogroup" fieldId="size" label={_("Size")}>
      <Stack hasGutter>
        <Radio
          name="defaultSize"
          id="defaultSize"
          value="default"
          isChecked={option === "default"}
          onChange={() => onChange("default")}
          label={_("Default")}
          body={_("The size is auto calculated ...")}
        />
        <Radio
          name="customSize"
          id="customSize"
          value="custom"
          isChecked={option === "custom"}
          onChange={() => onChange("custom")}
          label={_("Custom")}
          body={<CustomSize isDisabled={option !== "custom"} />}
        />
      </Stack>
    </FormGroup>
  );
}

export default function PartitionPage() {
  const [sizeOption, setSizeOption] = React.useState<string>("default");
  const [mountPoint, setMountPoint] = React.useState<string>("");

  console.log("mountPoint:", mountPoint);

  return (
    <Page id="partitionPage">
      <Page.Header>
        <h2>{_("Define partition at /dev/vdc")}</h2>
      </Page.Header>

      <Page.Content>
        <Form id="partitionForm" onSubmit={() => console.log("submit")}>
          <Stack hasGutter>
            <FormGroup fieldId="mountPoint" label={_("Mount point")}>
              <Flex>
                <FlexItem>
                  <SelectTypeaheadCreatable
                    value={mountPoint}
                    options={mountPointOptions}
                    placeholder={_("Select or create a mount point")}
                    createText={_("Create a new mount point")}
                    isStackable={false}
                    isCleanable
                    onChange={setMountPoint}
                  />
                </FlexItem>
                <FlexItem>
                  <SelectToggle options={targetOptions} />
                </FlexItem>
              </Flex>
            </FormGroup>
            <FormGroup fieldId="fileSystem" label={_("File system")}>
              <SelectToggle options={filesystemOptions} />
            </FormGroup>
            <PartitionSize option={sizeOption} onChange={setSizeOption} />
          </Stack>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
        <Page.Submit form="partitionForm" />
      </Page.Actions>
    </Page>
  );
}
