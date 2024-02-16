/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useEffect } from "react";
import { FormSelect, FormSelectOption } from "@patternfly/react-core";

import { _, N_ } from "~/i18n";
import { deviceSize } from '~/components/storage/utils';
import { If, OptionsPicker, Section, SectionSkeleton } from "~/components/core";
import { noop, useLocalStorage } from "~/utils";
import { sprintf } from "sprintf-js";
import { Table, Thead, Tr, Th, Tbody, Td, TreeRowWrapper } from '@patternfly/react-table';

/**
 * @typedef {import ("~/client/storage").ProposalManager.ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").ProposalManager.SpaceAction} SpaceAction
 * @typedef {import ("~/client/storage").DevicesManager.StorageDevice} StorageDevice
 */

/**
 * @typedef SpacePolicy
 * @type {object}
 * @property {string} name
 * @property {string} label
 * @property {string} description
 */

/** @type {SpacePolicy[]} */
const SPACE_POLICIES = [
  {
    name: "delete",
    label: N_("Delete current content"),
    description: N_("All partitions will be removed and any data in the disks will be lost.")
  },
  {
    name: "resize",
    label: N_("Shrink existing partitions"),
    description: N_("The data is kept, but the current partitions will be resized as needed.")
  },
  {
    name: "keep",
    label: N_("Use available space"),
    description: N_("Existing partitions and data will not be modified. Only the space not assigned to any partition will be used.")
  },
  {
    name: "custom",
    label: N_("Custom"),
    description: N_("Select what to do with each partition.")
  }
];

// Names of the columns for the policy actions.
const columnNames = {
  device: N_("Used device"),
  content: N_("Current content"),
  size: N_("Size"),
  details: N_("Details"),
  action: N_("Action")
};

/**
 * Indicates whether a device is a drive (disk, RAID).
 * @function
 *
 * @param {StorageDevice} device
 * @returns {boolean}
 */
const isDrive = (device) => Object.keys(device).includes("vendor");

