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

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Internal component for building the link that navigates to selector
 *
 * @param {object} props
 * @param {boolean} [props.isBold=false] - Whether text should be wrapped by <b>.
 */
const Link = ({ isBold = false }) => {
  const text = _("Change boot options");

  return <RouterLink to={PATHS.bootingPartition}>{isBold ? <b>{text}</b> : text}</RouterLink>;
};

/**
 * Allows to select the boot config.
 * @component
 *
 * @typedef {object} BootConfigFieldProps
 * @property {boolean} configureBoot
 * @property {StorageDevice|undefined} bootDevice
 * @property {StorageDevice|undefined} defaultBootDevice
 * @property {StorageDevice[]} availableDevices
 * @property {boolean} isLoading
 * @property {(boot: BootConfig) => void} onChange
 *
 * @typedef {object} BootConfig
 * @property {boolean} configureBoot
 * @property {StorageDevice} bootDevice
 *
 * @param {BootConfigFieldProps} props
 */
export default function BootConfigField({ configureBoot, bootDevice, isLoading, onChange }) {
  const onAccept = ({ configureBoot, bootDevice }) => {
    onChange({ configureBoot, bootDevice });
  };

  if (isLoading && configureBoot === undefined) {
    return <Skeleton width="75%" />;
  }

  let value;

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
