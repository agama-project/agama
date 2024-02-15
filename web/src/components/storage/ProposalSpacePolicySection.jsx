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
import { FormSelect, FormSelectOption, Radio } from "@patternfly/react-core";

import { _, n_, N_ } from "~/i18n";
import { deviceSize } from '~/components/storage/utils';
import { If, Section, SectionSkeleton } from "~/components/core";
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
    description: N_("The data is kept, but the current partitions will be resized as needed to make enough space.")
  },
  {
    name: "keep",
    label: N_("Use available space"),
    description: N_("The data is kept and existing partitions will not be modified. \
Only the space that is not assigned to any partition will be used.")
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
    const numPartitions = device.partitionTable.partitions.length;

    return (
      <>
        <div>
          {sprintf(n_("%d partition", "%d partitions", numPartitions), numPartitions)}
        </div>
        <div className="fs-small">
          {sprintf(_("%s partition table"), device.partitionTable.type.toUpperCase())}
        </div>
      </>
    );
  };

  const BlockContent = () => {
    const systems = device.systems;
    const filesystem = device.filesystem;

    const content = () => {
      if (systems.length > 0) return systems.join(", ");
      if (device.filesystem?.isEFI) return _("EFI");

      return _("Not identified");
    };

    return (
      <>
        <div>{content()}</div>
        <If
          condition={filesystem}
          then={
            <div className="fs-small">
              {sprintf(_("%s file system"), filesystem?.type)}
            </div>
          }
        />
      </>
    );
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
  const UnusedSize = () => {
    const used = device.partitionTable?.partitions.reduce((s, p) => s + p.size, 0) || 0;
    const unused = device.size - used;

    if (unused === 0) return null;

    return (
      <div className="fs-small">
        {sprintf(_("%s unused"), deviceSize(unused))}
      </div>
    );
  };

  const RecoverableSize = () => {
    const size = device.recoverableSize;
    let text;

    if (size === 0)
      text = _("No recoverable space");
    else
      text = sprintf(_("%s recoverable"), deviceSize(device.recoverableSize));

    return <div className="fs-small">{text}</div>;
  };

  return (
    <>
      <div>{deviceSize(device.size)}</div>
      <If condition={isDrive(device)} then={<UnusedSize />} else={<RecoverableSize /> } />
    </>
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

  return (
    <FormSelect
      value={action}
      isDisabled={isDisabled}
      onChange={changeAction}
      aria-label="Space action selector"
    >
      <FormSelectOption value="force_delete" label={_("Delete")} />
      <FormSelectOption value="resize" label={_("Allow resize")} />
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

  return (
    <TreeRowWrapper row={{ props: treeRow.props }}>
      <Td dataLabel={columnNames.device} treeRow={treeRow}>
        <DeviceDescriptionColumn device={device} />
      </Td>
      <Td dataLabel={columnNames.content} textCenter><DeviceContentColumn device={device} /></Td>
      <Td dataLabel={columnNames.size} textCenter><DeviceSizeColumn device={device} /></Td>
      <Td dataLabel={columnNames.action} textCenter>
        <If
          condition={!isDrive(device)}
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
          <Th textCenter>{columnNames.content}</Th>
          <Th textCenter>{columnNames.size}</Th>
          <Th textCenter>{columnNames.action}</Th>
        </Tr>
      </Thead>
      <Tbody>{renderRows()}</Tbody>
    </Table>
  );
};

/**
 * Space policy selector.
 * @component
 *
 * @param {object} props
 * @param {SpacePolicy} props.currentPolicy
 * @param {(policy: string) => void} [props.onChange]
 */
const SpacePolicySelector = ({ currentPolicy, onChange = noop }) => {
  return (
    <>
      <p>
        {_("Indicate how to make free space in the selected disks for allocating the file systems:")}
      </p>

      <div>
        <div className="split radio-group">
          {SPACE_POLICIES.map((policy) => {
            const isChecked = policy.name === currentPolicy.name;

            return (
              <Radio
                id={`space-policy-option-${policy.name}`}
                key={`space-policy-${policy.name}`}
                // eslint-disable-next-line agama-i18n/string-literals
                label={_(policy.label)}
                value={policy.name}
                name="space-policies"
                className={isChecked && "selected"}
                isChecked={isChecked}
                onChange={() => onChange(policy.name)}
              />
            );
          })}
        </div>

        <div aria-live="polite" className="highlighted-live-region">
          {currentPolicy.description}
        </div>
      </div>
    </>
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
            <SpacePolicySelector currentPolicy={currentPolicy} onChange={changeSpacePolicy} />
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
