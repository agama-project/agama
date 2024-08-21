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
  Button,
  CardBody,
  CardExpandableContent,
  Divider,
  Dropdown,
  DropdownList,
  DropdownItem,
  Flex,
  List,
  ListItem,
  MenuToggle,
  Skeleton,
  Split,
  Stack,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { CardField, RowActions, Tip } from "~/components/core";
import { noop } from "~/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import {
  deviceSize,
  hasSnapshots,
  isTransactionalRoot,
  isTransactionalSystem,
  reuseDevice,
} from "~/components/storage/utils";
import BootConfigField from "~/components/storage/BootConfigField";
import SnapshotsField from "~/components/storage/SnapshotsField";
import VolumeDialog from "~/components/storage/VolumeDialog";
import VolumeLocationDialog from "~/components/storage/VolumeLocationDialog";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("~/components/storage/SnapshotsField").SnapshotsConfig} SnapshotsConfig
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
  if (reuseDevice(volume)) targetSize = volume.targetDevice.size;

  const minSize = deviceSize(targetSize || volume.minSize);
  const maxSize = targetSize
    ? deviceSize(targetSize)
    : volume.maxSize
      ? deviceSize(volume.maxSize)
      : undefined;

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
  const lvm = target === "NEW_LVM_VG";
  // When target is "filesystem" or "device" this is irrelevant since the type of device
  // is not mentioned
  const lv = volume.target === "NEW_VG" || (volume.target === "DEFAULT" && lvm);

  if (transactional)
    return lv
      ? // TRANSLATORS: "/" is in an LVM logical volume. %s replaced by size string, e.g. "17.5 GiB"
        sprintf(_("Transactional Btrfs root volume (%s)"), size)
      : // TRANSLATORS: %s replaced by size string, e.g. "17.5 GiB"
        sprintf(_("Transactional Btrfs root partition (%s)"), size);

  if (snapshots)
    return lv
      ? // TRANSLATORS: "/" is in an LVM logical volume. %s replaced by size string, e.g. "17.5 GiB"
        sprintf(_("Btrfs root volume with snapshots (%s)"), size)
      : // TRANSLATORS: %s replaced by size string, e.g. "17.5 GiB"
        sprintf(_("Btrfs root partition with snapshots (%s)"), size);

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

    return lv
      ? // TRANSLATORS: Swap is in an LVM logical volume. %s replaced by size string, e.g. "8 GiB"
        sprintf(_("Swap volume (%s)"), size)
      : // TRANSLATORS: %s replaced by size string, e.g. "8 GiB"
        sprintf(_("Swap partition (%s)"), size);
  }

  const type = volume.fsType;

  if (mount === "/") {
    if (volTarget === "DEVICE")
      // TRANSLATORS: This results in something like "Btrfs root at /dev/sda3 (20 GiB)" since
      // %1$s is replaced by the filesystem type, %2$s by the device name, and %3$s by the size
      return sprintf(_("%1$s root at %2$s (%3$s)"), type, device, size);

    return lv
      ? // TRANSLATORS: "/" is in an LVM logical volume.
        // Results in something like "Btrfs root volume (at least 20 GiB)" since
        // $1$s is replaced by filesystem type and %2$s by size description
        sprintf(_("%1$s root volume (%2$s)"), type, size)
      : // TRANSLATORS: Results in something like "Btrfs root partition (at least 20 GiB)" since
        // $1$s is replaced by filesystem type and %2$s by size description
        sprintf(_("%1$s root partition (%2$s)"), type, size);
  }

  if (volTarget === "DEVICE")
    // TRANSLATORS: This results in something like "Ext4 /home at /dev/sda3 (20 GiB)" since
    // %1$s is replaced by filesystem type, %2$s by mount point, %3$s by device name and %4$s by size
    return sprintf(_("%1$s %2$s at %3$s (%4$s)"), type, mount, device, size);

  return lv
    ? // TRANSLATORS: The filesystem is in an LVM logical volume.
      // Results in something like "Ext4 /home volume (at least 10 GiB)" since
      // %1$s is replaced by the filesystem type, %2$s by the mount point and %3$s by the size description
      sprintf(_("%1$s %2$s volume (%3$s)"), type, mount, size)
    : // TRANSLATORS: This results in something like "Ext4 /home partition (at least 10 GiB)" since
      // %1$s is replaced by the filesystem type, %2$s by the mount point and %3$s by the size description
      sprintf(_("%1$s %2$s partition (%3$s)"), type, mount, size);
};

