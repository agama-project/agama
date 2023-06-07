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

import React, { useState } from "react";
import {
  Dropdown, DropdownToggle, DropdownItem,
  List, ListItem,
  Skeleton,
  Toolbar, ToolbarContent, ToolbarItem
} from "@patternfly/react-core";
import { TableComposable, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

import { Em, If, Popup, RowActions, Tip } from '~/components/core';
import { Icon } from '~/components/layout';
import { VolumeForm } from '~/components/storage';
import { deviceSize } from '~/components/storage/utils';
import { noop } from "~/utils";

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
const VolumeRow = ({ columns, volume, isLoading, onEdit, onDelete }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (volume) => {
    closeForm();
    onEdit(volume);
  };

  const SizeLimits = ({ volume }) => {
    const limits = `${deviceSize(volume.minSize)} - ${deviceSize(volume.maxSize)}`;
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

  const VolumeActions = ({ volume, onEdit, onDelete }) => {
    const actions = () => {
      const actions = {
        delete: {
          title: "Delete",
          onClick: () => onDelete(volume),
          className: "danger-action"
        },
        edit: {
          title: "Edit",
          onClick: () => onEdit(volume)
        }
      };

      if (volume.optional)
        return [actions.edit, actions.delete];
      else
        return [actions.edit];
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
    <>
      <Tr>
        <Td dataLabel={columns.mountPoint}>{volume.mountPoint}</Td>
        <Td dataLabel={columns.details}><Details volume={volume} /></Td>
        <Td dataLabel={columns.size}><SizeLimits volume={volume} /></Td>
        <Td isActionCell>
          <VolumeActions
            volume={volume}
            onEdit={openForm}
            onDelete={onDelete}
          />
        </Td>
      </Tr>

      <Popup title="Edit file system" height="medium" isOpen={isFormOpen}>
        <VolumeForm
          id="editVolumeForm"
          volume={volume}
          templates={[]}
          onSubmit={acceptForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="editVolumeForm" type="submit">Accept</Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </>
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
    const editVolume = (volume) => {
      const index = volumes.findIndex(v => v.mountPoint === volume.mountPoint);
      const newVolumes = [...volumes];
      newVolumes[index] = volume;
      onVolumesChange(newVolumes);
    };

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
          onEdit={editVolume}
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
