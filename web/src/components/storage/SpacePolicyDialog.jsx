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

import React, { useEffect, useState } from "react";
import { Form } from "@patternfly/react-core";
import { OptionsPicker, Popup } from "~/components/core";
import { SpaceActionsTable } from '~/components/storage';
import { _ } from "~/i18n";
import { SPACE_POLICIES } from '~/components/storage/utils';
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Widget to allow user picking desired policy to make space.
 * @component
 *
 * @param {object} props
 * @param {SpacePolicy} props.currentPolicy
 * @param {(policy: SpacePolicy) => void} [props.onChange]
 */
const SpacePolicyPicker = ({ currentPolicy, onChange = noop }) => {
  return (
    <OptionsPicker>
      {/* eslint-disable agama-i18n/string-literals */}
      {SPACE_POLICIES.map((policy) => {
        return (
          <OptionsPicker.Option
            key={policy.id}
            title={_(policy.label)}
            body={_(policy.description)}
            onClick={() => onChange(policy)}
            isSelected={currentPolicy?.id === policy.id}
          />
        );
      })}
      {/* eslint-enable agama-i18n/string-literals */}
    </OptionsPicker>
  );
};

/**
 * Renders a dialog that allows the user to select the space policy and actions.
 * @component
 *
 * @typedef {object} SpacePolicyDialogProps
 * @property {SpacePolicy} policy
 * @property {SpaceAction[]} actions
 * @property {StorageDevice[]} devices
 * @property {boolean} [isOpen=false]
 * @property {boolean} [isLoading]
 * @property {() => void} [onCancel=noop]
 * @property {(spaceConfig: SpaceConfig) => void} [onAccept=noop]
 *
 * @typedef {object} SpaceConfig
 * @property {SpacePolicy} spacePolicy
 * @property {SpaceAction[]} spaceActions
 *
 * @param {SpacePolicyDialogProps} props
 */
export default function SpacePolicyDialog({
  policy: defaultPolicy,
  actions: defaultActions,
  devices,
  isOpen,
  isLoading,
  onCancel = noop,
  onAccept = noop,
  ...props
}) {
  const [policy, setPolicy] = useState(defaultPolicy);
  const [actions, setActions] = useState(defaultActions);
  const [customUsed, setCustomUsed] = useState(false);
  const [expandedDevices, setExpandedDevices] = useState([]);

  if (!policy && defaultPolicy) { setPolicy(defaultPolicy) }
  if (!actions && defaultActions) { setActions(defaultActions) }

  useEffect(() => {
    if (policy && policy.id === "custom") setExpandedDevices(devices);
  }, [devices, policy, setExpandedDevices]);

  // The selectors for the space action have to be initialized always to the same value
  // (e.g., "keep") when the custom policy is selected for first time. The following two useEffect
  // ensures that.

  // Stores whether the custom policy has been used.
  useEffect(() => {
    if (policy && policy.id === "custom" && !customUsed) setCustomUsed(true);
  }, [policy, customUsed, setCustomUsed]);

  // Resets actions (i.e., sets everything to "keep") if the custom policy has not been used yet.
  useEffect(() => {
    if (policy && policy.id !== "custom" && !customUsed) setActions([]);
  }, [policy, customUsed, setActions]);

  // Generates the action value according to the policy.
  const deviceAction = (device) => {
    if (policy.id === "custom") {
      return actions.find(a => a.device === device.name)?.action || "keep";
    }

    const policyAction = { delete: "force_delete", resize: "resize", keep: "keep" };
    return policyAction[policy.id];
  };

  const changeActions = (spaceAction) => {
    const spaceActions = actions.filter(a => a.device !== spaceAction.device);
    if (spaceAction.action !== "keep") spaceActions.push(spaceAction);

    setActions(spaceActions);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    onAccept({ spacePolicy: policy, spaceActions: actions });
  };

  const description = _("Allocating the file systems might need to find free space \
in the devices listed below. Choose how to do it.");

  return (
    <Popup
      title={_("Find space")}
      description={description}
      isOpen={isOpen}
      isLoading={isLoading}
      blockSize="large"
      inlineSize="large"
      {...props}
    >
      <Form id="space-policy-form" onSubmit={onSubmit}>
        <SpacePolicyPicker currentPolicy={policy} onChange={setPolicy} />
        {devices.length > 0 &&
          <SpaceActionsTable
            devices={devices}
            expandedDevices={expandedDevices}
            deviceAction={deviceAction}
            isActionDisabled={policy?.id !== "custom"}
            onActionChange={changeActions}
          />}
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="space-policy-form" type="submit" />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
