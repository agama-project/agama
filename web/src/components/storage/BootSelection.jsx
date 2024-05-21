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
import { useNavigate } from "react-router-dom";
import { Form, FormGroup, Radio } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { DevicesFormSelect } from "~/components/storage";
import { Page } from "~/components/core";
import { Loading } from "~/components/layout";
import { deviceLabel } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const BOOT_AUTO_ID = "boot-auto";
const BOOT_MANUAL_ID = "boot-manual";
const BOOT_DISABLED_ID = "boot-disabled";
const OPTIONS_NAME = "boot-mode";

/**
 * Allows the user to select the boot configuration.
 */
export default function BootSelectionDialog() {
  const { cancellablePromise } = useCancellablePromise();
  const { storage: client } = useInstallerClient();
  const [state, setState] = useState({});
  const navigate = useNavigate();

  // FIXME: Repeated code, see DeviceSelection. Use a context/hook or whatever
  // approach to avoid duplication
  const loadProposalResult = useCallback(async () => {
    return await cancellablePromise(client.proposal.getResult());
  }, [client, cancellablePromise]);

  const loadAvailableDevices = useCallback(async () => {
    return await cancellablePromise(client.proposal.getAvailableDevices());
  }, [client, cancellablePromise]);

  useEffect(() => {
    if (state.load) return;

    const load = async () => {
      let selectedOption;
      const { settings } = await loadProposalResult();
      const availableDevices = await loadAvailableDevices();
      const { bootDevice, configureBoot, defaultBootDevice } = settings;

      console.log(settings);

      if (!configureBoot) {
        selectedOption = BOOT_DISABLED_ID;
      } else if (configureBoot && bootDevice === "") {
        selectedOption = BOOT_AUTO_ID;
      } else {
        selectedOption = BOOT_MANUAL_ID;
      }

      setState({
        load: true,
        bootDevice: availableDevices.find(d => d.name === bootDevice),
        configureBoot,
        defaultBootDevice,
        availableDevices,
        selectedOption
      });
    };

    load().catch(console.error);
  }, [state, loadAvailableDevices, loadProposalResult]);

  if (!state.load) return <Loading />;

  const onSubmit = async (e) => {
    e.preventDefault();
    // FIXME: try to use formData here too?
    // const formData = new FormData(e.target);
    // const mode = formData.get("bootMode");
    // const device = formData.get("bootDevice");
    const { settings } = await loadProposalResult();
    const newSettings = {
      configureBoot: state.selectedOption !== BOOT_DISABLED_ID,
      bootDevice: state.selectedOption === BOOT_MANUAL_ID ? state.bootDevice.name : undefined,
    };

    console.log("newSettings", newSettings);

    await client.proposal.calculate({ ...settings, ...newSettings });
    navigate("..");
  };

  const isAcceptDisabled = () => {
    return state.selectedOption === BOOT_MANUAL_ID && state.bootDevice === undefined;
  };

  const description = _(
    "To ensure the new system is able to boot, the installer may need to create or configure some \
partitions in the appropriate disk."
  );

  const automaticText = () => {
    if (!state.defaultBootDevice) {
      return _("Partitions to boot will be allocated at the installation disk.");
    }

    return sprintf(
      // TRANSLATORS: %s is replaced by a device name and size (e.g., "/dev/sda, 500GiB")
      _("Partitions to boot will be allocated at the installation disk (%s)."),
      deviceLabel(state.defaultBootDevice)
    );
  };

  const updateSelectedOption = (e) => {
    setState({ ...state, selectedOption: e.target.value });
  };

  const setBootDevice = (v) => {
    setState({ ...state, bootDevice: v });
  };

  return (
    <>
      <Page.MainContent>
        <Form id="bootSelectionForm" onSubmit={onSubmit}>
          {description}
          <FormGroup isStack>
            <Radio
              name="bootMode"
              id={BOOT_AUTO_ID}
              value={BOOT_AUTO_ID}
              defaultChecked={state.selectedOption === BOOT_AUTO_ID}
              onChange={updateSelectedOption}
              label={_("Automatic")}
              body={automaticText()}
            />
            <Radio
              name="bootMode"
              id={BOOT_MANUAL_ID}
              value={BOOT_MANUAL_ID}
              defaultChecked={state.selectedOption === BOOT_MANUAL_ID}
              onChange={updateSelectedOption}
              label={_("Select a disk")}
              body={
                <div className="stack">
                  <div>
                    {_("Partitions to boot will be allocated at the following device.")}
                  </div>
                  <DevicesFormSelect
                    aria-label={_("Choose a disk for placing the boot loader")}
                    name="bootDevice"
                    devices={state?.availableDevices || []}
                    selectedDevice={state.bootDevice}
                    onChange={setBootDevice}
                    isDisabled={state.selectedOption !== BOOT_MANUAL_ID}
                  />
                </div>
              }
            />
            <Radio
              name="bootMode"
              id={BOOT_DISABLED_ID}
              value={BOOT_DISABLED_ID}
              defaultChecked={state.selectedOption === BOOT_DISABLED_ID}
              onChange={updateSelectedOption}
              label={_("Do not configure")}
              body={
                <div>
                  {_("No partitions will be automatically configured for booting. Use with caution.")}
                </div>
              }
            />
          </FormGroup>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action isDisabled={isAcceptDisabled()} type="submit" form="bootSelectionForm">
          {_("Accept")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
