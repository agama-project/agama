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
import { Skeleton, Stack } from "@patternfly/react-core";
import { CardField, EmptyState } from "~/components/core";
import DevicesManager from "~/components/storage/DevicesManager";
import ProposalResultTable from "~/components/storage/ProposalResultTable";
import { _ } from "~/i18n";

/**
 * @typedef {import ("~/client/storage").Action} Action
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("~/client/mixins").ValidationError} ValidationError
 */

/**
 * @todo Create a component for rendering a customized skeleton
 */
const ResultSkeleton = () => (
  <Stack hasGutter>
    <Skeleton screenreaderText={_("Waiting for information about storage configuration")} width="80%" />
    <Skeleton width="65%" />
    <Skeleton width="70%" />
  </Stack>
);

/**
 * Section holding the proposal result and actions to perform in the system
 * @component
 *
 * @typedef {object} ProposalResultSectionProps
 * @property {StorageDevice[]} [system=[]]
 * @property {StorageDevice[]} [staging=[]]
 * @property {Action[]} [actions=[]]
 * @property {ValidationError[]} [errors=[]] - Validation errors
 * @property {boolean} [isLoading=false] - Whether the section content should be rendered as loading
 *
 * @param {ProposalResultSectionProps} props
 */
export default function ProposalResultSection({
  system = [],
  staging = [],
  actions = [],
  errors = [],
  isLoading = false,
}) {
  return (
    <CardField
      label={_("Final layout")}
      description={_("The systems will be configured as displayed below.")}
    >
      <CardField.Content>
        {isLoading && <ResultSkeleton />}
        {errors.length === 0
          ? <ProposalResultTable devicesManager={new DevicesManager(system, staging, actions)} />
          : (
            <EmptyState icon="error" title={_("Storage proposal not possible")} color="danger-color-100">
              {errors.map((e, i) => <div key={i}>{e.message}</div>)}
            </EmptyState>
          )}
      </CardField.Content>
    </CardField>
  );
}
