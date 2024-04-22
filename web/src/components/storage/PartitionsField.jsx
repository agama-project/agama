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
  Button, Dropdown, DropdownList, DropdownItem, List, ListItem, MenuToggle, Skeleton
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { If, ExpandableField, RowActions, Tip } from '~/components/core';
import VolumeDialog from '~/components/storage/VolumeDialog';
import VolumeLocationDialog from '~/components/storage/VolumeLocationDialog';
import {
  deviceSize, hasSnapshots, isTransactionalRoot, isTransactionalSystem
} from '~/components/storage/utils';
import SnapshotsField from "~/components/storage/SnapshotsField";
import BootConfigField from "~/components/storage/BootConfigField";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("~/components/storage/SnapshotsField").SnapshotsConfig} SnapshotsConfig
 *
 * @typedef {import ("~/client/storage").Volume} Volume
 */

/**
 * @component
 *
 * @param {object} props
 * @param {Volume} props.volume
 */
const SizeText = ({ volume }) => {
  let targetSize;
  if (volume.target === "FILESYSTEM" || volume.target === "DEVICE")
    targetSize = volume.targetDevice.size;

  const minSize = deviceSize(targetSize || volume.minSize);
  const maxSize = targetSize ? deviceSize(targetSize) : volume.maxSize ? deviceSize(volume.maxSize) : undefined;

  if (minSize && maxSize && minSize !== maxSize) return `${minSize} - ${maxSize}`;
  // TRANSLATORS: minimum device size, %s is replaced by size string, e.g. "17.5 GiB"
  if (maxSize === undefined) return sprintf(_("at least %s"), minSize);

  return `${minSize}`;
};

/**
 * @component
 *
 * @param {object} props
 * @param {Volume} props.volume
 * @param {ProposalTarget} props.target
 */
const BasicVolumeText = ({ volume, target }) => {
  const snapshots = hasSnapshots(volume);
  const transactional = isTransactionalRoot(volume);
  const size = SizeText({ volume });
  const lvm = (target === "NEW_LVM_VG");
  // When target is "filesystem" or "device" this is irrelevant since the type of device
  // is not mentioned
  const lv = volume.target === "NEW_VG" || (volume.target === "DEFAULT" && lvm);

  if (transactional)
    return (lv)
      // TRANSLATORS: "/" is in an LVM logical volume. %s replaced by size string, e.g. "17.5 GiB"
      ? sprintf(_("Transactional Btrfs root volume (%s)"), size)
      // TRANSLATORS: %s replaced by size string, e.g. "17.5 GiB"
      : sprintf(_("Transactional Btrfs root partition (%s)"), size);

  if (snapshots)
    return (lv)
      // TRANSLATORS: "/" is in an LVM logical volume. %s replaced by size string, e.g. "17.5 GiB"
      ? sprintf(_("Btrfs root volume with snapshots (%s)"), size)
      // TRANSLATORS: %s replaced by size string, e.g. "17.5 GiB"
      : sprintf(_("Btrfs root partition with snapshots (%s)"), size);

  const volTarget = volume.target;
  const mount = volume.mountPath;
  const device = volume.targetDevice?.name;

  if (volTarget === "FILESYSTEM")
    // TRANSLATORS: This results in something like "Mount /dev/sda3 at /home (25 GiB)" since
    // %1$s is replaced by the device name, %2$s by the mount point and %3$s by the size
    return sprintf(_("Mount %1$s at %2$s (%3$s)"), device, mount, size);

  if (mount === "swap") {
    if (volTarget === "DEVICE")
      // TRANSLATORS: This results in something like "Swap at /dev/sda3 (2 GiB)" since
      // %1$s is replaced by the device name, and %2$s by the size
      return sprintf(_("Swap at %1$s (%2$s)"), device, size);

    return (lv)
      // TRANSLATORS: Swap is in an LVM logical volume. %s replaced by size string, e.g. "8 GiB"
      ? sprintf(_("Swap volume (%s)"), size)
      // TRANSLATORS: %s replaced by size string, e.g. "8 GiB"
      : sprintf(_("Swap partition (%s)"), size);
  }

  const type = volume.fsType;

  if (mount === "/") {
    if (volTarget === "DEVICE")
      // TRANSLATORS: This results in something like "Btrfs root at /dev/sda3 (20 GiB)" since
      // %1$s is replaced by the filesystem type, %2$s by the device name, and %3$s by the size
      return sprintf(_("%1$s root at %2$s (%3$s)"), type, device, size);

    return (lv)
      // TRANSLATORS: "/" is in an LVM logical volume.
      // Results in something like "Btrfs root volume (at least 20 GiB)" since
      // $1$s is replaced by filesystem type and %2$s by size description
      ? sprintf(_("%1$s root volume (%2$s)"), type, size)
      // TRANSLATORS: Results in something like "Btrfs root partition (at least 20 GiB)" since
      // $1$s is replaced by filesystem type and %2$s by size description
      : sprintf(_("%1$s root partition (%2$s)"), type, size);
  }

  if (volTarget === "DEVICE")
    // TRANSLATORS: This results in something like "Ext4 /home at /dev/sda3 (20 GiB)" since
    // %1$s is replaced by filesystem type, %2$s by mount point, %3$s by device name and %4$s by size
    return sprintf(_("%1$s %2$s at %3$s (%4$s)"), type, mount, device, size);

  return (lv)
    // TRANSLATORS: The filesystem is in an LVM logical volume.
    // Results in something like "Ext4 /home volume (at least 10 GiB)" since
    // %1$s is replaced by the filesystem type, %2$s by the mount point and %3$s by the size description
    ? sprintf(_("%1$s %2$s volume (%3$s)"), type, mount, size)
    // TRANSLATORS: This results in something like "Ext4 /home partition (at least 10 GiB)" since
    // %1$s is replaced by the filesystem type, %2$s by the mount point and %3$s by the size description
    : sprintf(_("%1$s %2$s partition (%3$s)"), type, mount, size);
};

