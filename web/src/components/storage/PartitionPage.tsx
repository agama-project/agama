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
import { useParams } from "react-router-dom";
import {
  Flex,
  Form,
  FormGroup,
  Stack,
  Split,
  SelectOptionProps,
  SelectList,
  SelectOption,
  SelectGroup,
  Divider,
  FlexItem,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { Page } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import SelectToggle, { SelectToggleOption } from "~/components/core/SelectToggle";
import { useDevices } from "~/queries/storage";
import { StorageDevice } from "~/types/storage";
import { baseName, deviceSize } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

const mountPointOptions: SelectOptionProps[] = [
  { value: "/", children: "/" },
  { value: "/home", children: "/home" },
  { value: "/var/log", children: "/var/log" },
  { value: "swap", children: "swap" },
];

function useDevice() {
  const { id } = useParams();
  const devices = useDevices("system", { suspense: true });
  return devices.find((d) => baseName(d.name) === id);
}

function targetOptionLabel(value: string, device: StorageDevice): string {
  if (value === "new") {
    return sprintf(_("Create new partition on %s"), device.name);
  } else {
    return sprintf(_("Use partition %s"), value);
  }
}

type PartitionDescriptionProps = {
  partition: StorageDevice;
};

function PartitionDescription({ partition }: PartitionDescriptionProps): React.ReactNode {
  return (
    <Split hasGutter>
      <span>{partition.description}</span>
      <span>{deviceSize(partition.size)}</span>
    </Split>
  );
}

function TargetOptions(): React.ReactElement {
  const device = useDevice();
  const partitions = device.partitionTable?.partitions || [];

  return (
    <SelectList>
      <SelectOption value="new">{targetOptionLabel("new", device)}</SelectOption>
      <Divider />
      <SelectGroup label={_("Use an existing partition")}>
        {partitions.map((partition, index) => (
          <SelectOption
            key={index}
            value={partition.name}
            description={<PartitionDescription partition={partition} />}
          >
            {partition.name}
          </SelectOption>
        ))}
        {partitions.length === 0 && (
          <SelectOption isDisabled>{_("There are not usable partitions")}</SelectOption>
        )}
      </SelectGroup>
    </SelectList>
  );
}

function filesystemOptions(mountPoint: string, target: string): SelectToggleOption[] {
  const options = [
    {
      value: "btrfsSnapshots",
      label: "Btrfs with snapshots",
      description: "Default file system for root",
    },
    { value: "btrfs", label: "Btrfs" },
    { value: "xfs", label: "XFS" },
    { value: "ext4", label: "EXT4" },
  ];

  const reuseOption = {
    value: "reuse",
    label: "XFS from /dev/vdc1",
    description: "Do not format the existing file system",
  };

  if (mountPoint === "") {
    return [
      {
        value: "",
        label: _("Waiting for a mount point"),
      },
    ];
  } else if (target !== "new") {
    return [reuseOption, ...options];
  } else {
    return options;
  }
}

function sizeOptions(mountPoint: string, target: string): SelectToggleOption[] {
  if (mountPoint === "") {
    return [
      {
        value: "",
        label: _("Waiting for a mount point"),
      },
    ];
  } else if (target !== "new") {
    return [
      {
        value: "",
        label: sprintf(_("Keep %s size"), target),
        description: _("10 GiB"),
      },
    ];
  } else {
    return [
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
  }
}

const customSizeOptions: SelectToggleOption[] = [
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
    value: _("range"),
    label: _("Allow growing until a limit"),
    description: _("The partition can grow until a max size"),
  },
];

function AutoSize() {
  return <p>{_("The size is auto calculated based on ...")}</p>;
}

function CustomSize({ value, onChange }) {
  const initialOption = () => {
    if (value.min === "") return "fixed";
    if (value.min === value.max) return "fixed";
    if (value.max === "") return "unlimited";
    return "range";
  };

  const [option, setOption] = React.useState(initialOption());

  const resetMaxSize = (option: string, min: string) => {
    if (option === "fixed") onChange({ max: min });
    if (option === "unlimited") onChange({ max: "" });
  };

  const changeMinSize = (v: string) => {
    onChange({ min: v });
    resetMaxSize(option, v);
  };

  const changeOption = (v: string) => {
    setOption(v);
    resetMaxSize(v, value.min);
  };

  return (
    <Flex>
      <FlexItem>
        <FormGroup fieldId="minSize" label={_("Minimum size")}>
          <TextInput id="minSizeValue" value={value.min} onChange={(_, v) => changeMinSize(v)} />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{_("Example: 5 GiB")}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <FormGroup fieldId="maxSize" label={_("Maximum size")}>
          <Flex>
            <FlexItem>
              <SelectToggle options={customSizeOptions} value={option} onChange={changeOption} />
            </FlexItem>
            {option === "range" && (
              <FlexItem>
                <TextInput
                  id="maxSizeValue"
                  value={value.max}
                  onChange={(_, v) => onChange({ max: v })}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{_("Example: 5 GiB")}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FlexItem>
            )}
          </Flex>
        </FormGroup>
      </FlexItem>
    </Flex>
  );
}

export default function PartitionPage() {
  const [mountPoint, setMountPoint] = React.useState<string>("");
  const [target, setTarget] = React.useState<string>("new");
  const [filesystem, setFilesystem] = React.useState<string>("");
  const [sizeOption, setSizeOption] = React.useState<string>("");
  const [minSize, setMinSize] = React.useState<string>("");
  const [maxSize, setMaxSize] = React.useState<string>("");
  const device = useDevice();

  const setSize = ({ min, max }) => {
    if (min !== undefined) setMinSize(min);
    if (max !== undefined) setMaxSize(max);
  };

  const resetFilesystem = (mountPoint: string, target: string) => {
    if (mountPoint === "") setFilesystem("");
    // TODO select default filesystem for the mount point
    if (mountPoint !== "" && target === "new") setFilesystem("btrfsSnapshots");
    // TODO only set "reuse" if the partition has a file system
    if (mountPoint !== "" && target !== "new") setFilesystem("reuse");
  };

  const resetSize = (mountPoint: string, target: string) => {
    if (mountPoint === "" || target !== "new") {
      setSizeOption("");
      setMinSize("");
      setMaxSize("");
    } else {
      // TODO set the default sizes for the mount point
      setSizeOption("auto");
    }
  };

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setMountPoint(value);
      resetFilesystem(value, target);
      resetSize(value, target);
    }
  };

  const changeTarget = (value: string) => {
    setTarget(value);
    resetFilesystem(mountPoint, value);
    resetSize(mountPoint, value);
  };

  console.log({ mountPoint, target, filesystem, sizeOption, minSize, maxSize });

  return (
    <Page id="partitionPage">
      <Page.Header>
        <h2>{sprintf(_("Define partition at %s"), device.name)}</h2>
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
                  <SelectToggle
                    value={target}
                    label={targetOptionLabel(target, device)}
                    onChange={changeTarget}
                  >
                    <TargetOptions />
                  </SelectToggle>
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
                options={filesystemOptions(mountPoint, target)}
                isDisabled={mountPoint === ""}
                value={filesystem}
                onChange={setFilesystem}
              />
            </FormGroup>
            <FormGroup fieldId="size" label={_("Size")}>
              <Stack hasGutter>
                <Flex>
                  <SelectToggle
                    options={sizeOptions(mountPoint, target)}
                    value={sizeOption}
                    onChange={setSizeOption}
                    isDisabled={mountPoint === ""}
                  />
                </Flex>
                {target === "new" && sizeOption === "auto" && <AutoSize />}
                {target === "new" && sizeOption === "custom" && (
                  <CustomSize value={{ min: minSize, max: maxSize }} onChange={setSize} />
                )}
              </Stack>
            </FormGroup>
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
