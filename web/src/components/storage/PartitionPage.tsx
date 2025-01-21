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
  // Radio,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { Page } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import SelectToggle, { SelectToggleOption } from "~/components/core/SelectToggle";
import { _ } from "~/i18n";

const mountPointOptions: SelectOptionProps[] = [
  { value: "/", children: "/" },
  { value: "/home", children: "/home" },
  { value: "/var/log", children: "/var/log" },
  { value: "swap", children: "swap" },
];

const targetOptions: SelectToggleOption[] = [
  { value: "new", label: _("as new partition on /dev/vdc") },
  { value: "/dev/vdc1", label: _("using partition /dev/vdc1"), description: _("XFS 10 GiB") },
];

const filesystemOptions: SelectToggleOption[] = [
  {
    value: "reuse",
    label: "XFS from /dev/vdc1",
    description: "Do not format the existing file system",
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

function CustomSize() {
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

  const isMaxDisabled = option !== "max";

  return (
    <Flex>
      <FormGroup fieldId="minSize" label={_("Minimum size")}>
        <FlexItem>
          <TextInput placeholder={_("Example: 5 GiB")} id="minSizeValue" />
        </FlexItem>
      </FormGroup>
      <FormGroup fieldId="maxSize" label={_("Maximum size")}>
        <Flex>
          <FlexItem>
            <SelectToggle options={options} value={option} onChange={setOption} />
          </FlexItem>
          <FlexItem>
            <TextInput
              placeholder={_("Example: 10 GiB")}
              id="maxSizeValue"
              isDisabled={isMaxDisabled}
            />
          </FlexItem>
        </Flex>
      </FormGroup>
    </Flex>
  );
}

function AutoSize() {
  return <p>{_("The size is auto calculated based on ...")}</p>;
}

function PartitionSize({ onChange, isDisabled, value }) {
  const options: SelectToggleOption[] = [
    {
      value: "auto",
      label: "Auto-calculated",
      description: _("A proper size is automatically calculated"),
    },
    {
      value: "custom",
      label: "Custom",
      description: _("Define a custom size between a minimum and a maximum"),
    },
  ];

  return (
    <FormGroup fieldId="size" label={_("Size")}>
      <Stack hasGutter>
        <SelectToggle options={options} isDisabled={isDisabled} value={value} onChange={onChange} />
        {value === "auto" && <AutoSize />}
        {value === "custom" && <CustomSize />}
      </Stack>
    </FormGroup>
  );
}

export default function PartitionPage() {
  const [sizeOption, setSizeOption] = React.useState<string>("auto");
  const [mountPoint, setMountPoint] = React.useState<string>("");
  const [target, setTarget] = React.useState<string>("new");
  const [filesystem, setFilesystem] = React.useState<string>("btrfs");

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setMountPoint(value);
      setFilesystem("btrfs");
    }
  };

  console.log("mountPoint:", mountPoint);
  console.log("target:", target);
  console.log("filesystem:", filesystem);

  const isDisabled = mountPoint === "";

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
                    createText={_("Add mount point")}
                    isStackable={false}
                    isCleanable
                    onChange={changeMountPoint}
                  />
                </FlexItem>
                <FlexItem>
                  <SelectToggle options={targetOptions} value={target} onChange={setTarget} />
                </FlexItem>
              </Flex>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{_("Select or enter a mount point")}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup fieldId="fileSystem" label={_("File system")}>
              <SelectToggle
                options={filesystemOptions}
                isDisabled={isDisabled}
                value={filesystem}
                onChange={setFilesystem}
              />
            </FormGroup>
            <PartitionSize value={sizeOption} onChange={setSizeOption} isDisabled={isDisabled} />
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
