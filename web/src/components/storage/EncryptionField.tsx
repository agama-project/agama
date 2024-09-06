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

import React, { useCallback, useEffect, useState } from "react";
import { Button, Skeleton } from "@patternfly/react-core";
import { CardField } from "~/components/core";
import EncryptionSettingsDialog, {
  EncryptionSetting,
} from "~/components/storage/EncryptionSettingsDialog";
import { EncryptionMethods } from "~/types/storage";
import { _ } from "~/i18n";
import { noop } from "~/utils";

// Field texts at root level to avoid redefinitions every time the component
// is rendered.
const LABEL = _("Encryption");
const DESCRIPTION = _(
  "Protection for the information stored at \
the device, including data, programs, and system files.",
);
const VALUES = {
  disabled: _("disabled"),
  [EncryptionMethods.LUKS2]: _("enabled"),
  [EncryptionMethods.TPM]: _("using TPM unlocking"),
};

const Value = ({ isLoading, isEnabled, method }) => {
  if (isLoading) return <Skeleton fontSize="sm" width="75%" />;
  if (isEnabled) return VALUES[method];

  return VALUES.disabled;
};

const Action = ({ isEnabled, isLoading, onClick }) => {
  if (isLoading) return <Skeleton fontSize="sm" width="100px" />;

  const variant = isEnabled ? "secondary" : "primary";
  const label = isEnabled ? _("Modify") : _("Enable");

  return (
    <Button variant={variant} onClick={onClick}>
      {label}
    </Button>
  );
};

export type EncryptionConfig = {
  password: string;
  method?: string;
};

export type EncryptionFieldProps = {
  password?: string;
  method?: string;
  methods?: string[];
  isLoading?: boolean;
  onChange?: (config: EncryptionConfig) => void;
};

/**
 * Allows to define encryption
 * @component
 */
export default function EncryptionField({
  password = "",
  method = "",
  // FIXME: should be available methods actually a prop?
  methods = [],
  isLoading = false,
  onChange = noop,
}: EncryptionFieldProps) {
  const validPassword = useCallback(() => password?.length > 0, [password]);
  const [isEnabled, setIsEnabled] = useState(validPassword());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setIsEnabled(validPassword());
  }, [password, validPassword]);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  const onAccept = (encryptionSetting: EncryptionSetting) => {
    closeDialog();
    onChange(encryptionSetting);
  };

  return (
    <CardField
      label={LABEL}
      value={<Value isLoading={isLoading} isEnabled={isEnabled} method={method} />}
      description={DESCRIPTION}
      cardDescriptionProps={{ isFilled: true }}
      actions={<Action isEnabled={isEnabled} isLoading={isLoading} onClick={openDialog} />}
    >
      {isDialogOpen && (
        <EncryptionSettingsDialog
          isOpen
          password={password}
          method={method}
          methods={methods}
          isLoading={isLoading}
          onCancel={closeDialog}
          onAccept={onAccept}
        />
      )}
    </CardField>
  );
}
