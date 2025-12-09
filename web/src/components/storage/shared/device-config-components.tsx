/*
 * Shared UI components for device configuration pages
 * Extracts common React components used across FormattableDevice, Partition, and LogicalVolume
 */

import React from "react";
import {
  Divider,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  SelectGroup,
  SelectList,
  SelectOption,
  TextInput,
} from "@patternfly/react-core";
import { SelectWrapper as Select } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import { useVolume } from "~/hooks/storage/product";
import { filesystemLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import {
  NO_VALUE,
  BTRFS_SNAPSHOTS,
  REUSE_FILESYSTEM,
  useDefaultFilesystem,
  useUsableFilesystems,
  isValidFilesystemLabel,
} from "./device-config-logic";

// ============= Filesystem Label Component =============

type FilesystemLabelProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
};

export function FilesystemLabel({ id, value, onChange }: FilesystemLabelProps): React.ReactNode {
  return (
    <TextInput
      id={id}
      aria-label={_("File system label")}
      value={value}
      onChange={(_, v) => isValidFilesystemLabel(v) && onChange(v)}
    />
  );
}

// ============= Filesystem Option Label =============

type FilesystemOptionLabelProps = {
  value: string;
  currentFilesystem?: string | null;
};

export function FilesystemOptionLabel({
  value,
  currentFilesystem,
}: FilesystemOptionLabelProps): React.ReactNode {
  if (value === NO_VALUE) return _("Waiting for a mount point");
  
  if (value === REUSE_FILESYSTEM && currentFilesystem) {
    // TRANSLATORS: %s is a filesystem type, like Btrfs
    return sprintf(_("Current %s"), filesystemLabel(currentFilesystem));
  }
  
  if (value === BTRFS_SNAPSHOTS) return _("Btrfs with snapshots");

  return filesystemLabel(value);
}

// ============= Filesystem Options =============

type FilesystemOptionsProps = {
  mountPoint: string;
  canReuse?: boolean;
  currentFilesystem?: string | null;
  deviceName?: string;
  formatText?: string;
  reuseDescription?: string;
};

export function FilesystemOptions({
  mountPoint,
  canReuse = false,
  currentFilesystem,
  deviceName,
  formatText,
  reuseDescription,
}: FilesystemOptionsProps): React.ReactNode {
  const volume = useVolume(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const canActuallyReuse = canReuse && currentFilesystem && usableFilesystems.includes(currentFilesystem);

  const defaultOptText = volume.mountPath
    ? sprintf(_("Default file system for %s"), mountPoint)
    : _("Default file system for generic mount paths");

  const defaultFormatText = currentFilesystem
    ? _("Destroy current data and format device as")
    : _("Format device as");

  return (
    <SelectList aria-label="Available file systems">
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} />
        </SelectOption>
      )}
      
      {mountPoint !== NO_VALUE && canActuallyReuse && (
        <SelectOption
          value={REUSE_FILESYSTEM}
          description={reuseDescription}
        >
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} currentFilesystem={currentFilesystem} />
        </SelectOption>
      )}
      
      {mountPoint !== NO_VALUE && canActuallyReuse && usableFilesystems.length > 0 && <Divider />}
      
      {mountPoint !== NO_VALUE && (
        <SelectGroup label={formatText || defaultFormatText}>
          {usableFilesystems.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={fsType === defaultFilesystem ? defaultOptText : undefined}
            >
              <FilesystemOptionLabel value={fsType} />
            </SelectOption>
          ))}
        </SelectGroup>
      )}
    </SelectList>
  );
}

// ============= Filesystem Select =============

type FilesystemSelectProps = {
  id?: string;
  value: string;
  mountPoint: string;
  currentFilesystem?: string | null;
  canReuse?: boolean;
  deviceName?: string;
  formatText?: string;
  reuseDescription?: string;
  onChange: SelectProps["onChange"];
};

export function FilesystemSelect({
  id,
  value,
  mountPoint,
  currentFilesystem,
  canReuse,
  deviceName,
  formatText,
  reuseDescription,
  onChange,
}: FilesystemSelectProps): React.ReactNode {
  const usedValue = mountPoint === NO_VALUE ? NO_VALUE : value;

  return (
    <Select
      id={id}
      value={usedValue}
      label={<FilesystemOptionLabel value={usedValue} currentFilesystem={currentFilesystem} />}
      onChange={onChange}
      isDisabled={mountPoint === NO_VALUE}
    >
      <FilesystemOptions
        mountPoint={mountPoint}
        canReuse={canReuse}
        currentFilesystem={currentFilesystem}
        deviceName={deviceName}
        formatText={formatText}
        reuseDescription={reuseDescription}
      />
    </Select>
  );
}

// ============= Mount Point Field =============

type MountPointFieldProps = {
  id?: string;
  value: string;
  options: any[];
  error?: { message?: string };
  onChange: (value: string) => void;
  SelectComponent: React.ComponentType<any>;
};

export function MountPointField({
  id,
  value,
  options,
  error,
  onChange,
  SelectComponent,
}: MountPointFieldProps): React.ReactNode {
  return (
    <FormGroup fieldId={id || "mountPoint"} label={_("Mount point")}>
      <SelectComponent
        id={id || "mountPoint"}
        toggleName={_("Mount point toggle")}
        listName={_("Suggested mount points")}
        inputName={_("Mount point")}
        clearButtonName={_("Clear selected mount point")}
        value={value}
        options={options}
        createText={_("Use")}
        onChange={onChange}
      />
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={error ? "error" : "default"} screenReaderText="">
            {!error && _("Select or enter a mount point")}
            {error?.message}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
}