/**
 * @component
 *
 * @param {object} props
 * @param {boolean} props.configure
 * @param {StorageDevice} props.device
 */
const BootLabelText = ({ configure, device }) => {
  if (!configure) return _("Do not configure partitions for booting");

  if (!device) return _("Boot partitions at installation disk");

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
        {snapshotsAffectSizes && (
          // TRANSLATORS: list item, this affects the computed partition size limits
          <ListItem>{_("The configuration of snapshots")}</ListItem>
        )}
        {sizeRelevantVolumes.length > 0 && (
          // TRANSLATORS: list item, this affects the computed partition size limits
          // %s is replaced by a list of the volumes (like "/home, /boot")
          <ListItem>
            {sprintf(_("Presence of other volumes (%s)"), sizeRelevantVolumes.join(", "))}
          </ListItem>
        )}
        {adjustByRam && (
          // TRANSLATORS: list item, describes a factor that affects the computed size of a
          // file system; eg. adjusting the size of the swap
          <ListItem>{_("The amount of RAM in the system")}</ListItem>
        )}
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
    <Split
      hasGutter
      style={{
        background: "var(--color-gray)",
        padding: "var(--spacer-smaller) var(--spacer-small)",
        borderRadius: "var(--spacer-smaller)",
      }}
    >
      <span>{BasicVolumeText({ volume, target })}</span>
    </Split>
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
    <Split
      hasGutter
      style={{
        background: "var(--color-gray)",
        padding: "var(--spacer-smaller) var(--spacer-small)",
        borderRadius: "var(--spacer-smaller)",
      }}
    >
      <span>{BootLabelText({ configure: configureBoot, device: bootDevice })}</span>
    </Split>
  );
};

// TODO: Extract VolumesTable or at least VolumeRow and all related internal
// components to a new file.

/**
 * @component
 * @param {object} props
 * @param {Volume} props.volume
 */
const VolumeSizeLimits = ({ volume }) => {
  const isAuto = volume.autoSize;

  return (
    <Split hasGutter>
      <span>{SizeText({ volume })}</span>
      {/* TRANSLATORS: device flag, the partition size is automatically computed */}
      {isAuto && !reuseDevice(volume) && (
        <Tip description={AutoCalculatedHint({ volume })}>{_("auto")}</Tip>
      )}
    </Split>
  );
};

/**
 * @component
 * @param {object} props
 * @param {Volume} props.volume
 */
const VolumeDetails = ({ volume }) => {
  const snapshots = hasSnapshots(volume);
  const transactional = isTransactionalRoot(volume);

  if (volume.target === "FILESYSTEM")
    // TRANSLATORS: %s will be replaced by a file-system type like "Btrfs" or "Ext4"
    return sprintf(_("Reused %s"), volume.targetDevice?.filesystem?.type || "");
  if (transactional) return _("Transactional Btrfs");
  if (snapshots) return _("Btrfs with snapshots");

  return volume.fsType;
};

/**
 * @component
 * @param {object} props
 * @param {Volume} props.volume
 * @param {ProposalTarget} props.target
 */
