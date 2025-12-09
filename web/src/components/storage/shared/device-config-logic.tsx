/*
 * Shared logic for device configuration pages (FormattableDevice, Partition, LogicalVolume)
 * This file extracts common patterns to reduce code duplication
 */

import React from "react";
import { SelectOptionProps } from "@patternfly/react-core";
import { useModel } from "~/hooks/storage/model";
import { useMissingMountPaths, useVolume } from "~/hooks/storage/product";
import { apiModel } from "~/api/storage/types";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { unique } from "radashi";
import { compact } from "~/utils";

// Common constants
export const NO_VALUE = "";
export const BTRFS_SNAPSHOTS = "btrfsSnapshots";
export const REUSE_FILESYSTEM = "reuse";

// Common types
export type BaseFormValue = {
  mountPoint: string;
  filesystem: string;
  filesystemLabel: string;
};

export type Error = {
  id: string;
  message?: string;
  isVisible: boolean;
};

export type ErrorsHandler = {
  errors: Error[];
  getError: (id: string) => Error | undefined;
  getVisibleError: (id: string) => Error | undefined;
};

// ============= Common Validation Logic =============

/**
 * Validates mount point format and uniqueness
 */
export function useMountPointError(
  mountPoint: string,
  initialMountPoint?: string
): Error | undefined {
  const model = useModel({ suspense: true });
  const mountPoints = model?.getMountPaths() || [];

  if (mountPoint === NO_VALUE) {
    return {
      id: "mountPoint",
      isVisible: false,
    };
  }

  const regex = /^swap$|^\/$|^(\/[^/\s]+)+$/;
  if (!regex.test(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a valid mount point"),
      isVisible: true,
    };
  }

  // Exclude itself when editing
  if (mountPoint !== initialMountPoint && mountPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

/**
 * Validates size input format and range
 */
export function validateSize(
  sizeOption: string,
  minSize: string,
  maxSize: string
): Error | undefined {
  if (sizeOption !== "custom") return;

  if (!minSize) {
    return {
      id: "customSize",
      isVisible: false,
    };
  }

  const regexp = /^[0-9]+(\.[0-9]+)?(\s*([KkMmGgTtPpEeZzYy][iI]?)?[Bb])?$/;
  const validMin = regexp.test(minSize);
  const validMax = maxSize ? regexp.test(maxSize) : true;

  if (validMin && validMax) {
    if (!maxSize || parseToBytes(minSize) <= parseToBytes(maxSize)) return;

    return {
      id: "customSize",
      message: _("The minimum cannot be greater than the maximum"),
      isVisible: true,
    };
  }

  if (validMin) {
    return {
      id: "customSize",
      message: _("The maximum must be a number optionally followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  if (validMax) {
    return {
      id: "customSize",
      message: _("The minimum must be a number optionally followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  return {
    id: "customSize",
    message: _("Size limits must be numbers optionally followed by a unit like GiB or GB"),
    isVisible: true,
  };
}

// Helper for parsing bytes (placeholder - use actual implementation)
function parseToBytes(size: string): number {
  // This should match your actual parseToBytes implementation
  return 0;
}

// ============= Common Hooks =============

/**
 * Returns the default filesystem for a given mount point
 */
export function useDefaultFilesystem(mountPoint: string): string {
  const volume = useVolume(mountPoint, { suspense: true });
  return volume.mountPath === "/" && volume.snapshots ? BTRFS_SNAPSHOTS : volume.fsType;
}

/**
 * Returns unused mount points plus the current one (when editing)
 */
export function useUnusedMountPoints(currentMountPoint?: string): string[] {
  const unusedMountPaths = useMissingMountPaths();
  return compact([currentMountPoint, ...unusedMountPaths]);
}

/**
 * Returns usable filesystems for a given mount point
 */
export function useUsableFilesystems(mountPoint: string): string[] {
  const volume = useVolume(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);

  return React.useMemo(() => {
    const volumeFilesystems = (): string[] => {
      const allValues = volume.outline.fsTypes;

      if (volume.mountPath !== "/") return allValues;

      // Btrfs without snapshots is not an option.
      if (!volume.outline.snapshotsConfigurable && volume.snapshots) {
        return [BTRFS_SNAPSHOTS, ...allValues].filter((v) => v !== "btrfs");
      }

      // Btrfs with snapshots is not an option
      if (!volume.outline.snapshotsConfigurable && !volume.snapshots) {
        return allValues;
      }

      return [BTRFS_SNAPSHOTS, ...allValues];
    };

    return unique([defaultFilesystem, ...volumeFilesystems()]);
  }, [volume, defaultFilesystem]);
}

/**
 * Creates error handler utilities
 */
export function useErrorsHandler(errors: Error[]): ErrorsHandler {
  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

// ============= Common Data Transformations =============

/**
 * Converts filesystem form value to API filesystem type
 */
export function getFilesystemType(filesystem: string): apiModel.FilesystemType | undefined {
  if (filesystem === NO_VALUE) return undefined;
  if (filesystem === BTRFS_SNAPSHOTS) return "btrfs";
  return filesystem as apiModel.FilesystemType;
}

/**
 * Creates filesystem configuration from form values
 */
export function buildFilesystemConfig(
  filesystem: string,
  filesystemLabel: string,
  isReusable: boolean = false
): apiModel.Filesystem | undefined {
  if (isReusable && filesystem === REUSE_FILESYSTEM) {
    return { reuse: true, default: true };
  }

  const type = getFilesystemType(filesystem);
  if (type === undefined) return undefined;

  return {
    type,
    snapshots: filesystem === BTRFS_SNAPSHOTS,
    label: filesystemLabel,
  };
}

/**
 * Extracts filesystem form value from API config
 */
export function extractFilesystemValue(
  fsConfig: apiModel.Filesystem | undefined,
  canReuse: boolean = false
): string {
  if (!fsConfig) return NO_VALUE;
  if (canReuse && fsConfig.reuse) return REUSE_FILESYSTEM;
  if (!fsConfig.type) return NO_VALUE;
  if (fsConfig.type === "btrfs" && fsConfig.snapshots) return BTRFS_SNAPSHOTS;
  return fsConfig.type;
}

// ============= Common UI Helpers =============

/**
 * Creates select options for mount points
 */
export function mountPointSelectOptions(mountPoints: string[]): SelectOptionProps[] {
  return mountPoints.map((p) => ({ value: p, children: p }));
}

/**
 * Auto-refresh filesystem based on mount point changes
 */
export function useAutoRefreshFilesystem(
  handler: (fs: string) => void,
  mountPoint: string,
  shouldAutoRefresh: boolean,
  getCurrentFilesystem?: () => string | null
) {
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const currentFilesystem = getCurrentFilesystem?.();

  React.useEffect(() => {
    if (!shouldAutoRefresh) return;

    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) {
      handler(NO_VALUE);
      return;
    }

    // Select default filesystem for the mount point if no current filesystem
    if (!currentFilesystem) {
      handler(defaultFilesystem);
      return;
    }

    // Reuse the filesystem if possible
    const reuse = usableFilesystems.includes(currentFilesystem);
    handler(reuse ? REUSE_FILESYSTEM : defaultFilesystem);
  }, [
    handler,
    mountPoint,
    defaultFilesystem,
    usableFilesystems,
    currentFilesystem,
    shouldAutoRefresh,
  ]);
}

/**
 * Validates filesystem label format
 */
export function isValidFilesystemLabel(value: string): boolean {
  return /^[\w-_.]*$/.test(value);
}
