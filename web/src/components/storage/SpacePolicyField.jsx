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
import { Button, CardBody, Skeleton } from "@patternfly/react-core";
import { CardField } from "~/components/core";
import SpacePolicyDialog from "~/components/storage/SpacePolicyDialog";
import { _, n_ } from "~/i18n";
import { sprintf } from "sprintf-js";

/**
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Allows to select the space policy.
 * @component
 *
 * @typedef {object} SpacePolicyFieldProps
 * @property {SpacePolicy|undefined} policy
 * @property {SpaceAction[]} actions
 * @property {StorageDevice[]} devices
 * @property {boolean} isLoading
 * @property {(config: SpacePolicyConfig) => void} onChange
 *
 * @typedef {object} SpacePolicyConfig
 * @property {SpacePolicy} spacePolicy
 * @property {SpaceAction[]} spaceActions
 *
 * @param {SpacePolicyFieldProps} props
 */
export default function SpacePolicyField({
  policy,
  actions,
  devices,
  isLoading,
  onChange
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  const onAccept = ({ spacePolicy, spaceActions }) => {
    closeDialog();
    onChange({ spacePolicy, spaceActions });
  };

  let value;
  if (isLoading || !policy) {
    value = <Skeleton fontSize="sm" width="65%" />;
  } else if (policy.summaryLabels.length === 1) {
    // eslint-disable-next-line agama-i18n/string-literals
    value = _(policy.summaryLabels[0]);
  } else {
    // eslint-disable-next-line agama-i18n/string-literals
    value = sprintf(n_(policy.summaryLabels[0], policy.summaryLabels[1], devices.length), devices.length);
  }

  return (
    <CardField
      label={_("Find space")}
      value={value}
      description={_("Allocating the file systems might need to find free space \
in the installation device(s).")}
      actions={
        isLoading ? <Skeleton fontSize="sm" width="100px" /> : <Button variant="secondary" onClick={openDialog}>{_("Change")}</Button>
      }
      cardProps={{ isFullHeight: false }}
    >
      {isDialogOpen &&
        <SpacePolicyDialog
          isOpen
          isLoading={isLoading}
          policy={policy}
          actions={actions}
          devices={devices}
          onAccept={onAccept}
          onCancel={closeDialog}
        />}
    </CardField>
  );
}