const VolumeLocation = ({ volume, target }) => {
  if (volume.target === "NEW_PARTITION")
    // TRANSLATORS: %s will be replaced by a disk name (eg. "/dev/sda")
    return sprintf(_("Partition at %s"), volume.targetDevice?.name || "");
  if (volume.target === "NEW_VG")
    // TRANSLATORS: %s will be replaced by a disk name (eg. "/dev/sda")
    return sprintf(_("Separate LVM at %s"), volume.targetDevice?.name || "");
  if (volume.target === "DEVICE" || volume.target === "FILESYSTEM")
    return volume.targetDevice?.name || "";
  if (target === "NEW_LVM_VG") return _("Logical volume at system LVM");

  return _("Partition at installation disk");
};

/**
 * @component
 * @param {object} props
 * @param {Volume} props.volume
 * @param {() => void} props.onEdit
 * @param {() => void} props.onResetLocation
 * @param {() => void} props.onLocation
 * @param {() => void} props.onDelete
 */
const VolumeActions = ({ volume, onEdit, onResetLocation, onLocation, onDelete }) => {
  const actions = [
    { title: _("Edit"), onClick: onEdit },
    volume.target !== "DEFAULT" && { title: _("Reset location"), onClick: onResetLocation },
    { title: _("Change location"), onClick: onLocation },
    !volume.outline.required && { title: _("Delete"), onClick: onDelete, isDanger: true },
  ];

  return <RowActions id="volume_actions" actions={actions.filter(Boolean)} />;
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
 * @param {StorageDevice[]} [props.volumeDevices=[]] - Devices available for installation
 * @param {ProposalTarget} [props.target]
 * @param {StorageDevice[]} [props.targetDevices] - Device selected for installation, if target is a disk
 * @param {boolean} props.isLoading - Whether to show the row as loading
 * @param {(volume: Volume) => void} [props.onEdit=noop] - Function to use for editing the volume
 * @param {() => void} [props.onDelete=noop] - Function to use for deleting the volume
 */
const VolumeRow = ({
  columns,
  volume,
  volumes,
  templates,
  volumeDevices,
  target,
  targetDevices,
  isLoading,
  onEdit = noop,
  onDelete = noop,
}) => {
  /** @type {[string, (dialog: string) => void]} */
  const [dialog, setDialog] = useState();

  const openEditDialog = () => setDialog("edit");

  const openLocationDialog = () => setDialog("location");

  const closeDialog = () => setDialog(undefined);

  const onResetLocationClick = () => {
    onEdit({ ...volume, target: "DEFAULT", targetDevice: undefined });
  };

  const acceptForm = (volume) => {
    closeDialog();
    onEdit(volume);
  };

  const isEditDialogOpen = dialog === "edit";
  const isLocationDialogOpen = dialog === "location";

  if (isLoading) {
    return (
      <Tr>
        <Td colSpan={5}>
          <Skeleton />
        </Td>
      </Tr>
    );
  }

  return (
    <>
      <Tr>
        <Td dataLabel={columns.mountPath}>{volume.mountPath}</Td>
        <Td dataLabel={columns.details}>
          <VolumeDetails volume={volume} />
        </Td>
        <Td dataLabel={columns.size}>
          <VolumeSizeLimits volume={volume} />
        </Td>
        <Td dataLabel={columns.location}>
          <VolumeLocation volume={volume} target={target} />
        </Td>
        <Td isActionCell>
          <VolumeActions
            volume={volume}
            onEdit={openEditDialog}
            onResetLocation={onResetLocationClick}
            onLocation={openLocationDialog}
            onDelete={onDelete}
          />
        </Td>
      </Tr>
      {isEditDialogOpen && (
        <VolumeDialog
          isOpen
          volume={volume}
          volumes={volumes}
          templates={templates}
          onAccept={acceptForm}
          onCancel={closeDialog}
        />
      )}
      {isLocationDialogOpen && (
        <VolumeLocationDialog
          isOpen
          volume={volume}
          volumes={volumes}
          volumeDevices={volumeDevices}
          targetDevices={targetDevices}
          onAccept={acceptForm}
          onCancel={closeDialog}
        />
      )}
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
 * @param {StorageDevice[]} props.volumeDevices
 * @param {ProposalTarget} props.target
 * @param {StorageDevice[]} props.targetDevices
 * @param {boolean} props.isLoading - Whether to show the table as loading
 * @param {(volumes: Volume[]) => void} props.onVolumesChange - Function to submit changes in volumes
 */
const VolumesTable = ({
  volumes,
  templates,
  volumeDevices,
  target,
  targetDevices,
  isLoading,
  onVolumesChange,
}) => {
  const columns = {
    mountPath: _("Mount point"),
    details: _("Details"),
    size: _("Size"),
    // TRANSLATORS: where (and how) the file-system is going to be created
    location: _("Location"),
    actions: _("Actions"),
  };

  /** @type {(volume: Volume) => void} */
  const editVolume = (volume) => {
    const index = volumes.findIndex((v) => v.mountPath === volume.mountPath);
    const newVolumes = [...volumes];
    newVolumes[index] = volume;
    onVolumesChange(newVolumes);
  };

  /** @type {(volume: Volume) => void} */
  const deleteVolume = (volume) => {
    const newVolumes = volumes.filter((v) => v.mountPath !== volume.mountPath);
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
          volumeDevices={volumeDevices}
          target={target}
          targetDevices={targetDevices}
          isLoading={isLoading}
          onEdit={editVolume}
          onDelete={() => deleteVolume(volume)}
        />
      );
    });
  };

  return (
    <Table aria-label={_("Table with mount points")} variant="compact" borders>
      <Thead noWrap>
        <Tr>
          <Th>{columns.mountPath}</Th>
          <Th>{columns.details}</Th>
          <Th>{columns.size}</Th>
          <Th>{columns.location}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>{renderVolumes()}</Tbody>
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
      <Split hasGutter isWrappable>
        <Skeleton width="30%" />
        <Skeleton width="20%" />
        <Skeleton width="15%" />
      </Split>
    );

  return (
    <Split hasGutter isWrappable>
      {volumes.map((v, i) => (
        <VolumeLabel key={i} volume={v} target={target} />
      ))}
      <BootLabel bootDevice={bootDevice} configureBoot={configureBoot} />
    </Split>
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
      <Button variant="secondary" onClick={() => onClick("")}>
        {_("Add file system")}
      </Button>
    );
  }

  const isDisabled = !options.length;

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={onSelect}
      onOpenChange={setIsOpen}
      toggle={(toggleRef) => (
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
          if (option === "") {
            return (
              <React.Fragment key="other-option">
                <Divider component="li" key="separator" />
                <DropdownItem key={index} value={option}>
                  {_("Other")}
                </DropdownItem>
              </React.Fragment>
            );
          } else {
            return (
              <DropdownItem key={index} value={option}>
                <b>{option}</b>
              </DropdownItem>
            );
          }
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
 * @param {StorageDevice[]} props.availableDevices
 * @param {StorageDevice[]} props.volumeDevices
 * @param {ProposalTarget} props.target
 * @param {StorageDevice[]} props.targetDevices
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
  availableDevices,
  volumeDevices,
  target,
  targetDevices,
  configureBoot,
  bootDevice,
  defaultBootDevice,
  onVolumesChange,
  onBootChange,
  isLoading,
}) => {
  const [isVolumeDialogOpen, setIsVolumeDialogOpen] = useState(false);
  /** @type {[Volume|undefined, (volume: Volume) => void]} */
  const [template, setTemplate] = useState();

  const openVolumeDialog = () => setIsVolumeDialogOpen(true);

  const closeVolumeDialog = () => setIsVolumeDialogOpen(false);

  /** @type {(volume: Volume) => void} */
  const onAcceptVolumeDialog = (volume) => {
    closeVolumeDialog();

    const index = volumes.findIndex((v) => v.mountPath === volume.mountPath);

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
    const template = templates.find((t) => t.mountPath === mountPath);
    setTemplate(template);
    openVolumeDialog();
  };

  /**
   * Possible mount paths to add.
   * @type {() => string[]}
   */
  const mountPathOptions = () => {
    const mountPaths = volumes.map((v) => v.mountPath);
    const isTransactional = isTransactionalSystem(templates);

    return templates
      .map((t) => t.mountPath)
      .filter((p) => !mountPaths.includes(p))
      .filter((p) => !isTransactional || p.length);
  };

  /**
   * Whether to show the button for adding a volume.
   * @type {() => boolean}
   */
  const showAddVolume = () => {
    const hasOptionalVolumes = () => {
      return templates.find((t) => t.mountPath.length && !t.outline.required) !== undefined;
    };

    return !isTransactionalSystem(templates) || hasOptionalVolumes();
  };

  /** @type {Volume} */
  const rootVolume = volumes.find((v) => v.mountPath === "/");

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

  const showSnapshotsField = rootVolume?.outline.snapshotsConfigurable;

  return (
    <Stack hasGutter>
      {showSnapshotsField && (
        <SnapshotsField rootVolume={rootVolume} onChange={changeBtrfsSnapshots} />
      )}
      <VolumesTable
        volumes={volumes}
        templates={templates}
        volumeDevices={volumeDevices}
        target={target}
        targetDevices={targetDevices}
        onVolumesChange={onVolumesChange}
        isLoading={isLoading}
      />
      <Flex direction={{ default: "rowReverse" }}>
        {showAddVolume() && <AddVolumeButton options={mountPathOptions()} onClick={addVolume} />}
        <Button variant="plain" onClick={resetVolumes}>
          {_("Reset to defaults")}
        </Button>
      </Flex>
      {isVolumeDialogOpen && (
        <VolumeDialog
          isOpen
          volume={template}
          volumes={volumes}
          templates={templates}
          onAccept={onAcceptVolumeDialog}
          onCancel={closeVolumeDialog}
        />
      )}
      <Divider />
      <BootConfigField
        configureBoot={configureBoot}
        bootDevice={bootDevice}
        defaultBootDevice={defaultBootDevice}
        availableDevices={availableDevices}
        isLoading={isLoading}
        onChange={onBootChange}
      />
    </Stack>
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
 * @property {StorageDevice[]} availableDevices - Devices available for installation
 * @property {StorageDevice[]} volumeDevices - Devices that can be selected as target for a volume
 * @property {ProposalTarget} target - Installation target
 * @property {StorageDevice[]} targetDevices
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
  availableDevices,
  volumeDevices,
  target,
  targetDevices,
  configureBoot,
  bootDevice,
  defaultBootDevice,
  isLoading = false,
  onVolumesChange,
  onBootChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const onExpand = () => setIsExpanded(!isExpanded);

  return (
    <CardField
      label={_("Partitions and file systems")}
      description={_(
        "Structure of the new system, including any additional partition needed for booting",
      )}
      cardProps={{ isExpanded }}
      cardHeaderProps={{
        onExpand,
        toggleButtonProps: {
          id: "toggle-partitions-and-file-systems-view",
          "aria-label": _("Show partitions and file-systems actions"),
          "aria-expanded": isExpanded,
        },
        isToggleRightAligned: true,
      }}
    >
      {!isExpanded && (
        <CardBody>
          <Basic
            volumes={volumes}
            configureBoot={configureBoot}
            bootDevice={bootDevice}
            target={target}
            isLoading={isLoading}
          />
        </CardBody>
      )}
      <CardExpandableContent>
        <CardBody>
          <Advanced
            volumes={volumes}
            templates={templates}
            volumeDevices={volumeDevices}
            availableDevices={availableDevices}
            target={target}
            targetDevices={targetDevices}
            configureBoot={configureBoot}
            bootDevice={bootDevice}
            defaultBootDevice={defaultBootDevice}
            onVolumesChange={onVolumesChange}
            onBootChange={onBootChange}
            isLoading={isLoading}
          />
        </CardBody>
      </CardExpandableContent>
    </CardField>
  );
}
