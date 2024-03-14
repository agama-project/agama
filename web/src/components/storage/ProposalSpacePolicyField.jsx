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

import React, { useEffect, useState } from "react";
import { Button, Form, FormSelect, FormSelectOption, Skeleton } from "@patternfly/react-core";

import { _, N_, n_ } from "~/i18n";
import { deviceSize } from '~/components/storage/utils';
import { If, OptionsPicker, Popup, SectionSkeleton } from "~/components/core";
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
 * @property {string} id
 * @property {string} label
 * @property {string} description
 */

/** @type {SpacePolicy[]} */
const SPACE_POLICIES = [
  {
    id: "delete",
    label: N_("Delete current content"),
    description: N_("All partitions will be removed and any data in the disks will be lost."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space deleting all content[...]"
      N_("deleting all content of the installation device"),
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space deleting all content[...]"
      N_("deleting all content of the %d selected disks")
    ]
  },
  {
    id: "resize",
    label: N_("Shrink existing partitions"),
    description: N_("The data is kept, but the current partitions will be resized as needed."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space shrinking partitions[...]"
      N_("shrinking partitions of the installation device"),
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space shrinking partitions[...]"
      N_("shrinking partitions of the %d selected disks")
    ]
  },
  {
    id: "keep",
    label: N_("Use available space"),
    description: N_("The data is kept. Only the space not assigned to any partition will be used."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space without modifying any partition".
      N_("without modifying any partition")
    ]
  },
  {
    id: "custom",
    label: N_("Custom"),
    description: N_("Select what to do with each partition."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space performing a custom set of actions".
      N_("performing a custom set of actions")
    ]
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
        condition={device.isDrive}
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
        {/* TRANSLATORS: %s is replaced by partition table type (e.g., GPT) */}
        {sprintf(_("%s partition table"), device.partitionTable.type.toUpperCase())}
      </div>
    );
  };

  const BlockContent = () => {
    const renderContent = () => {
      const systems = device.systems;
      if (systems.length > 0) return systems.join(", ");

      const filesystem = device.filesystem;
      if (filesystem?.isEFI) return _("EFI system partition");
      if (filesystem) {
        // TRANSLATORS: %s is replaced by a file system type (e.g., btrfs).
        return sprintf(_("%s file system"), filesystem?.type);
      }

      const component = device.component;
      switch (component?.type) {
        case "physical_volume":
          // TRANSLATORS: %s is replaced by a LVM volume group name (e.g., /dev/vg0).
          return sprintf(_("LVM physical volume of %s"), component.deviceNames[0]);
        case "md_device":
          // TRANSLATORS: %s is replaced by a RAID name (e.g., /dev/md0).
          return sprintf(_("Member of RAID %s"), component.deviceNames[0]);
        default:
          return _("Not identified");
      }
    };

    return <div>{renderContent()}</div>;
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

/**
 * Column content with details about the device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceDetailsColumn = ({ device }) => {
  const UnusedSize = () => {
    if (device.filesystem) return null;

    const unused = device.partitionTable?.unpartitionedSize || 0;

    return (
      <div>
        {/* TRANSLATORS: %s is replaced by a disk size (e.g., 20 GiB) */}
        {sprintf(_("%s unused"), deviceSize(unused))}
      </div>
    );
  };

  const RecoverableSize = () => {
    const size = device.recoverableSize;

    if (size === 0) return null;

    return (
      <div>
        {/* TRANSLATORS: %s is replaced by a disk size (e.g., 2 GiB) */}
        {sprintf(_("Shrinkable by %s"), deviceSize(device.recoverableSize))}
      </div>
    );
  };

  return (
    <If condition={device.isDrive} then={<UnusedSize />} else={<RecoverableSize />} />
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

  // For a drive device (e.g., Disk, RAID) it does not make sense to offer the resize action.
  // At this moment, the Agama backend generates a resize action for drives if the policy is set to
  // 'resize'. In that cases, the action is converted here to 'keep'.
  const value = (device.isDrive && action === "resize") ? "keep" : action;

  return (
    <FormSelect
      value={value}
      isDisabled={isDisabled}
      onChange={changeAction}
      aria-label={
        /* TRANSLATORS: %s is replaced by a device name (e.g., /dev/sda) */
        sprintf(_("Space action selector for %s"), device.name)
      }
    >
      <FormSelectOption value="force_delete" label={_("Delete")} />
      {/* Resize action does not make sense for drives, so it is filtered out. */}
      <If
        condition={!device.isDrive}
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
  policy,
  actions,
  rowIndex,
  level = 1,
  setSize = 0,
  posInSet = 1,
  isExpanded = false,
  isHidden = false,
  onCollapse = noop,
  onChange = noop
}) => {
  // Generates the action value according to the policy.
  const action = () => {
    if (policy.id === "custom")
      return actions.find(a => a.device === device.name)?.action || "keep";

    const policyAction = { delete: "force_delete", resize: "resize", keep: "keep" };
    return policyAction[policy.id];
  };

  const isDisabled = policy.id !== "custom";
  const showAction = !device.partitionTable;

  const treeRow = {
    onCollapse,
    rowIndex,
    props: {
      isExpanded,
      isDetailsExpanded: true,
      isHidden,
      'aria-level': level,
      'aria-posinset': posInSet,
      'aria-setsize': setSize
    }
  };

  return (
    <TreeRowWrapper row={{ props: treeRow.props }}>
      {/* eslint-disable agama-i18n/string-literals */}
      <Td dataLabel={_(columnNames.device)} treeRow={treeRow}>
        <DeviceDescriptionColumn device={device} />
      </Td>
      <Td dataLabel={_(columnNames.content)}><DeviceContentColumn device={device} /></Td>
      <Td dataLabel={_(columnNames.size)}><DeviceSizeColumn device={device} /></Td>
      <Td dataLabel={_(columnNames.details)}><DeviceDetailsColumn device={device} /></Td>
      <Td dataLabel={_(columnNames.action)}>
        <If
          condition={showAction}
          then={
            <DeviceActionColumn
              device={device}
              action={action()}
              isDisabled={isDisabled}
              onChange={onChange}
            />
          }
        />
      </Td>
      {/* eslint-enable agama-i18n/string-literals */}
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
const SpaceActionsTable = ({ policy, actions, devices, onChange = noop }) => {
  const [expandedDevices, setExpandedDevices] = useLocalStorage("storage-space-actions-expanded", []);
  const [autoExpanded, setAutoExpanded] = useLocalStorage("storage-space-actions-auto-expanded", false);

  useEffect(() => {
    const devNames = devices.map(d => d.name);
    let currentExpanded = devNames.filter(d => expandedDevices.includes(d));

    if (policy.id === "custom" && !autoExpanded) {
      currentExpanded = [...devNames];
      setAutoExpanded(true);
    } else if (policy.id !== "custom" && autoExpanded) {
      setAutoExpanded(false);
    }

    if (currentExpanded.sort().toString() !== expandedDevices.sort().toString()) {
      setExpandedDevices(currentExpanded);
    }
  }, [autoExpanded, expandedDevices, setAutoExpanded, setExpandedDevices, policy, devices]);

  const renderRows = () => {
    const rows = [];

    devices?.forEach((device, index) => {
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
          policy={policy}
          actions={actions}
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
            policy={policy}
            actions={actions}
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
          <Th>{columnNames.action}</Th>
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
      {/* eslint-disable agama-i18n/string-literals */}
      {SPACE_POLICIES.map((policy) => {
        return (
          <OptionsPicker.Option
            key={policy.id}
            title={_(policy.label)}
            body={_(policy.description)}
            onClick={() => onChange(policy)}
            isSelected={currentPolicy?.id === policy.id}
          />
        );
      })}
      {/* eslint-enable agama-i18n/string-literals */}
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
const SpacePolicyForm = ({
  id,
  currentPolicy,
  currentActions,
  devices,
  isLoading = false,
  onSubmit = noop
}) => {
  const [policy, setPolicy] = useState(currentPolicy);
  const [actions, setActions] = useState(currentActions);
  const [customUsed, setCustomUsed] = useState(false);

  // The selectors for the space action have to be initialized always to the same value
  // (e.g., "keep") when the custom policy is selected for first time. The following two useEffect
  // ensures that.

  // Stores whether the custom policy has been used.
  useEffect(() => {
    if (policy.id === "custom" && !customUsed) setCustomUsed(true);
  }, [policy, customUsed, setCustomUsed]);

  // Resets actions (i.e., sets everything to "keep") if the custom policy has not been used yet.
  useEffect(() => {
    if (policy.id !== "custom" && !customUsed) setActions([]);
  }, [policy, customUsed, setActions]);

  const changeActions = (spaceAction) => {
    const spaceActions = actions.filter(a => a.device !== spaceAction.device);
    if (spaceAction.action !== "keep") spaceActions.push(spaceAction);

    setActions(spaceActions);
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (policy !== undefined) onSubmit(policy, actions);
  };

  return (
    <Form id={id} onSubmit={submitForm}>
      <If
        condition={isLoading && policy === undefined}
        then={<SectionSkeleton numRows={4} />}
        else={
          <>
            <SpacePolicyPicker currentPolicy={policy} onChange={setPolicy} />
            <If
              condition={devices.length > 0}
              then={
                <SpaceActionsTable
                  policy={policy}
                  actions={actions}
                  devices={devices}
                  onChange={changeActions}
                />
              }
            />
          </>
        }
      />
    </Form>
  );
};

const SpacePolicyButton = ({ policy, devices, onClick = noop }) => {
  const Text = () => {
    // eslint-disable-next-line agama-i18n/string-literals
    if (policy.summaryLabels.length === 1) return _(policy.summaryLabels[0]);

    // eslint-disable-next-line agama-i18n/string-literals
    return sprintf(n_(policy.summaryLabels[0], policy.summaryLabels[1], devices.length), devices.length);
  };

  return <Button variant="link" isInline onClick={onClick}><Text /></Button>;
};

export default function ProposalSpacePolicyField({
  policy,
  actions = [],
  devices = [],
  isLoading = false,
  onChange = noop
}) {
  const spacePolicy = SPACE_POLICIES.find(p => p.id === policy) || SPACE_POLICIES[0];
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (spacePolicy, actions) => {
    closeForm();
    onChange(spacePolicy.id, actions);
  };

  if (isLoading) {
    return <Skeleton screenreaderText={_("Waiting for information about how to find space")} width="25%" />;
  }

  const description = _("Allocating the file systems might need to find free space \
in the devices listed below. Choose how to do it.");

  return (
    <div className="split">
      {/* TRANSLATORS: To be completed with the rest of a sentence like "deleting all content" */}
      <span>{_("Find space")}</span>
      <SpacePolicyButton policy={spacePolicy} devices={devices} onClick={openForm} />
      <Popup
        variant="large"
        description={description}
        title={_("Find Space")}
        isOpen={isFormOpen}
      >
        <div className="stack">
          <SpacePolicyForm
            id="spacePolicyForm"
            currentPolicy={spacePolicy}
            currentActions={actions}
            devices={devices}
            onSubmit={acceptForm}
          />
        </div>
        <Popup.Actions>
          <Popup.Confirm
            form="spacePolicyForm"
            type="submit"
          >
            {_("Accept")}
          </Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </div>
  );
}
