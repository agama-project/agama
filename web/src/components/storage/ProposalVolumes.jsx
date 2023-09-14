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
  Dropdown, DropdownItem, DropdownList,
  List, ListItem,
  MenuToggle,
  Skeleton,
  Toolbar, ToolbarContent, ToolbarItem
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
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
  const { snapshotsAffectSizes = false, sizeRelevantVolumes = [] } = volume.outline;

  if (!snapshotsAffectSizes && sizeRelevantVolumes.length === 0) {
    return null;
  }

  return (
    <>
      {/* TRANSLATORS: header for a list of items */}
      {_("These limits are affected by:")}
      <List>
        {snapshotsAffectSizes &&
          // TRANSLATORS: list item, this affects the computed partition size limits
          <ListItem>{_("The configuration of snapshots")}</ListItem>}
        {sizeRelevantVolumes.length > 0 &&
          // TRANSLATORS: list item, this affects the computed partition size limits
          // %s is replaced by a list of the volumes (like "/home, /boot")
          <ListItem>{sprintf(_("Presence of other volumes (%s)"), sizeRelevantVolumes.join(", "))}</ListItem>}
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
          <MenuToggle ref={toggleRef} onClick={toggleActions}>
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
 * @param {object[]} props.columns - Column specs
 * @param {object} props.volume - Volume to show
 * @param {ProposalOptions} props.options - General proposal options
 * @param {boolean} props.isLoading - Whether to show the row as loading
 * @param {onDeleteFn} props.onDelete - Function to use for deleting the volume
 *
 * @callback onDeleteFn
 * @param {object} volume
 * @return {void}
 */
const VolumeRow = ({ columns, volume, options, isLoading, onEdit, onDelete }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (volume) => {
    closeForm();
    onEdit(volume);
  };

  const SizeLimits = ({ volume }) => {
    const minSize = deviceSize(volume.minSize);
    const maxSize = volume.maxSize ? deviceSize(volume.maxSize) : undefined;
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

  const Details = ({ volume, options }) => {
    const hasSnapshots = volume.fsType === "Btrfs" && volume.snapshots;

    // TRANSLATORS: the filesystem uses a logical volume (LVM)
    const text = `${volume.fsType} ${options.lvm ? _("logical volume") : _("partition")}`;
    const lockIcon = <Icon name="lock" size={12} />;
    const snapshotsIcon = <Icon name="add_a_photo" size={12} />;

    return (
      <div className="split">
        <span>{text}</span>
        {/* TRANSLATORS: filesystem flag, it uses an encryption */}
        <If condition={options.encryption} then={<Em icon={lockIcon}>{_("encrypted")}</Em>} />
        {/* TRANSLATORS: filesystem flag, it allows creating snapshots */}
        <If condition={hasSnapshots} then={<Em icon={snapshotsIcon}>{_("with snapshots")}</Em>} />
      </div>
    );
  };

  const VolumeActions = ({ volume, onEdit, onDelete }) => {
    const actions = () => {
      const actions = {
        delete: {
          title: _("Delete"),
          onClick: () => onDelete(volume),
          className: "danger-action"
        },
        edit: {
          title: _("Edit"),
          onClick: () => onEdit(volume)
        }
      };

      if (volume.outline.required)
        return [actions.edit];
      else
        return [actions.edit, actions.delete];
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
        <Td dataLabel={columns.mountPath}>{volume.mountPath}</Td>
        <Td dataLabel={columns.details}><Details volume={volume} options={options} /></Td>
        <Td dataLabel={columns.size}><SizeLimits volume={volume} /></Td>
        <Td isActionCell>
          <VolumeActions
            volume={volume}
            onEdit={openForm}
            onDelete={onDelete}
          />
        </Td>
      </Tr>

      <Popup title={_("Edit file system")} isOpen={isFormOpen}>
        <VolumeForm
          id="editVolumeForm"
          volume={volume}
          templates={[]}
          onSubmit={acceptForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="editVolumeForm" type="submit">{_("Accept")}</Popup.Confirm>
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
 * @param {ProposalOptions} props.options - General proposal options
 * @param {boolean} props.isLoading - Whether to show the table as loading
 * @param {onVolumesChangeFn} props.onVolumesChange - Function to submit changes in volumes
 *
 * @callback onVolumesChangeFn
 * @param {object[]} volumes
 * @return {void}
 */
const VolumesTable = ({ volumes, options, isLoading, onVolumesChange }) => {
  const columns = {
    mountPath: _("Mount point"),
    details: _("Details"),
    size: _("Size"),
    actions: _("Actions")
  };

  const VolumesContent = ({ volumes, options, isLoading, onVolumesChange }) => {
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

    if (volumes.length === 0 && isLoading) return <VolumeRow isLoading />;

    return volumes.map((volume, index) => {
      return (
        <VolumeRow
          key={`volume${index}`}
          id={index}
          columns={columns}
          volume={volume}
          options={options}
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
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <VolumesContent
          volumes={volumes}
          options={options}
          isLoading={isLoading}
          onVolumesChange={onVolumesChange}
        />
      </Tbody>
    </Table>
  );
};

/**
 * Renders information of the volumes and actions to modify them
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.volumes=[]] - Volumes to show
 * @param {object[]} [props.templates=[]] - Templates to use for new volumes
 * @param {ProposalOptions} [props.options={}] - General proposal options
 * @param {boolean} [props.isLoading=false] - Whether to show the content as loading
 * @param {onChangeFn} [props.onChange=noop] - Function to use for changing the volumes
 *
 * @typedef {object} ProposalOptions
 * @property {boolean} [lvm]
 * @property {boolean} [encryption]
 *
 * @callback onChangeFn
 * @param {object[]} volumes
 * @return {void}
 */
export default function ProposalVolumes({
  volumes = [],
  templates = [],
  options = {},
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
            {_("File systems to create in your system")}
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
        options={options}
        onVolumesChange={onChange}
        isLoading={isLoading}
      />
    </>
  );
}