/**
 * Column content with the description of a device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceDescriptionColumn = ({ device }) => {
  return (
    <>
      <div>{device.name}</div>
      <If
        condition={isDrive(device)}
        then={<div className="fs-small">{`${device.vendor} ${device.model}`}</div>}
      />
    </>
  );
};

/**
 * Column content with information about the current content of the device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceContentColumn = ({ device }) => {
  const PartitionTableContent = () => {
    return (
      <div>
        {sprintf(_("%s partition table"), device.partitionTable.type.toUpperCase())}
      </div>
    );
  };

  const BlockContent = () => {
    const content = () => {
      const systems = device.systems;
      if (systems.length > 0) return systems.join(", ");

      const filesystem = device.filesystem;
      if (filesystem?.isEFI) return _("EFI");
      if (filesystem) return sprintf(_("%s file system"), filesystem?.type);

      const component = device.component;
      switch (component?.type) {
        case "physical_volume":
          return sprintf(_("LVM physical volume of %s"), component.deviceNames[0]);
        case "md_device":
          return sprintf(_("Member of RAID %s"), component.deviceNames[0]);
        default:
          return _("Not identified");
      }
    };

    return <div>{content()}</div>;
  };

  return (device.partitionTable ? <PartitionTableContent /> : <BlockContent />);
};

/**
 * Column content with information about the size of the device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceSizeColumn = ({ device }) => {
  return <div>{deviceSize(device.size)}</div>;
};

const DeviceDetailsColumn = ({ device }) => {
  const UnusedSize = () => {
    const partitioned = device.partitionTable?.partitions.reduce((s, p) => s + p.size, 0) || 0;

    if (device.filesystem) return null;

    const unused = device.size - partitioned;

    return (
      <div>
        {sprintf(_("%s unused"), deviceSize(unused))}
      </div>
    );
  };

  const RecoverableSize = () => {
    const size = device.recoverableSize;

    if (size === 0) return null;

    return (
      <div>
        {sprintf(_("Shrinkable by %s"), deviceSize(device.recoverableSize))}
      </div>
    );
  };

  return (
    <If condition={isDrive(device)} then={<UnusedSize />} else={<RecoverableSize /> } />
  );
};

/**
 * Column content with the space action for a device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 * @param {string} props.action - Possible values: "force_delete", "resize" or "keep".
 * @param {boolean} [props.isDisabled=false]
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceActionColumn = ({ device, action, isDisabled = false, onChange = noop }) => {
  const changeAction = (_, action) => onChange({ device: device.name, action });

  const value = (isDrive(device) && action === "resize") ? "keep" : action;

  return (
    <FormSelect
      value={value}
      isDisabled={isDisabled}
      onChange={changeAction}
      aria-label="Space action selector"
    >
      <FormSelectOption value="force_delete" label={_("Delete")} />
      <If
        condition={!isDrive(device)}
        then={<FormSelectOption value="resize" label={_("Allow resize")} />}
      />
      <FormSelectOption value="keep" label={_("Do not modify")} />
    </FormSelect>
  );
};

/**
 * Row for configuring the space action of a device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 * @param {ProposalSettings} props.settings
 * @param {number} props.rowIndex - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {number} [props.level=1] - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {number} [props.setSize=0] - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {number} [props.posInSet=0] - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {boolean} [props.isExpanded=false] - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {boolean} [props.isHidden=false] - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {function} [props.onCollapse] - @see {@link https://www.patternfly.org/components/table/#tree-table}
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceRow = ({
  device,
  settings,
  rowIndex,
  level = 1,
  setSize = 0,
  posInSet = 1,
  isExpanded = false,
  isHidden = false,
  onCollapse = noop,
  onChange = noop
}) => {
  const treeRow = {
    onCollapse,
    rowIndex,
    props: {
      isExpanded,
      isHidden,
      'aria-level': level,
      'aria-posinset': posInSet,
      'aria-setsize': setSize
    }
  };

  const spaceAction = settings.spaceActions.find(a => a.device === device.name);
  const isDisabled = settings.spacePolicy !== "custom";
  const showAction = !device.partitionTable;

  return (
    <TreeRowWrapper row={{ props: treeRow.props }}>
      <Td dataLabel={columnNames.device} treeRow={treeRow}>
        <DeviceDescriptionColumn device={device} />
      </Td>
      <Td dataLabel={columnNames.content}><DeviceContentColumn device={device} /></Td>
      <Td dataLabel={columnNames.size}><DeviceSizeColumn device={device} /></Td>
      <Td dataLabel={columnNames.details}><DeviceDetailsColumn device={device} /></Td>
      <Td dataLabel={columnNames.action} textCenter>
        <If
          condition={showAction}
          then={
            <DeviceActionColumn
              device={device}
              action={spaceAction?.action || "keep"}
              isDisabled={isDisabled}
              onChange={onChange}
            />
          }
        />
      </Td>
    </TreeRowWrapper>
  );
};

/**
 * Table for configuring the space actions.
 * @component
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const SpaceActionsTable = ({ settings, onChange = noop }) => {
  const [expandedDevices, setExpandedDevices] = useLocalStorage("storage-space-actions-expanded", []);
  const [autoExpanded, setAutoExpanded] = useLocalStorage("storage-space-actions-auto-expanded", false);

  useEffect(() => {
    const policy = settings.spacePolicy;
    const devices = settings.installationDevices.map(d => d.name);
    let currentExpanded = devices.filter(d => expandedDevices.includes(d));

    if (policy === "custom" && !autoExpanded) {
      currentExpanded = [...devices];
      setAutoExpanded(true);
    } else if (policy !== "custom" && autoExpanded) {
      setAutoExpanded(false);
    }

    if (currentExpanded.sort().toString() !== expandedDevices.sort().toString()) {
      setExpandedDevices(currentExpanded);
    }
  }, [autoExpanded, expandedDevices, setAutoExpanded, setExpandedDevices, settings]);

  const renderRows = () => {
    const rows = [];

    settings.installationDevices?.forEach((device, index) => {
      const isExpanded = expandedDevices.includes(device.name);
      const children = device.partitionTable?.partitions;

      const onCollapse = () => {
        const otherExpandedDevices = expandedDevices.filter(name => name !== device.name);
        const expanded = isExpanded ? otherExpandedDevices : [...otherExpandedDevices, device.name];
        setExpandedDevices(expanded);
      };

      rows.push(
        <DeviceRow
          key={device.name}
          device={device}
          settings={settings}
          rowIndex={rows.length}
          setSize={children?.length || 0}
          posInSet={index}
          isExpanded={isExpanded}
          onCollapse={onCollapse}
          onChange={onChange}
        />
      );

      children?.forEach((child, index) => {
        rows.push(
          <DeviceRow
            key={child.name}
            device={child}
            settings={settings}
            rowIndex={rows.length}
            level={2}
            posInSet={index}
            isHidden={!isExpanded}
            onCollapse={onCollapse}
            onChange={onChange}
          />
        );
      });
    });

    return rows;
  };

  return (
    <Table isTreeTable variant="compact" aria-label={_("Actions to find space")}>
      <Thead>
        <Tr>
          <Th>{columnNames.device}</Th>
          <Th>{columnNames.content}</Th>
          <Th>{columnNames.size}</Th>
          <Th>{columnNames.details}</Th>
          <Th textCenter>{columnNames.action}</Th>
        </Tr>
      </Thead>
      <Tbody>{renderRows()}</Tbody>
    </Table>
  );
};

/**
 * Widget to allow user picking desired policy to make space
 * @component
 *
 * @param {object} props
 * @param {SpacePolicy} props.currentPolicy
 * @param {(policy: string) => void} [props.onChange]
 */
