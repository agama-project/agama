/*
 * Copyright (c) [2022-2024] SUSE LLC
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

// @ts-check

import React, { useState } from "react";
import {
  Dropdown, DropdownItem, DropdownList,
  List, ListItem,
  MenuToggle,
  Skeleton,
  Toolbar, ToolbarContent, ToolbarItem
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { If, Popup, RowActions, Tip } from '~/components/core';
import { VolumeForm } from '~/components/storage';
import VolumeLocationDialog from '~/components/storage/VolumeLocationDialog';
import { deviceSize, hasSnapshots, isTransactionalRoot } from '~/components/storage/utils';
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 */

/**
 * Generates an hint describing which attributes affect the auto-calculated limits.
 * If the limits are not affected then it returns `null`.
 * @function
 *
 * @param {object} volume - storage volume object
 * @returns {(React.ReactElement|null)} component to display (can be `null`)
 */
const AutoCalculatedHint = (volume) => {
  const { snapshotsAffectSizes = false, sizeRelevantVolumes = [], adjustByRam } = volume.outline;

  // no hint, the size is not affected by known criteria
  if (!snapshotsAffectSizes && !adjustByRam && sizeRelevantVolumes.length === 0) {
    return null;
  }

  return (
    <>
      {/* TRANSLATORS: header for a list of items referring to size limits for file systems */}
      {_("These limits are affected by:")}
      <List>
        {snapshotsAffectSizes &&
          // TRANSLATORS: list item, this affects the computed partition size limits
          <ListItem>{_("The configuration of snapshots")}</ListItem>}
        {sizeRelevantVolumes.length > 0 &&
          // TRANSLATORS: list item, this affects the computed partition size limits
          // %s is replaced by a list of the volumes (like "/home, /boot")
          <ListItem>{sprintf(_("Presence of other volumes (%s)"), sizeRelevantVolumes.join(", "))}</ListItem>}
        {adjustByRam &&
          // TRANSLATORS: list item, describes a factor that affects the computed size of a
          // file system; eg. adjusting the size of the swap
          <ListItem>{_("The amount of RAM in the system")}</ListItem>}
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

  const toggleActions = () => setIsOpen(!isOpen);

  const closeActions = () => setIsOpen(false);

  const Action = ({ children, ...props }) => (
    <DropdownItem component="button" {...props}>{children}</DropdownItem>
  );

  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onSelect={closeActions}
        popperProps={{ position: "right" }}
        toggle={(toggleRef) => (
          <MenuToggle ref={toggleRef} onClick={toggleActions} variant="primary">
            {/* TRANSLATORS: dropdown label */}
            {_("Actions")}
          </MenuToggle>
        )}
      >
        <DropdownList>
          <Action
            key="reset"
            onClick={onReset}
          >
            {/* TRANSLATORS: dropdown menu label */}
            {_("Reset to defaults")}
          </Action>
          <Action
            key="add"
            isDisabled={templates.length === 0}
            onClick={openForm}
          >
            {/* TRANSLATORS: dropdown menu label */}
            {_("Add file system")}
          </Action>
        </DropdownList>
      </Dropdown>
      <Popup aria-label={_("Add file system")} title={_("Add file system")} isOpen={isFormOpen}>
        <VolumeForm
          id="addVolumeForm"
          templates={templates}
          onSubmit={acceptForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="addVolumeForm" type="submit">{_("Accept")}</Popup.Confirm>
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
 * @param {object} [props.columns] - Column specs
 * @param {Volume} [props.volume] - Volume to show
 * @param {StorageDevice[]} [props.devices=[]] - Devices available for installation
 * @param {ProposalTarget} [props.target] - Installation target
 * @param {StorageDevice} [props.targetDevice] - Device selected for installation, if target is a disk
 * @param {boolean} props.isLoading - Whether to show the row as loading
 * @param {(volume: Volume) => void} [props.onEdit=noop] - Function to use for editing the volume
 * @param {(volume: Volume) => void} [props.onDelete=noop] - Function to use for deleting the volume
 */
const VolumeRow = ({
  columns,
  volume,
  devices,
  target,
  targetDevice,
  isLoading,
  onEdit = noop,
  onDelete = noop
}) => {
  /** @type {[string, (dialog: string) => void]} */
  const [dialog, setDialog] = useState();

  const openEditDialog = () => setDialog("edit");

  const openLocationDialog = () => setDialog("location");

  const closeDialog = () => setDialog(undefined);

  const acceptForm = (volume) => {
    closeDialog();
    onEdit(volume);
  };

  const isEditDialogOpen = dialog === "edit";
  const isLocationDialogOpen = dialog === "location";

  /**
   * @component
   * @param {object} props
   * @param {Volume} props.volume
   */
  const SizeLimits = ({ volume }) => {
    let targetSize;
    if (volume.target === "FILESYSTEM" || volume.target === "DEVICE")
      targetSize = volume.targetDevice.size;

    const minSize = deviceSize(targetSize || volume.minSize);
    const maxSize = targetSize ? deviceSize(targetSize) : volume.maxSize ? deviceSize(volume.maxSize) : undefined;
    const isAuto = volume.autoSize;

    let size = minSize;
    if (minSize && maxSize && minSize !== maxSize) size = `${minSize} - ${maxSize}`;
    // TRANSLATORS: minimum device size, %s is replaced by size string, e.g. "17.5 GiB"
    if (maxSize === undefined) size = sprintf(_("At least %s"), minSize);

    return (
      <div className="split">
        <span>{size}</span>
        {/* TRANSLATORS: device flag, the partition size is automatically computed */}
        <If condition={isAuto} then={<Tip description={AutoCalculatedHint(volume)}>{_("auto")}</Tip>} />
      </div>
    );
  };

  /**
   * @component
   * @param {object} props
   * @param {Volume} props.volume
   */
  const Details = ({ volume }) => {
    const snapshots = hasSnapshots(volume);
    const transactional = isTransactionalRoot(volume);

    if (volume.target === "FILESYSTEM")
      // TRANSLATORS: %s will be replaced by a file-system type like "Btrfs" or "Ext4"
      return sprintf(_("Reused %s"), volume.targetDevice?.filesystem?.type || "");
    if (transactional)
      return _("Transactional Btrfs");
    if (snapshots)
      return _("Btrfs with snapshots");

    return volume.fsType;
  };

  /**
   * @component
   * @param {object} props
   * @param {Volume} props.volume
   * @param {ProposalTarget} props.target
   */
  const Location = ({ volume, target }) => {
    if (volume.target === "NEW_PARTITION")
      // TRANSLATORS: %s will be replaced by a disk name (eg. "/dev/sda")
      return sprintf(_("Partition at %s"), volume.targetDevice?.name || "");
    if (volume.target === "NEW_VG")
      // TRANSLATORS: %s will be replaced by a disk name (eg. "/dev/sda")
      return sprintf(_("Separate LVM at %s"), volume.targetDevice?.name || "");
    if (volume.target === "DEVICE" || volume.target === "FILESYSTEM")
      return volume.targetDevice?.name || "";
    if (target === "NEW_LVM_VG")
      return _("Logical volume at system LVM");

    return _("Partition at installation disk");
  };

  /**
   * @component
   * @param {object} props
   * @param {Volume} props.volume
   * @param {() => void} props.onEditClick
   * @param {() => void} props.onLocationClick
   * @param {(volume: Volume) => void} props.onDeleteClick
   */
  const VolumeActions = ({ volume, onEditClick, onLocationClick, onDeleteClick }) => {
    const actions = () => {
      const actions = {
        delete: {
          title: _("Delete"),
          onClick: () => onDeleteClick(volume),
          isDanger: true
        },
        edit: {
          title: _("Edit"),
          onClick: onEditClick
        },
        location: {
          title: _("Change location"),
          onClick: onLocationClick
        }
      };

      if (!volume.outline.required) return Object.values(actions);

      return [actions.edit, actions.location];
    };

    return <RowActions id="volume_actions" actions={actions()} />;
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
        <Td dataLabel={columns.mountPath}>{volume.mountPath}</Td>
        <Td dataLabel={columns.details}><Details volume={volume} /></Td>
        <Td dataLabel={columns.size}><SizeLimits volume={volume} /></Td>
        <Td dataLabel={columns.location}><Location volume={volume} target={target} /></Td>
        <Td isActionCell>
          <VolumeActions
            volume={volume}
            onEditClick={openEditDialog}
            onLocationClick={openLocationDialog}
            onDeleteClick={onDelete}
          />
        </Td>
      </Tr>

      <Popup title={_("Edit file system")} isOpen={isEditDialogOpen}>
        <VolumeForm
          id="editVolumeForm"
          volume={volume}
          templates={[]}
          onSubmit={acceptForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="editVolumeForm" type="submit">{_("Accept")}</Popup.Confirm>
          <Popup.Cancel onClick={closeDialog} />
        </Popup.Actions>
      </Popup>

      <If
        condition={isLocationDialogOpen}
        then={
          <VolumeLocationDialog
            isOpen
            volume={volume}
            devices={devices}
            target={target}
            targetDevice={targetDevice}
            onAccept={acceptForm}
            onCancel={closeDialog}
          />
        }
      />
    </>
  );
};

/**
 * Renders a table with the information and actions of the volumes
 * @component
 *
 * @param {object} props
 * @param {object[]} props.volumes - Volumes to show
 * @param {StorageDevice[]} props.devices - Devices available for installation
 * @param {ProposalTarget} props.target - Installation target
 * @param {StorageDevice|undefined} props.targetDevice - Device selected for installation, if target is a disk
 * @param {boolean} props.isLoading - Whether to show the table as loading
 * @param {(volumes: Volume[]) => void} props.onVolumesChange - Function to submit changes in volumes
 */
const VolumesTable = ({ volumes, devices, target, targetDevice, isLoading, onVolumesChange }) => {
  const columns = {
    mountPath: _("Mount point"),
    details: _("Details"),
    size: _("Size"),
    // TRANSLATORS: where (and how) the file-system is going to be created
    location: _("Location"),
    actions: _("Actions")
  };

  const editVolume = (volume) => {
    const index = volumes.findIndex(v => v.mountPath === volume.mountPath);
    const newVolumes = [...volumes];
    newVolumes[index] = volume;
    onVolumesChange(newVolumes);
  };

  const deleteVolume = (volume) => {
    const newVolumes = volumes.filter(v => v.mountPath !== volume.mountPath);
    onVolumesChange(newVolumes);
  };

  const renderVolumes = () => {
    if (volumes.length === 0 && isLoading) return <VolumeRow isLoading />;

    return volumes.map((volume, index) => {
      return (
        <VolumeRow
          key={index}
          columns={columns}
          volume={volume}
          devices={devices}
          target={target}
          targetDevice={targetDevice}
          isLoading={isLoading}
          onEdit={editVolume}
          onDelete={deleteVolume}
        />
      );
    });
  };

  return (
    <Table aria-label={_("Table with mount points")} variant="compact" borders>
      <Thead>
        <Tr>
          <Th>{columns.mountPath}</Th>
          <Th>{columns.details}</Th>
          <Th>{columns.size}</Th>
          <Th>{columns.location}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {renderVolumes()}
      </Tbody>
    </Table>
  );
};

/**
 * @todo This component should be restructured to use the same approach as other newer components:
 *  * Create dialog components for the popup forms (e.g., EditVolumeDialog).
 *  * Use a TreeTable, specially if we need to represent subvolumes.
 *
 * Renders information of the volumes and actions to modify them
 * @component
 *
 * @typedef {object} ProposalVolumesProps
 * @property {Volume[]} volumes - Volumes to show
 * @property {Volume[]} templates - Templates to use for new volumes
 * @property {StorageDevice[]} devices - Devices available for installation
 * @property {ProposalTarget} target - Installation target
 * @property {StorageDevice|undefined} targetDevice - Device selected for installation, if target is a disk
 * @property {boolean} [isLoading=false] - Whether to show the content as loading
 * @property {(volumes: Volume[]) => void} onChange - Function to use for changing the volumes
 *
 * @param {ProposalVolumesProps} props
 */
export default function ProposalVolumes({
  volumes,
  templates,
  devices,
  target,
  targetDevice,
  isLoading = false,
  onChange = noop
}) {
  const addVolume = (volume) => onChange([...volumes, volume]);

  const resetVolumes = () => onChange([]);

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            {_("File systems to create")}
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignRight" }}>
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
        devices={devices}
        target={target}
        targetDevice={targetDevice}
        onVolumesChange={onChange}
        isLoading={isLoading}
      />
    </>
  );
}
