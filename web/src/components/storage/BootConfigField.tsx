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

// @ts-check

import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Skeleton } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceLabel } from "~/components/storage/utils";
import { Icon } from "~/components/layout";
import { PATHS } from "~/routes/storage";
import { StorageDevice } from "~/types/storage";

/**
 * Internal component for building the link that navigates to selector
 *
 * @param props
 * @param [props.isBold=false] - Whether text should be wrapped by <b>.
 */
const Link = ({ isBold = false }: { isBold?: boolean; }) => {
  const text = _("Change boot options");

  return <RouterLink to={PATHS.bootingPartition}>{isBold ? <b>{text}</b> : text}</RouterLink>;
};

export type BootConfig = {
  configureBoot: boolean;
  bootDevice: StorageDevice;
}

export type BootConfigFieldProps = {
  configureBoot: boolean;
  bootDevice?: StorageDevice;
  defaultBootDevice?: StorageDevice;
  availableDevices: StorageDevice[];
  isLoading: boolean;
}

/**
 * Summarizes how the system will boot.
 * @component
 */
export default function BootConfigField({ configureBoot, bootDevice, isLoading }: BootConfigFieldProps) {
  if (isLoading && configureBoot === undefined) {
    return <Skeleton width="75%" />;
  }

  let value: React.ReactNode;

  if (!configureBoot) {
    value = (
      <>
        <Icon name="feedback" size="xs" />{" "}
        {_("Installation will not configure partitions for booting.")}
      </>
    );
  } else if (!bootDevice) {
    value = _("Installation will configure partitions for booting at the installation disk.");
  } else {
    // TRANSLATORS: %s is the disk used to configure the boot-related partitions (eg. "/dev/sda, 80 GiB)
    value = sprintf(
      _("Installation will configure partitions for booting at %s."),
      deviceLabel(bootDevice),
    );
  }

  return (
    <div>
      {value} <Link isBold={!configureBoot} />
    </div>
  );
}
