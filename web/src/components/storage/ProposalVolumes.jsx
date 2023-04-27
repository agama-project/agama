/*
 * Copyright (c) [2022-2023] SUSE LLC
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

// cspell:ignore filesize

import React, { useState } from "react";
import {
  Dropdown, DropdownToggle, DropdownItem,
  Form, FormGroup, FormSelect, FormSelectOption,
  List, ListItem,
  Skeleton,
  TextInput,
  Toolbar, ToolbarContent, ToolbarItem
} from "@patternfly/react-core";
import { TableComposable, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { filesize } from "filesize";

import { Em, If, Popup, RowActions, Tip } from '~/components/core';
import { Icon } from '~/components/layout';
import { noop } from "~/utils";

/**
 * Generates a disk size representation
 * @function
 *
 * @example
 * sizeText(1024)
 * // returns "1 kiB"
 *
 * sizeText(-1)
 * // returns "Unlimited"
 *
 * @param {number} size - Number of bytes. The value -1 represents an unlimited size.
 * @returns {string}
 */
const sizeText = (size) => {
  if (size === -1) return "Unlimited";

  return filesize(size, { base: 2 });
};

/**
 * Generates an hint describing which attributes affect the auto-calculated limits.
 * If the limits are not affected then it returns `null`.
 * @function
 *
 * @param {object} volume - storage volume object
 * @returns {(ReactComponent|null)} component to display (can be `null`)
 */
const AutoCalculatedHint = (volume) => {
  // no hint, the size is not affected by snapshots or other volumes
  if (!volume.snapshotsAffectSizes && volume.sizeRelevantVolumes && volume.sizeRelevantVolumes.length === 0) {
    return null;
  }

  return (
    <>
      These limits are affected by:
      <List>
        {volume.snapshotsAffectSizes &&
          <ListItem>The configuration of snapshots</ListItem>}
        {volume.sizeRelevantVolumes && volume.sizeRelevantVolumes.length > 0 &&
          <ListItem>Presence of other volumes ({volume.sizeRelevantVolumes.join(", ")})</ListItem>}
      </List>
    </>
  );
};

/**
 * Form used for adding a new file system from a list of templates
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID
 * @param {object[]} props.templates - Volume templates
 * @param {onSubmitFn} props.onSubmit - Function to use for submitting a new volume
 *
 * @callback onSubmitFn
 * @param {object} volume
 * @return {void}
 */
const VolumeForm = ({ id, templates, onSubmit }) => {
  const [volume, setVolume] = useState(templates[0]);

  const changeVolume = (mountPoint) => {
    const volume = templates.find(t => t.mountPoint === mountPoint);
    setVolume(volume);
  };

  const submitForm = (e) => {
    e.preventDefault();
    onSubmit(volume);
  };

  const volumeOptions = templates.map((template, index) => (
    <FormSelectOption key={index} value={template.mountPoint} label={template.mountPoint} />
  ));

  return (
    <Form id={id} onSubmit={submitForm}>
      <FormGroup fieldId="mountPoint" label="Mount point">
        <FormSelect
          id="mountPoint"
          aria-label="mount point"
          value={volume.mountPoint}
          onChange={changeVolume}
        >
          {volumeOptions}
        </FormSelect>
      </FormGroup>
      <FormGroup
        fieldId="fsType"
        label="File system type"
      >
        <TextInput
          id="fsType"
          name="fsType"
          aria-label="Fs type"
          value={volume.fsType}
          label="File system type"
          isDisabled
        />
      </FormGroup>
      <FormGroup
        fieldId="minSize"
        label="Minimum size"
      >
        <TextInput
          id="minSize"
          name="minSize"
          aria-label="Min size"
          value={sizeText(volume.minSize)}
          label="Minimum Size"
          isDisabled
        />
      </FormGroup>
      <FormGroup
        fieldId="maxSize"
        label="Maximum size"
      >
        <TextInput
          id="maxSize"
          name="maxSize"
          aria-label="Max size"
          value={sizeText(volume.maxSize)}
          label="Maximum Size"
          isDisabled
        />
      </FormGroup>
    </Form>
  );
};

/**
 * Button with general actions for the file systems
 * @component
 *
 * @param {object} props
 * @param {object[]} props.templates - Volume templates
 * @param {onAddFn} props.onAdd - Function to use for adding a new volume
 * @param {onResetFn} props.onReset - Function to use for resetting to the default subvolumes
 *
 * @callback onAddFn
 * @param {object} volume
 * @return {void}
 *
 * @callback onResetFn
 * @return {void}
 */
