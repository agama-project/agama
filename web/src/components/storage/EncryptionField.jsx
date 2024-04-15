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

import React, { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { noop } from "~/utils";
import { If, SettingsField } from "~/components/core";
import { EncryptionMethods } from "~/client/storage";
import EncryptionSettingsDialog from "~/components/storage/EncryptionSettingsDialog";

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

// Field texts at root level to avoid redefinitions every time the component
// is rendered.
const LABEL = _("Encryption");
const DESCRIPTION = _("Full Disk Encryption (FDE) allows to protect the information stored at \
the device, including data, programs, and system files.");
const VALUES = {
  loading: <Skeleton width="150px" />,
  disabled: _("disabled"),
  [EncryptionMethods.LUKS2]: _("enabled"),
  [EncryptionMethods.TPM]: _("using TPM unlocking")
};

/**
 * Allows to define encryption
 * @component
 *
 * @typedef {object} EncryptionConfig
 * @property {string} password
 * @property {string} [method]
 *
 * @typedef {object} EncryptionFieldProps
 * @property {string} [password=""] - Password for encryption
 * @property {string} [method=""] - Encryption method
 * @property {string[]} [methods=[]] - Possible encryption methods
 * @property {boolean} [isLoading=false] - Whether to show the selector as loading
 * @property {(config: EncryptionConfig) => void} [onChange=noop] - On change callback
 *
 * @param {EncryptionFieldProps} props
 */
export default function EncryptionField({
  password = "",
  method = "",
  // FIXME: should be available methods actually a prop?
  methods = [],
  isLoading = false,
  onChange = noop
}) {
  const validPassword = useCallback(() => password?.length > 0, [password]);
  const [isEnabled, setIsEnabled] = useState(validPassword());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setIsEnabled(validPassword());
  }, [password, validPassword]);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  /**
   * @param {import("~/components/storage/EncryptionSettingsDialog").EncryptionSetting} encryptionSetting
   */
  const onAccept = (encryptionSetting) => {
    closeDialog();
    onChange(encryptionSetting);
  };

  return (
    <SettingsField
      label={LABEL}
      description={DESCRIPTION}
      value={isLoading ? VALUES.loading : VALUES[isEnabled ? method : "disabled"]}
      onClick={openDialog}
    >
      <If
        condition={isDialogOpen}
        then={
          <EncryptionSettingsDialog
            password={password}
            method={method}
            methods={methods}
            isOpen={isDialogOpen}
            onCancel={closeDialog}
            onAccept={onAccept}
          />
        }
      />
    </SettingsField>
  );
}
