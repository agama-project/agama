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

import React, { useState } from "react";
import { Form, Skeleton } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Section, Popup } from "~/components/core";
import { SpacePolicyButton, SpacePolicySelector, SpacePolicyDisksHint } from "~/components/storage";
import { noop } from "~/utils";

/**
 * Form for configuring the space policy.
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID.
 * @param {ProposalSettings} props.settings - Settings used for calculating a proposal.
 * @param {onSubmitFn} [props.onSubmit=noop] - On submit callback.
 *
 * @callback onSubmitFn
 * @param {string} policy - Name of the selected policy.
 */
const SpacePolicyForm = ({
  id,
  policy,
  onSubmit: onSubmitProp = noop
}) => {
  const [spacePolicy, setSpacePolicy] = useState(policy);

  const onSubmit = (e) => {
    e.preventDefault();
    onSubmitProp(spacePolicy);
  };

  return (
    <Form id={id} onSubmit={onSubmit}>
      <SpacePolicySelector value={spacePolicy} onChange={setSpacePolicy} />
    </Form>
  );
};

/**
 * Allows to select SpacePolicy.
 * @component
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings - Settings used for calculating a proposal.
 * @param {boolean} [props.isLoading=false] - Whether to show the selector as loading.
 * @param {onChangeFn} [props.onChange=noop] - On change callback.
 *
 * @callback onChangeFn
 * @param {string} policy
 */
const SpacePolicyField = ({
  settings,
  isLoading = false,
  onChange = noop
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [spacePolicy, setSpacePolicy] = useState(settings.spacePolicy);

  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

  const onSubmitForm = (policy) => {
    onChange(policy);
    setSpacePolicy(policy);
    closeForm();
  };

  if (isLoading) return <Skeleton width="25%" />;

  const description = _("Select how to make free space in the disks selected for allocating the \
    file systems.");

  return (
    <div className="split">
      {/* TRANSLATORS: To be completed with the rest of a sentence like "deleting all content" */}
      <span>{_("Find space")}</span>
      <SpacePolicyButton policy={spacePolicy} devices={settings.installationDevices} onClick={openForm} />
      <Popup
        description={description}
        title={_("Space Policy")}
        isOpen={isFormOpen}
      >
        <div className="stack">
          <SpacePolicyDisksHint devices={settings.installationDevices} />
          <SpacePolicyForm
            id="spacePolicyForm"
            policy={spacePolicy}
            onSubmit={onSubmitForm}
          />
        </div>
        <Popup.Actions>
          <Popup.Confirm
            form="spacePolicyForm"
            type="submit"
          >
            {_("Accept")}
          </Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </div>
  );
};

/**
 * Section for configuring the space policy.
 * @component
 */
export default function ProposalSpacePolicySection({
  settings,
  onChange = noop
}) {
  const changeSpacePolicy = (policy) => {
    onChange({ spacePolicy: policy });
  };

  return (
    <Section title={_("Find Space")} className="flex-stack">
      <SpacePolicyField
        settings={settings}
        isLoading={settings.spacePolicy === undefined}
        onChange={changeSpacePolicy}
      />
    </Section>
  );
}
