/*
 * Copyright (c) [2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React from "react";
import { Content } from "@patternfly/react-core";
import { SubtleContent } from "~/components/core/";
import { deviceSize } from "~/components/storage/utils";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import type { configModel } from "~/model/storage/config-model";
import type { storage } from "~/model/system";

type DeviceType = "partition" | "logicalVolume";

function deviceTypeLabel(deviceType: DeviceType): string {
  return deviceType === "partition" ? _("partition") : _("logical volume");
}

type AutoSizeTextFallbackProps = {
  size: configModel.Size;
  deviceType: DeviceType;
};

function AutoSizeTextFallback({ size, deviceType }: AutoSizeTextFallbackProps): React.ReactNode {
  if (size.max) {
    if (size.max === size.min) {
      return sprintf(
        // TRANSLATORS: %1$s is a size with units (eg. 3 GiB) and %2$s is a device type (eg. partition)
        _("A generic size of %1$s will be used for the new %2$s"),
        deviceSize(size.min),
        deviceTypeLabel(deviceType),
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s and %2$s are sizes with units (eg. 3 GiB) and %3$s is a device type (eg. partition)
      _("A generic size range between %1$s and %2$s will be used for the new %3$s"),
      deviceSize(size.min),
      deviceSize(size.max),
      deviceTypeLabel(deviceType),
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is a size with units (eg. 3 GiB) and %1$s is a device type (eg. partition)
    _("A generic minimum size of %1$s will be used for the new %2$s"),
    deviceSize(size.min),
    deviceTypeLabel(deviceType),
  );
}

type AutoSizeTextFixedProps = {
  path: string;
  size: configModel.Size;
  deviceType: DeviceType;
};

function AutoSizeTextFixed({ path, size, deviceType }: AutoSizeTextFixedProps): React.ReactNode {
  if (size.max) {
    if (size.max === size.min) {
      return sprintf(
        // TRANSLATORS: %1$s is a device type (eg. partition), %2$s is a size with units (10 GiB) and %3$s is a mount path (/home)
        _("A %1$s of %2$s will be created for %3$s if possible"),
        deviceTypeLabel(deviceType),
        deviceSize(size.min),
        path,
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a device type (eg. partition), %2$s and %3$s are sizes with units (10 GiB), and %4$s is a mount path (/home)
      _("A %1$s with a size between %2$s and %3$s will be created for %4$s if possible"),
      deviceTypeLabel(deviceType),
      deviceSize(size.min),
      deviceSize(size.max),
      path,
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is a device type (eg. partition), %2$s is a size with units (10 GiB) and %3$s is a mount path (/home)
    _("A %1$s of at least %2$s will be created for %3$s if possible"),
    deviceTypeLabel(deviceType),
    deviceSize(size.min),
    path,
  );
}

type AutoSizeTextRamProps = {
  path: string;
  size: configModel.Size;
  deviceType: DeviceType;
};

function AutoSizeTextRam({ path, size, deviceType }: AutoSizeTextRamProps): React.ReactNode {
  if (size.max) {
    if (size.max === size.min) {
      return sprintf(
        // TRANSLATORS: %1$s is a device type (eg. partition), %2$s is a size with units (10 GiB) and %3$s is a mount path (/home)
        _("Based on the amount of RAM in the system, a %1$s of %2$s will be planned for %3$s"),
        deviceTypeLabel(deviceType),
        deviceSize(size.min),
        path,
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a device type (eg. partition), %2$s and %3$s are sizes with units (10 GiB), and %4$s is a mount path (/home)
      _(
        "Based on the amount of RAM in the system, a %1$s with a size between %2$s and %3$s will be planned for %4$s",
      ),
      deviceTypeLabel(deviceType),
      deviceSize(size.min),
      deviceSize(size.max),
      path,
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is a device type (eg. partition), %2$s is a size with units (10 GiB) and %3$s is a mount path (/home)
    _("Based on the amount of RAM in the system, a %1$s of at least %2$s will be planned for %3$s"),
    deviceTypeLabel(deviceType),
    deviceSize(size.min),
    path,
  );
}

type AutoSizeTextDynamicProps = {
  volume: storage.Volume;
  size: configModel.Size;
  deviceType: DeviceType;
};

function AutoSizeTextDynamic({
  volume,
  size,
  deviceType,
}: AutoSizeTextDynamicProps): React.ReactNode {
  const introText = (volume) => {
    const path = volume.mountPath;
    const otherPaths = volume.outline.sizeRelevantVolumes || [];
    const snapshots = !!volume.outline.snapshotsAffectSizes;
    const ram = !!volume.outline.adjustByRam;

    if (ram && snapshots) {
      if (otherPaths.length === 1) {
        return sprintf(
          // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
          _(
            "The size for %1$s will be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of a separate file system for %2$s.",
          ),
          path,
          otherPaths[0],
        );
      }

      if (otherPaths.length > 1) {
        // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
        return sprintf(
          _(
            "The size for %1$s will be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of separate file systems for %2$s.",
          ),
          path,
          formatList(otherPaths),
        );
      }

      return sprintf(
        // TRANSLATORS: %s is a mount point (eg. /)
        _(
          "The size for %s will be dynamically adjusted based on the amount of RAM in the system and the usage of Btrfs snapshots.",
        ),
        path,
      );
    }

    if (ram) {
      if (otherPaths.length === 1) {
        return sprintf(
          // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
          _(
            "The size for %1$s will be dynamically adjusted based on the amount of RAM in the system and the presence of a separate file system for %2$s.",
          ),
          path,
          otherPaths[0],
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
        _(
          "The size for %1$s will be dynamically adjusted based on the amount of RAM in the system and the presence of separate file systems for %2$s.",
        ),
        path,
        formatList(otherPaths),
      );
    }

    if (snapshots) {
      if (otherPaths.length === 1) {
        return sprintf(
          // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
          _(
            "The size for %1$s will be dynamically adjusted based on the usage of Btrfs snapshots and the presence of a separate file system for %2$s.",
          ),
          path,
          otherPaths[0],
        );
      }

      if (otherPaths.length > 1) {
        // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
        return sprintf(
          _(
            "The size for %1$s will be dynamically adjusted based on the usage of Btrfs snapshots and the presence of separate file systems for %2$s.",
          ),
          path,
          formatList(otherPaths),
        );
      }

      return sprintf(
        // TRANSLATORS: %s is a mount point (eg. /)
        _("The size for %s will be dynamically adjusted based on the usage of Btrfs snapshots."),
        path,
      );
    }

    if (otherPaths.length === 1) {
      return sprintf(
        // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
        _(
          "The size for %1$s will be dynamically adjusted based on the presence of a separate file system for %2$s.",
        ),
        path,
        otherPaths[0],
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
      _(
        "The size for %1$s will be dynamically adjusted based on the presence of separate file systems for %2$s.",
      ),
      path,
      formatList(otherPaths),
    );
  };

  const limitsText = (size) => {
    if (size.max) {
      if (size.max === size.min) {
        return sprintf(
          // TRANSLATORS: %1$s is a device type (eg. partition) and %2$s is a size with units (eg. 10 GiB)
          _("The current configuration will result in an attempt to create a %1$s of %2$s."),
          deviceTypeLabel(deviceType),
          deviceSize(size.min),
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is a device type (eg. partition) %2$s is a min size, %3$s is the max size
        _(
          "The current configuration will result in an attempt to create a %1$s with a size between %2$s and %3$s.",
        ),
        deviceTypeLabel(deviceType),
        deviceSize(size.min),
        deviceSize(size.max),
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a device type (eg. partition) and %2$s is a size with units (eg. 10 GiB)
      _("The current configuration will result in an attempt to create a %1$s of at least %2$s."),
      deviceTypeLabel(deviceType),
      deviceSize(size.min),
    );
  };

  return (
    <>
      <Content component="p">
        <SubtleContent>{introText(volume)}</SubtleContent>
      </Content>
      <Content component="p">
        <SubtleContent>{limitsText(size)}</SubtleContent>
      </Content>
    </>
  );
}

export type AutoSizeTextProps = {
  volume: storage.Volume;
  size: configModel.Size;
  deviceType: DeviceType;
};

export default function AutoSizeText({ volume, size, deviceType }: AutoSizeTextProps) {
  const path = volume.mountPath;

  if (path) {
    if (volume.autoSize) {
      const otherPaths = volume.outline.sizeRelevantVolumes || [];

      if (otherPaths.length || volume.outline.snapshotsAffectSizes) {
        return <AutoSizeTextDynamic volume={volume} size={size} deviceType={deviceType} />;
      }

      // This assumes volume.autoSize is correctly set. Ie. if it is set to true then at least one
      // of the relevant outline fields (snapshots, RAM and sizeRelevantVolumes) is used.
      return <AutoSizeTextRam path={path} size={size} deviceType={deviceType} />;
    }

    return <AutoSizeTextFixed path={path} size={size} deviceType={deviceType} />;
  }

  // Fallback volume
  // This assumes the fallback volume never uses automatic sizes (ie. re-calculated based on
  // other aspects of the configuration). It would be VERY surprising if that's the case.
  return <AutoSizeTextFallback size={size} deviceType={deviceType} />;
}