const GeneralActions = ({ templates, onAdd, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (volume) => {
    closeForm();
    onAdd(volume);
  };

  const toggleActions = (status) => setIsOpen(status);

  const closeActions = () => setIsOpen(false);

  const Action = ({ children, ...props }) => (
    <DropdownItem component="button" {...props}>{children}</DropdownItem>
  );

  return (
    <>
      <Dropdown
        position="right"
        isOpen={isOpen}
        onSelect={closeActions}
        dropdownItems={[
          <Action
            key="reset"
            onClick={onReset}
          >
            Reset to defaults
          </Action>,
          <Action
            key="add"
            isDisabled={templates.length === 0}
            onClick={openForm}
          >
            Add file system
          </Action>
        ]}
        toggle={
          <DropdownToggle toggleVariant="primary" onToggle={toggleActions}>
            Actions
          </DropdownToggle>
        }
      />
      <Popup aria-label="Add file system" title="Add file system" isOpen={isFormOpen}>
        <VolumeForm
          id="addVolumeForm"
          templates={templates}
          onSubmit={acceptForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="addVolumeForm" type="submit">Accept</Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </>
  );
};

/**
 * Renders a table row with the information and actions for a volume
 * @component
 *
 * @param {object} props
 * @param {object[]} props.columns - Column specs
 * @param {object} props.volume - Volume to show
 * @param {boolean} props.isLoading - Whether to show the row as loading
 * @param {onDeleteFn} props.onDelete - Function to use for deleting the volume
 *
 * @callback onDeleteFn
 * @param {object} volume
 * @return {void}
 */
const VolumeRow = ({ columns, volume, isLoading, onDelete }) => {
  const SizeLimits = ({ volume }) => {
    const limits = `${sizeText(volume.minSize)} - ${sizeText(volume.maxSize)}`;
    const isAuto = volume.adaptiveSizes && !volume.fixedSizeLimits;

    return (
      <div className="split">
        <span>{limits}</span>
        <If condition={isAuto} then={<Tip description={AutoCalculatedHint(volume)}>auto</Tip>} />
      </div>
    );
  };

  const Details = ({ volume }) => {
    const isLv = volume.deviceType === "lvm_lv";
    const hasSnapshots = volume.fsType === "Btrfs" && volume.snapshots;

    const text = `${volume.fsType} ${isLv ? "logical volume" : "partition"}`;
    const lockIcon = <Icon name="lock" size={12} />;
    const snapshotsIcon = <Icon name="add_a_photo" size={12} />;

    return (
      <div className="split">
        <span>{text}</span>
        <If condition={volume.encrypted} then={<Em icon={lockIcon}>encrypted</Em>} />
        <If condition={hasSnapshots} then={<Em icon={snapshotsIcon}>with snapshots</Em>} />
      </div>
    );
  };

  const VolumeActions = ({ volume, onDelete }) => {
    const actions = () => {
      const actions = {
        delete: {
          title: "Delete",
          onClick: () => onDelete(volume),
          className: "danger-action"
        }
      };

      if (volume.optional)
        return [actions.delete];
      else
        return [];
    };

    const currentActions = actions();

    if (currentActions.length === 0) return null;

    return <RowActions actions={currentActions} />;
  };

  if (isLoading) {
    return (
      <Tr>
        <Td colSpan={4}><Skeleton /></Td>
      </Tr>
    );
  }

  return (
    <Tr>
      <Td dataLabel={columns.mountPoint}>{volume.mountPoint}</Td>
      <Td dataLabel={columns.details}><Details volume={volume} /></Td>
      <Td dataLabel={columns.size}><SizeLimits volume={volume} /></Td>
      <Td isActionCell>
        <VolumeActions
          volume={volume}
          onDelete={onDelete}
        />
      </Td>
    </Tr>
  );
};

/**
 * Renders a table with the information and actions of the volumes
 * @component
 *
 * @param {object} props
 * @param {object[]} props.volumes - Volumes to show
 * @param {boolean} props.isLoading - Whether to show the table as loading
 * @param {onVolumesChangeFn} props.onVolumesChange - Function to submit changes in volumes
 *
 * @callback onVolumesChangeFn
 * @param {object[]} volumes
 * @return {void}
 */
const VolumesTable = ({ volumes, isLoading, onVolumesChange }) => {
  const columns = {
    mountPoint: "At",
    details: "Details",
    size: "Size limits",
    actions: "Actions"
  };

  const VolumesContent = ({ volumes, isLoading, onVolumesChange }) => {
    const deleteVolume = (volume) => {
      const newVolumes = volumes.filter(v => v.mountPoint !== volume.mountPoint);
      onVolumesChange(newVolumes);
    };

    if (volumes.length === 0 && isLoading) return <VolumeRow isLoading />;

    return volumes.map((volume, index) => {
      return (
        <VolumeRow
          key={`volume${index}`}
          id={index}
          columns={columns}
          volume={volume}
          isLoading={isLoading}
          onDelete={deleteVolume}
        />
      );
    });
  };

  return (
    <TableComposable aria-label="Simple table" variant="compact" borders>
      <Thead>
        <Tr>
          <Th>{columns.mountPoint}</Th>
          <Th>{columns.details}</Th>
          <Th>{columns.size}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <VolumesContent
          volumes={volumes}
          isLoading={isLoading}
          onVolumesChange={onVolumesChange}
        />
      </Tbody>
    </TableComposable>
  );
};

/**
 * Renders information of the volumes and actions to modify them
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.volumes=[]] - Volumes to show
 * @param {object[]} [props.templates=[]] - Templates to use for new volumes
 * @param {boolean} [props.isLoading=false] - Whether to show the content as loading
 * @param {onChangeFn} [props.onChange=noop] - Function to use for changing the volumes
 *
 * @callback onChangeFn
 * @param {object[]} volumes
 * @return {void}
 */
export default function ProposalVolumes({
  volumes = [],
  templates = [],
  isLoading = false,
  onChange = noop
}) {
  const addVolume = (volume) => {
    if (onChange === noop) return;
    const newVolumes = [...volumes, volume];
    onChange(newVolumes);
  };

  const resetVolumes = () => {
    if (onChange === noop) return;
    onChange([]);
  };

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            File systems to create in your system
          </ToolbarItem>
          <ToolbarItem alignment={{ default: "alignRight" }}>
            <GeneralActions
              templates={templates}
              onAdd={addVolume}
              onReset={resetVolumes}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      <VolumesTable
        volumes={volumes}
        onVolumesChange={onChange}
        isLoading={isLoading}
      />
    </>
  );
}
