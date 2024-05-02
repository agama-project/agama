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

import React, { useState } from "react";
import { Skeleton } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceLabel } from "~/components/storage/utils";
import { If } from "~/components/core";
import { Icon } from "~/components/layout";
import BootSelectionDialog from "~/components/storage/BootSelectionDialog";

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Internal component for building the button that opens the dialog
 *
 * @param {object} props
 * @param {boolean} [props.isBold=false] - Whether text should be wrapped by <b>.
 * @param {() => void} props.onClick - Callback to trigger when user clicks.
 */
const Button = ({ isBold = false, onClick }) => {
  const text = _("Change boot options");

  return (
    <button onClick={onClick} className="inline-flex-button">
      {isBold ? <b>{text}</b> : text}
    </button>
  );
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
export default function BootConfigField({
  configureBoot,
  bootDevice,
  defaultBootDevice,
  availableDevices,
  isLoading,
  onChange
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  const onAccept = ({ configureBoot, bootDevice }) => {
    closeDialog();
    onChange({ configureBoot, bootDevice });
  };

  if (isLoading && configureBoot === undefined) {
    return <Skeleton width="75%" />;
  }

  let value;

  if (!configureBoot) {
    value = <><Icon name="feedback" size="xs" /> {_("Installation will not configure partitions for booting.")}</>;
  } else if (!bootDevice) {
    value = _("Installation will configure partitions for booting at the installation disk.");
  } else {
    // TRANSLATORS: %s is the disk used to configure the boot-related partitions (eg. "/dev/sda, 80 GiB)
    value = sprintf(_("Installation will configure partitions for booting at %s."), deviceLabel(bootDevice));
  }

  return (
    <div>
      {value} <Button onClick={openDialog} isBold={!configureBoot} />
      <If
        condition={isDialogOpen}
        then={
          <BootSelectionDialog
            isOpen
            configureBoot={configureBoot}
            bootDevice={bootDevice}
            defaultBootDevice={defaultBootDevice}
            availableDevices={availableDevices}
            onAccept={onAccept}
            onCancel={closeDialog}
          />
        }
      />
    </div>
  );
}