/**
 * @component
 *
 * @param {object} props
 * @param {boolean} props.configure
 * @param {StorageDevice} props.device
 */
const BootLabelText = ({ configure, device }) => {
  if (!configure)
    return _("Do not configure partitions for booting");

  if (!device)
    return _("Boot partitions at installation disk");

  // TRANSLATORS: %s is the disk used to configure the boot-related partitions (eg. "/dev/sda, 80 GiB)
  return sprintf(_("Boot partitions at %s"), device.name);
};

/**
 * Generates an hint describing which attributes affect the auto-calculated limits.
 * If the limits are not affected then it returns `null`.
 * @component
 *
 * @param {object} props
 * @param {Volume} props.volume
 */
const AutoCalculatedHint = ({ volume }) => {
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
 * @component
 *
 * @param {object} props
 * @param {Volume} props.volume
 * @param {ProposalTarget} props.target
 */
const VolumeLabel = ({ volume, target }) => {
  return (
    <div className="split" style={{ background: "var(--color-gray)", padding: "var(--spacer-smaller) var(--spacer-small)", borderRadius: "var(--spacer-smaller)" }}>
      <span>{BasicVolumeText({ volume, target })}</span>
    </div>
  );
};

/**
 * @component
 *
 * @param {object} props
 * @param {StorageDevice|undefined} props.bootDevice
 * @param {boolean} props.configureBoot
 */
const BootLabel = ({ bootDevice, configureBoot }) => {
  return (
    <div className="split" style={{ background: "var(--color-gray)", padding: "var(--spacer-smaller) var(--spacer-small)", borderRadius: "var(--spacer-smaller)" }}>
      <span>{BootLabelText({ configure: configureBoot, device: bootDevice })}</span>
    </div>
  );
};

/**
 * Renders a table row with the information and actions for a volume
 * @component
 *
 * @param {object} props
 * @param {object} [props.columns] - Column specs
 * @param {Volume} [props.volume] - Volume to show
 * @param {Volume[]} [props.volumes] - List of current volumes
 * @param {Volume[]} [props.templates] - List of available templates
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
  volumes,
  templates,
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
    const isAuto = volume.autoSize;

    return (
      <div className="split">
        <span>{SizeText({ volume })}</span>
        {/* TRANSLATORS: device flag, the partition size is automatically computed */}
        <If condition={isAuto} then={<Tip description={AutoCalculatedHint({ volume })}>{_("auto")}</Tip>} />
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
        <Td colSpan={5}><Skeleton /></Td>
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
      <If
        condition={isEditDialogOpen}
        then={
          <VolumeDialog
            isOpen
            volume={volume}
            volumes={volumes}
            templates={templates}
            onAccept={acceptForm}
            onCancel={closeDialog}
          />
        }
      />
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
 * @param {Volume[]} props.volumes - Volumes to show
 * @param {Volume[]} props.templates - List of available templates
 * @param {StorageDevice[]} props.devices - Devices available for installation
 * @param {ProposalTarget} props.target - Installation target
 * @param {StorageDevice|undefined} props.targetDevice - Device selected for installation, if target is a disk
 * @param {boolean} props.isLoading - Whether to show the table as loading
 * @param {(volumes: Volume[]) => void} props.onVolumesChange - Function to submit changes in volumes
 */
