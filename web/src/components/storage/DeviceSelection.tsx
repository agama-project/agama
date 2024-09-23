/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flex, Form, FormGroup, Radio, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { DeviceSelectorTable } from "~/components/storage";
import DevicesTechMenu from "./DevicesTechMenu";
import { ProposalTarget, StorageDevice } from "~/types/storage";
import { useAvailableDevices, useProposalMutation, useProposalResult } from "~/queries/storage";
import { deviceChildren } from "~/components/storage/utils";
import { compact } from "~/utils";
import a11y from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { _ } from "~/i18n";

const SELECT_DISK_ID = "select-disk";
const CREATE_LVM_ID = "create-lvm";
const SELECT_DISK_PANEL_ID = "panel-for-disk-selection";
const CREATE_LVM_PANEL_ID = "panel-for-lvm-creation";

type DeviceSelectionState = {
  target?: ProposalTarget;
  targetDevice?: StorageDevice;
  targetPVDevices?: StorageDevice[];
};

/**
 * Allows the user to select a target device for installation.
 * @component
 */
export default function DeviceSelection() {
  const { settings } = useProposalResult();
  const availableDevices = useAvailableDevices();
  const updateProposal = useProposalMutation();
  const navigate = useNavigate();
  const [state, setState] = useState<DeviceSelectionState>({});

  const isTargetDisk = state.target === ProposalTarget.DISK;
  const isTargetNewLvmVg = state.target === ProposalTarget.NEW_LVM_VG;

  useEffect(() => {
    if (state.target !== undefined) return;

    // FIXME: move to a state/reducer
    setState({
      target: settings.target,
      targetDevice: availableDevices.find((d) => d.name === settings.targetDevice),
      targetPVDevices: availableDevices.filter((d) => settings.targetPVDevices?.includes(d.name)),
    });
  }, [settings, availableDevices, state.target]);

  const selectTargetDisk = () => setState({ ...state, target: ProposalTarget.DISK });
  const selectTargetNewLvmVG = () => setState({ ...state, target: ProposalTarget.NEW_LVM_VG });

  const selectTargetDevice = (devices: StorageDevice[]) =>
    setState({ ...state, targetDevice: devices[0] });
  const selectTargetPVDevices = (devices: StorageDevice[]) => {
    setState({ ...state, targetPVDevices: devices });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const newSettings = {
      target: state.target,
      targetDevice: isTargetDisk ? state.targetDevice?.name : "",
      targetPVDevices: isTargetNewLvmVg ? state.targetPVDevices.map((d) => d.name) : [],
    };

    updateProposal.mutateAsync({ ...settings, ...newSettings });
    navigate("..");
  };

  const isAcceptDisabled = () => {
    if (isTargetDisk) return state.targetDevice === undefined;
    if (isTargetNewLvmVg) return state.targetPVDevices?.length === 0;

    return true;
  };

  const isDeviceSelectable = (device: StorageDevice) => device.isDrive || device.type === "md";

  // TRANSLATORS: description for using plain partitions for installing the
  // system, the text in the square brackets [] is displayed in bold, use only
  // one pair in the translation
  const [msgStart1, msgBold1, msgEnd1] = _(
    "The file systems will be allocated \
by default as [new partitions in the selected device].",
  ).split(/[[\]]/);
  // TRANSLATORS: description for using logical volumes for installing the
  // system, the text in the square brackets [] is displayed in bold, use only
  // one pair in the translation
  const [msgStart2, msgBold2, msgEnd2] = _(
    "The file systems will be allocated \
by default as [logical volumes of a new LVM Volume Group]. The corresponding \
physical volumes will be created on demand as new partitions at the selected \
devices.",
  ).split(/[[\]]/);

  return (
    <Page>
      <Page.Header>
        <h2>{_("Select installation device")}</h2>
      </Page.Header>

      <Page.Content>
        <Form id="targetSelection" onSubmit={onSubmit}>
          <Page.Section>
            <FormGroup label={_("Install new system on")} isInline role="radiogroup">
              <Radio
                name="target"
                label={_("An existing disk")}
                onChange={selectTargetDisk}
                isLabelWrapped
                id={SELECT_DISK_ID}
                aria-controls={SELECT_DISK_PANEL_ID}
                isChecked={isTargetDisk}
              />
              <Radio
                name="target"
                label={_("A new LVM Volume Group")}
                onChange={selectTargetNewLvmVG}
                isLabelWrapped
                id={CREATE_LVM_ID}
                aria-controls={CREATE_LVM_PANEL_ID}
                isChecked={isTargetNewLvmVg}
              />
            </FormGroup>
          </Page.Section>
          <Page.Section>
            <FormGroup isStack>
              <Stack
                id={SELECT_DISK_PANEL_ID}
                aria-expanded={isTargetDisk}
                className={!isTargetDisk && a11y.hidden}
              >
                <div>
                  {msgStart1}
                  <b>{msgBold1}</b>
                  {msgEnd1}
                </div>

                <DeviceSelectorTable
                  aria-label={_("Device selector for target disk")}
                  devices={availableDevices}
                  selectedDevices={compact([state.targetDevice])}
                  itemChildren={deviceChildren}
                  itemSelectable={isDeviceSelectable}
                  onSelectionChange={selectTargetDevice}
                  variant="compact"
                />
              </Stack>

              <Stack
                id={CREATE_LVM_PANEL_ID}
                aria-expanded={isTargetNewLvmVg}
                className={!isTargetNewLvmVg && a11y.hidden}
              >
                <div>
                  {msgStart2}
                  <b>{msgBold2}</b>
                  {msgEnd2}
                </div>

                <div>
                  <DeviceSelectorTable
                    aria-label={_("Device selector for new LVM volume group")}
                    isMultiple
                    devices={availableDevices}
                    selectedDevices={state.targetPVDevices}
                    itemChildren={deviceChildren}
                    itemSelectable={isDeviceSelectable}
                    onSelectionChange={selectTargetPVDevices}
                    variant="compact"
                  />
                </div>
              </Stack>

              <Flex gap={{ default: "gapXs" }} justifyContent={{ default: "justifyContentCenter" }}>
                {_("Prepare more devices by configuring advanced")}
                <DevicesTechMenu label={_("storage techs")} />
              </Flex>
            </FormGroup>
          </Page.Section>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
        <Page.Submit form="targetSelection" isDisabled={isAcceptDisabled()} />
      </Page.Actions>
    </Page>
  );
}
