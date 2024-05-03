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
import { Button, Skeleton } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import DevicesManager from "~/components/storage/DevicesManager";
import { If, Section, Reminder } from "~/components/core";
import { ProposalActionsDialog } from "~/components/storage";
import ProposalResultTable from "~/components/storage/ProposalResultTable";

/**
 * @typedef {import ("~/client/storage").Action} Action
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("~/client/mixins").ValidationError} ValidationError
 */

/**
 * Renders information about planned actions, allowing to check all of them and warning with a
 * summary about the deletion ones, if any.
 * @component
 *
 * @param {object} props
 * @param {Action[]} props.actions
 * @param {string[]} props.systems
 */
const DeletionsInfo = ({ actions, systems }) => {
  const total = actions.length;

  if (total === 0) return;

  // TRANSLATORS: %d will be replaced by the amount of destructive actions
  const warningTitle = sprintf(n_(
    "There is %d destructive action planned",
    "There are %d destructive actions planned",
    total
  ), total);

  // FIXME: Use the Intl.ListFormat instead of the `join(", ")` used below.
  // Most probably, a `listFormat` or similar wrapper should live in src/i18n.js or so.
  // Read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat
  return (
    <Reminder title={warningTitle} variant="subtle">
      <If
        condition={systems.length > 0}
        then={
          <p>
            {
              // TRANSLATORS: This is part of a sentence to hint the user about affected systems.
              // Eg. "Affecting Windows 11, openSUSE Leap 15, and Ubuntu 22.04"
            }
            {_("Affecting")} <strong>{systems.join(", ")}</strong>
          </p>
        }
      />
    </Reminder>
  );
};

/**
 * Renders needed UI elements to allow user check the proposal planned actions
 * @component
 *
 * @param {object} props
 * @param {Action[]} props.actions
 */
const ActionsInfo = ({ actions }) => {
  const [showActions, setShowActions] = useState(false);
  const onOpen = () => setShowActions(true);
  const onClose = () => setShowActions(false);

  return (
    <>
      <Button onClick={onOpen} variant="link" isInline>{_("Check all planned actions")}</Button>
      <ProposalActionsDialog actions={actions} isOpen={showActions} onClose={onClose} />
    </>
  );
};

/**
 * @todo Create a component for rendering a customized skeleton
 */
const ResultSkeleton = () => {
  return (
    <>
      <Skeleton screenreaderText={_("Waiting for information about storage configuration")} width="80%" />
      <Skeleton width="65%" />
      <Skeleton width="70%" />
    </>
  );
};

/**
 * Content of the section.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice[]} props.system
 * @param {StorageDevice[]} props.staging
 * @param {Action[]} props.actions
 * @param {ValidationError[]} props.errors
 */
const SectionContent = ({ system, staging, actions, errors }) => {
  if (errors.length) return;

  const devicesManager = new DevicesManager(system, staging, actions);

  return (
    <>
      <DeletionsInfo
        actions={devicesManager.actions.filter(a => a.delete && !a.subvol)}
        systems={devicesManager.deletedSystems()}
      />
      <ActionsInfo actions={actions} />
      <ProposalResultTable devicesManager={devicesManager} />
    </>
  );
};

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
  isLoading = false
}) {
  if (isLoading) errors = [];
  const totalActions = actions.length;

  // TRANSLATORS: The description for the Result section in storage proposal
  // page. %d will be replaced by the number of proposal actions.
  const description = sprintf(n_(
    "During installation, %d action will be performed to configure the system as displayed below",
    "During installation, %d actions will be performed to configure the system as displayed below",
    totalActions
  ), totalActions);

  return (
    <Section
      // TRANSLATORS: The storage "Result" section's title
      title={_("Result")}
      description={!isLoading && errors.length === 0 && description}
      id="storage-result"
      errors={errors}
    >
      <If
        condition={isLoading}
        then={<ResultSkeleton />}
        else={
          <SectionContent
            system={system}
            staging={staging}
            actions={actions}
            errors={errors}
          />
        }
      />
    </Section>
  );
}