const VolumesTable = ({
  volumes,
  templates,
  devices,
  target,
  targetDevice,
  isLoading,
  onVolumesChange
}) => {
  const columns = {
    mountPath: _("Mount point"),
    details: _("Details"),
    size: _("Size"),
    // TRANSLATORS: where (and how) the file-system is going to be created
    location: _("Location"),
    actions: _("Actions")
  };

  /** @type {(volume: Volume) => void} */
  const editVolume = (volume) => {
    const index = volumes.findIndex(v => v.mountPath === volume.mountPath);
    const newVolumes = [...volumes];
    newVolumes[index] = volume;
    onVolumesChange(newVolumes);
  };

  /** @type {(volume: Volume) => void} */
  const deleteVolume = (volume) => {
    const newVolumes = volumes.filter(v => v.mountPath !== volume.mountPath);
    onVolumesChange(newVolumes);
  };

  /** @type {() => React.ReactElement[]|React.ReactElement} */
  const renderVolumes = () => {
    if (volumes.length === 0 && isLoading) return <VolumeRow isLoading />;

    return volumes.map((volume, index) => {
      return (
        <VolumeRow
          key={index}
          columns={columns}
          volume={volume}
          volumes={volumes}
          templates={templates}
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
 * Content to show when the field is collapsed.
 * @component
 *
 * @param {object} props
 * @param {Volume[]} props.volumes
 * @param {boolean} props.configureBoot
 * @param {StorageDevice|undefined} props.bootDevice
 * @param {ProposalTarget} props.target
 * @param {boolean} props.isLoading
 */
const Basic = ({ volumes, configureBoot, bootDevice, target, isLoading }) => {
  if (isLoading)
    return (
      <div className="wrapped split">
        <Skeleton width="30%" />
        <Skeleton width="20%" />
        <Skeleton width="15%" />
      </div>
    );

  return (
    <div className="wrapped split">
      {volumes.map((v, i) => <VolumeLabel key={i} volume={v} target={target} />)}
      <BootLabel bootDevice={bootDevice} configureBoot={configureBoot} />
    </div>
  );
};

/**
 * Button for adding a new volume. It renders either a menu or a button depending on the number
 * of options.
 * @component
 *
 * @param {object} props
 * @param {string[]} props.options - Possible mount points to add. An empty string represent an
 *  arbitrary mount point.
 * @param {(option: string) => void} props.onClick
 */
const AddVolumeButton = ({ options, onClick }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  /** @type {() => void} */
  const onToggleClick = () => setIsOpen(!isOpen);

  /** @type {(_: any, value: string) => void} */
  const onSelect = (_, value) => {
    setIsOpen(false);
    onClick(value);
  };

  // Shows a button if the only option is to add an arbitrary volume.
  if (options.length === 1 && options[0] === "") {
    return (
      <Button variant="secondary" onClick={() => onClick("")}>{_("Add file system")}</Button>
    );
  }

  const isDisabled = !options.length;

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={onSelect}
      onOpenChange={setIsOpen}
      toggle={toggleRef => (
        <MenuToggle
          ref={toggleRef}
          onClick={onToggleClick}
          variant="secondary"
          isExpanded={isOpen}
          isDisabled={isDisabled}
        >
          {_("Add file system")}
        </MenuToggle>
      )}
      shouldFocusToggleOnSelect
    >
      <DropdownList>
        {options.map((option, index) => {
          return (
            <DropdownItem key={index} value={option}>
              {option === "" ? _("Other") : option}
            </DropdownItem>
          );
        })}
      </DropdownList>
    </Dropdown>
  );
};

/**
 * Content to show when the field is expanded.
 * @component
 *
 * @param {object} props
 * @param {Volume[]} props.volumes
 * @param {Volume[]} props.templates
 * @param {StorageDevice[]} props.devices
 * @param {ProposalTarget} props.target
 * @param {StorageDevice|undefined} props.targetDevice
 * @param {boolean} props.configureBoot
 * @param {StorageDevice|undefined} props.bootDevice
 * @param {StorageDevice|undefined} props.defaultBootDevice
 * @param {(volumes: Volume[]) => void} props.onVolumesChange
 * @param {(boot: BootConfig) => void} props.onBootChange
 * @param {boolean} props.isLoading
 */
const Advanced = ({
  volumes,
  templates,
  devices,
  target,
  targetDevice,
  configureBoot,
  bootDevice,
  defaultBootDevice,
  onVolumesChange,
  onBootChange,
  isLoading
}) => {
  const [isVolumeDialogOpen, setIsVolumeDialogOpen] = useState(false);
  /** @type {[Volume|undefined, (volume: Volume) => void]} */
  const [template, setTemplate] = useState();

  const openVolumeDialog = () => setIsVolumeDialogOpen(true);

  const closeVolumeDialog = () => setIsVolumeDialogOpen(false);

  /** @type {(volume: Volume) => void} */
  const onAcceptVolumeDialog = (volume) => {
    closeVolumeDialog();

    const index = volumes.findIndex(v => v.mountPath === volume.mountPath);

    if (index !== -1) {
      const newVolumes = [...volumes];
      newVolumes[index] = volume;
      onVolumesChange(newVolumes);
    } else {
      onVolumesChange([...volumes, volume]);
    }
  };

  const resetVolumes = () => onVolumesChange([]);

  /** @type {(mountPath: string) => void} */
  const addVolume = (mountPath) => {
    const template = templates.find(t => t.mountPath === mountPath);
    setTemplate(template);
    openVolumeDialog();
  };

  /**
   * Possible mount paths to add.
   * @type {() => string[]}
   */
  const mountPathOptions = () => {
    const mountPaths = volumes.map(v => v.mountPath);
    const isTransactional = isTransactionalSystem(templates);

    return templates
      .map(t => t.mountPath)
      .filter(p => !mountPaths.includes(p))
      .filter(p => !isTransactional || p.length);
  };

  /**
   * Whether to show the button for adding a volume.
   * @type {() => boolean}
   */
  const showAddVolume = () => {
    const hasOptionalVolumes = () => {
      return templates.find(t => t.mountPath.length && !t.outline.required) !== undefined;
    };

    return !isTransactionalSystem(templates) || hasOptionalVolumes();
  };

  /** @type {Volume} */
  const rootVolume = volumes.find(v => v.mountPath === "/");

  /** @type {(config: SnapshotsConfig) => void} */
  const changeBtrfsSnapshots = ({ active }) => {
    if (active) {
      rootVolume.fsType = "Btrfs";
      rootVolume.snapshots = true;
    } else {
      rootVolume.snapshots = false;
    }

    onVolumesChange(volumes);
  };

  return (
    <div className="stack">
      <If
        condition={rootVolume?.outline.snapshotsConfigurable}
        then={<SnapshotsField rootVolume={rootVolume} onChange={changeBtrfsSnapshots} />}
      />
      <VolumesTable
        volumes={volumes}
        templates={templates}
        devices={devices}
        target={target}
        targetDevice={targetDevice}
        onVolumesChange={onVolumesChange}
        isLoading={isLoading}
      />
      <div className="split" style={{ flexDirection: "row-reverse" }}>
        <If
          condition={showAddVolume()}
          then={<AddVolumeButton options={mountPathOptions()} onClick={addVolume} />}
        />
        <Button variant="plain" onClick={resetVolumes}>{_("Reset to defaults")}</Button>
      </div>
      <If
        condition={isVolumeDialogOpen}
        then={
          <VolumeDialog
            isOpen
            volume={template}
            volumes={volumes}
            templates={templates}
            onAccept={onAcceptVolumeDialog}
            onCancel={closeVolumeDialog}
          />
        }
      />
      <hr />
      <BootConfigField
        configureBoot={configureBoot}
        bootDevice={bootDevice}
        defaultBootDevice={defaultBootDevice}
        devices={devices}
        isLoading={isLoading}
        onChange={onBootChange}
      />
    </div>
  );
};

/**
 * @todo This component should be restructured to use the same approach as other newer components:
 *  * Use a TreeTable, specially if we need to represent subvolumes.
 *
 * Renders information of the volumes and boot-related partitions and actions to modify them.
 * @component
 *
 * @typedef {object} PartitionsFieldProps
 * @property {Volume[]} volumes - Volumes to show
 * @property {Volume[]} templates - Templates to use for new volumes
 * @property {StorageDevice[]} devices - Devices available for installation
 * @property {ProposalTarget} target - Installation target
 * @property {StorageDevice|undefined} targetDevice - Device selected for installation, if target is a disk
 * @property {boolean} configureBoot - Whether to configure boot partitions.
 * @property {StorageDevice|undefined} bootDevice - Device to use for creating boot partitions.
 * @property {StorageDevice|undefined} defaultBootDevice - Default device for boot partitions if no device has been indicated yet.
 * @property {boolean} [isLoading=false] - Whether to show the content as loading
 * @property {(volumes: Volume[]) => void} onVolumesChange - Function to use for changing the volumes
 * @property {(boot: BootConfig) => void} onBootChange - Function for changing the boot settings
 *
 * @typedef {object} BootConfig
 * @property {boolean} configureBoot
 * @property {StorageDevice|undefined} bootDevice
 *
 * @param {PartitionsFieldProps} props
 */
export default function PartitionsField({
  volumes,
  templates,
  devices,
  target,
  targetDevice,
  configureBoot,
  bootDevice,
  defaultBootDevice,
  isLoading = false,
  onVolumesChange,
  onBootChange
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ExpandableField
      icon="storage"
      isExpanded={isExpanded}
      label={_("Partitions and file systems")}
      description={_("Structure of the new system, including any additional partition needed for booting,")}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <If
        condition={isExpanded}
        then={
          <Advanced
            volumes={volumes}
            templates={templates}
            devices={devices}
            target={target}
            targetDevice={targetDevice}
            configureBoot={configureBoot}
            bootDevice={bootDevice}
            defaultBootDevice={defaultBootDevice}
            onVolumesChange={onVolumesChange}
            onBootChange={onBootChange}
            isLoading={isLoading}
          />
        }
        else={
          <Basic
            volumes={volumes}
            configureBoot={configureBoot}
            bootDevice={bootDevice}
            target={target}
            isLoading={isLoading}
          />
        }
      />
    </ExpandableField>
  );
}
