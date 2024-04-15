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

import { _ } from "~/i18n";
import { SPACE_POLICIES } from '~/components/storage/utils';
import { If, Popup, RadioField } from "~/components/core";
import { noop } from "~/utils";
import { SpaceActionsTable } from '~/components/storage';

/**
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Renders a dialog that allows the user to select the space policy and actions.
 * @component
 *
 * @param {object} props
 * @param {SpacePolicy} props.policy
 * @param {SpaceAction[]} props.actions
 * @param {StorageDevice[]} props.devices
 * @param {boolean} [props.isOpen=false]
 * @param {() => void} [props.onCancel=noop]
 * @param {(spaceConfig: SpaceConfig) => void} [props.onAccept=noop]
 *
 * @typedef {object} SpaceConfig
 * @property {SpacePolicy} spacePolicy
 * @property {SpaceAction[]} spaceActions
 */
export default function SpacePolicyDialog({
  policy: defaultPolicy,
  actions: defaultActions,
  devices,
  isOpen,
  onCancel = noop,
  onAccept = noop,
  ...props
}) {
  const [currentPolicy, setCurrentPolicy] = useState(defaultPolicy);
  const [actions, setActions] = useState(defaultActions);
  const [customUsed, setCustomUsed] = useState(false);
  const [expandedDevices, setExpandedDevices] = useState([]);

  console.log("isOpen", isOpen);

  useEffect(() => {
    if (currentPolicy.id === "custom") setExpandedDevices(devices);
  }, [devices, currentPolicy, setExpandedDevices]);

  // The selectors for the space action have to be initialized always to the same value
  // (e.g., "keep") when the custom policy is selected for first time. The following two useEffect
  // ensures that.

  // Stores whether the custom policy has been used.
  useEffect(() => {
    if (currentPolicy.id === "custom" && !customUsed) setCustomUsed(true);
  }, [currentPolicy, customUsed, setCustomUsed]);

  // Resets actions (i.e., sets everything to "keep") if the custom policy has not been used yet.
  useEffect(() => {
    if (currentPolicy.id !== "custom" && !customUsed) setActions([]);
  }, [currentPolicy, customUsed, setActions]);

  // Generates the action value according to the policy.
  const deviceAction = (device) => {
    let action;

    if (currentPolicy.id === "custom") {
      action = actions.find(a => a.device === device.name)?.action || "keep";
    } else {
      const policyAction = { delete: "force_delete", resize: "resize", keep: "keep" };
      action = policyAction[currentPolicy.id];
    }

    // For a drive device (e.g., Disk, RAID) it does not make sense to offer the resize action.
    // At this moment, the Agama backend generates a resize action for drives if the policy is set
    // to 'resize'. In that cases, the action is converted here to 'keep'.
    return ((device.isDrive && action === "resize") ? "keep" : action);
  };

  const changeActions = (spaceAction) => {
    const spaceActions = actions.filter(a => a.device !== spaceAction.device);
    if (spaceAction.action !== "keep") spaceActions.push(spaceAction);

    setActions(spaceActions);
  };

  const onSubmit = (e) => {
    console.log("submitting the form because of", e);
    e.preventDefault();
    onAccept({ spacePolicy: currentPolicy, spaceActions: actions });
  };

  const description = _("Allocating the file systems might need to find free space \
in the devices listed below. Choose how to do it.");

  return (
    <Popup
      title={_("Find space")}
      description={description}
      isOpen={isOpen}
      variant="medium"
      {...props}
    >
      <Form id="space-policy-form" onSubmit={onSubmit}>
        {/* eslint-disable agama-i18n/string-literals */}
        {SPACE_POLICIES.map((policy) => {
          return (
            <RadioField
              key={policy.id}
              iconSize="xs"
              label={_(policy.label)}
              description={_(policy.description)}
              onClick={() => setCurrentPolicy(policy)}
              isChecked={currentPolicy?.id === policy.id}
              textWrapper="span"
            >
              <If
                condition={devices.length > 0 && currentPolicy?.id === policy.id}
                then={
                  <SpaceActionsTable
                    devices={devices}
                    expandedDevices={expandedDevices}
                    deviceAction={deviceAction}
                    isActionDisabled={policy.id !== "custom"}
                    onActionChange={changeActions}
                  />
                }
              />
            </RadioField>
          );
        })}
        {/* eslint-enable agama-i18n/string-literals */}
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="space-policy-form" type="submit" />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