const SpacePolicyPicker = ({ currentPolicy, onChange = noop }) => {
  return (
    <OptionsPicker>
      {SPACE_POLICIES.map((policy) => {
        return (
          <OptionsPicker.Option
            key={policy.name}
            title={policy.label}
            body={policy.description}
            onClick={() => onChange(policy.name)}
            isSelected={currentPolicy?.name === policy.name}
          />
        );
      })}
    </OptionsPicker>
  );
};

/**
 * Section for configuring the space policy.
 * @component
 *
 * @param {ProposalSettings} settings
 * @param {boolean} [isLoading=false]
 * @param {(settings: ProposalSettings) => void} [onChange]
 */
export default function ProposalSpacePolicySection({
  settings,
  isLoading = false,
  onChange = noop
}) {
  const changeSpacePolicy = (policy) => {
    onChange({ spacePolicy: policy });
  };

  const changeSpaceActions = (spaceAction) => {
    const spaceActions = settings.spaceActions.filter(a => a.device !== spaceAction.device);
    if (spaceAction.action !== "keep") spaceActions.push(spaceAction);

    onChange({ spaceActions });
  };

  const currentPolicy = SPACE_POLICIES.find(p => p.name === settings.spacePolicy) || SPACE_POLICIES[0];

  return (
    <Section title={_("Find Space")} className="flex-stack">

      <If
        condition={isLoading && settings.spacePolicy === undefined}
        then={<SectionSkeleton numRows={4} />}
        else={
          <>
            <p>
              {_("Indicate how to make free space in the selected disks for allocating the file systems:")}
            </p>
            <SpacePolicyPicker currentPolicy={currentPolicy} onChange={changeSpacePolicy} />
            <If
              condition={settings.installationDevices?.length > 0}
              then={<SpaceActionsTable settings={settings} onChange={changeSpaceActions} />}
            />
          </>
        }
      />
    </Section>
  );
}
