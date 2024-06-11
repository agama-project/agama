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

// TODO: Improve it.

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Flex,
  Form, FormGroup,
  PageSection,
  Radio,
  Stack
} from "@patternfly/react-core";
import a11y from '@patternfly/react-styles/css/utilities/Accessibility/accessibility';

import { _ } from "~/i18n";
import { deviceChildren } from "~/components/storage/utils";
import { Loading } from "~/components/layout";
import { Page } from "~/components/core";
import { DeviceSelectorTable } from "~/components/storage";
import DevicesTechMenu from "./DevicesTechMenu";
import { compact, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const SELECT_DISK_ID = "select-disk";
const CREATE_LVM_ID = "create-lvm";
const SELECT_DISK_PANEL_ID = "panel-for-disk-selection";
const CREATE_LVM_PANEL_ID = "panel-for-lvm-creation";
const OPTIONS_NAME = "selection-mode";

/**
 * Allows the user to select a target device for installation.
 * @component
 */
export default function DeviceSelection() {
  const [state, setState] = useState({});
  const navigate = useNavigate();
  const { cancellablePromise } = useCancellablePromise();

  const isTargetDisk = state.target === "DISK";
  const isTargetNewLvmVg = state.target === "NEW_LVM_VG";
  const { storage: client } = useInstallerClient();

  const loadProposalResult = useCallback(async () => {
    return await cancellablePromise(client.proposal.getResult());
  }, [client, cancellablePromise]);

  const loadAvailableDevices = useCallback(async () => {
    return await cancellablePromise(client.proposal.getAvailableDevices());
  }, [client, cancellablePromise]);

  useEffect(() => {
    const load = async () => {
      const { settings } = await loadProposalResult();
      const availableDevices = await loadAvailableDevices();

      // FIXME: move to a state/reducer
      setState({
        load: true,
        availableDevices,
        target: settings.target,
        targetDevice: availableDevices.find(d => d.name === settings.targetDevice),
        targetPVDevices: availableDevices.filter(d => settings.targetPVDevices?.includes(d.name)),
      });
    };

    if (state.load) return;

    load().catch(console.error);
  }, [state, loadAvailableDevices, loadProposalResult]);

  if (!state.load) return <Loading text={_("Loading data, please wait a second...")} />;

  const selectTargetDisk = () => setState({ ...state, target: "DISK" });
  const selectTargetNewLvmVG = () => setState({ ...state, target: "NEW_LVM_VG" });

  const selectTargetDevice = (devices) => setState({ ...state, targetDevice: devices[0] });
  const selectTargetPVDevices = (devices) => {
    setState({ ...state, targetPVDevices: devices });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const { settings } = await loadProposalResult();
    const newSettings = {
      target: state.target,
      targetDevice: isTargetDisk ? state.targetDevice?.name : "",
      targetPVDevices: isTargetNewLvmVg ? state.targetPVDevices.map(d => d.name) : []
    };

    await client.proposal.calculate({ ...settings, ...newSettings });
    navigate("..");
  };

  const isAcceptDisabled = () => {
    if (isTargetDisk) return state.targetDevice === undefined;
    if (isTargetNewLvmVg) return state.targetPVDevices?.length === 0;

    return true;
  };

  const isDeviceSelectable = (device) => device.isDrive || device.type === "md";

  // TRANSLATORS: description for using plain partitions for installing the
  // system, the text in the square brackets [] is displayed in bold, use only
  // one pair in the translation
  const [msgStart1, msgBold1, msgEnd1] = _("The file systems will be allocated \
by default as [new partitions in the selected device].").split(/[[\]]/);
  // TRANSLATORS: description for using logical volumes for installing the
  // system, the text in the square brackets [] is displayed in bold, use only
  // one pair in the translation
  const [msgStart2, msgBold2, msgEnd2] = _("The file systems will be allocated \
by default as [logical volumes of a new LVM Volume Group]. The corresponding \
physical volumes will be created on demand as new partitions at the selected \
devices.").split(/[[\]]/);

  return (
    <>
      <PageSection variant="light" stickyOnBreakpoint={{ sm: "top" }}>
        <h2>{_("Select installation device")}</h2>
      </PageSection>
      <Page.MainContent>
        <Form id="targetSelection" onSubmit={onSubmit}>
          <Card isRounded>
            <CardBody>
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
            </CardBody>
          </Card>
          <Card isRounded>
            <CardBody>
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
                    devices={state.availableDevices}
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
                      devices={state.availableDevices}
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
            </CardBody>
          </Card>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="targetSelection" isDisabled={isAcceptDisabled()}>
          {_("Accept")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
