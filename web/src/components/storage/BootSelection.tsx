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
import { Card, CardBody, Form, FormGroup, Radio, Stack } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { DevicesFormSelect } from "~/components/storage";
import { Page } from "~/components/core";
import { deviceLabel } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { StorageDevice } from "~/types/storage";
import { useAvailableDevices, useProposalMutation, useProposalResult } from "~/queries/storage";

// FIXME: improve classNames
// FIXME: improve and rename to BootSelectionDialog

const BOOT_AUTO_ID = "boot-auto";
const BOOT_MANUAL_ID = "boot-manual";
const BOOT_DISABLED_ID = "boot-disabled";

/**
 * Allows the user to select the boot configuration.
 */
export default function BootSelectionDialog() {
  type BootSelectionState = {
    load: boolean;
    selectedOption?: string;
    configureBoot?: boolean;
    bootDevice?: StorageDevice;
    defaultBootDevice?: StorageDevice;
    availableDevices?: StorageDevice[];
  };

  const [state, setState] = useState<BootSelectionState>({ load: false });
  const { settings } = useProposalResult();
  const availableDevices = useAvailableDevices();
  const updateProposal = useProposalMutation();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.load) return;

    let selectedOption: string;
    const { bootDevice, configureBoot, defaultBootDevice } = settings;

    if (!configureBoot) {
      selectedOption = BOOT_DISABLED_ID;
    } else if (configureBoot && bootDevice === "") {
      selectedOption = BOOT_AUTO_ID;
    } else {
      selectedOption = BOOT_MANUAL_ID;
    }

    const findDevice = (name: string) => availableDevices.find((d) => d.name === name);

    setState({
      load: true,
      bootDevice: findDevice(bootDevice) || findDevice(defaultBootDevice) || availableDevices[0],
      configureBoot,
      defaultBootDevice: findDevice(defaultBootDevice),
      availableDevices,
      selectedOption,
    });
  }, [availableDevices, settings]);

  if (!state.load) return;

  const onSubmit = async (e) => {
    e.preventDefault();
    // FIXME: try to use formData here too?
    // const formData = new FormData(e.target);
    // const mode = formData.get("bootMode");
    // const device = formData.get("bootDevice");
    const newSettings = {
      configureBoot: state.selectedOption !== BOOT_DISABLED_ID,
      bootDevice: state.selectedOption === BOOT_MANUAL_ID ? state.bootDevice.name : undefined,
    };

    await updateProposal.mutateAsync({ ...settings, ...newSettings });
    navigate("..");
  };

  const isAcceptDisabled = () => {
    return state.selectedOption === BOOT_MANUAL_ID && state.bootDevice === undefined;
  };

  const description = _(
    "To ensure the new system is able to boot, the installer may need to create or configure some \
partitions in the appropriate disk.",
  );

  const automaticText = () => {
    if (!state.defaultBootDevice) {
      return _("Partitions to boot will be allocated at the installation disk.");
    }

    return sprintf(
      // TRANSLATORS: %s is replaced by a device name and size (e.g., "/dev/sda, 500GiB")
      _("Partitions to boot will be allocated at the installation disk (%s)."),
      deviceLabel(state.defaultBootDevice),
    );
  };

  const updateSelectedOption = (e) => {
    setState({ ...state, selectedOption: e.target.value });
  };

  const setBootDevice = (v) => {
    setState({ ...state, bootDevice: v });
  };

  return (
    <Page>
      <Page.Header>
        <h2>{_("Select booting partition")}</h2>
        <p className={textStyles.color_400}>{description}</p>
      </Page.Header>
      <Page.MainContent>
        <Form id="bootSelectionForm" onSubmit={onSubmit}>
          <Card isRounded>
            <CardBody>
              <FormGroup isStack>
                <Radio
                  name="bootMode"
                  id={BOOT_AUTO_ID}
                  value={BOOT_AUTO_ID}
                  defaultChecked={state.selectedOption === BOOT_AUTO_ID}
                  onChange={updateSelectedOption}
                  label={
                    <span
                      className={[
                        textStyles.fontSizeLg,
                        state.selectedOption === BOOT_AUTO_ID && textStyles.fontWeightBold,
                      ].join(" ")}
                    >
                      {_("Automatic")}
                    </span>
                  }
                  body={automaticText()}
                />
                <Radio
                  name="bootMode"
                  id={BOOT_MANUAL_ID}
                  value={BOOT_MANUAL_ID}
                  defaultChecked={state.selectedOption === BOOT_MANUAL_ID}
                  onChange={updateSelectedOption}
                  label={
                    <span
                      className={[
                        textStyles.fontSizeLg,
                        state.selectedOption === BOOT_MANUAL_ID && textStyles.fontWeightBold,
                      ].join(" ")}
                    >
                      {_("Select a disk")}
                    </span>
                  }
                  body={
                    <Stack hasGutter>
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
                    </Stack>
                  }
                />
                <Radio
                  name="bootMode"
                  id={BOOT_DISABLED_ID}
                  value={BOOT_DISABLED_ID}
                  defaultChecked={state.selectedOption === BOOT_DISABLED_ID}
                  onChange={updateSelectedOption}
                  label={
                    <span
                      className={[
                        textStyles.fontSizeLg,
                        state.selectedOption === BOOT_DISABLED_ID && textStyles.fontWeightBold,
                      ].join(" ")}
                    >
                      {_("Do not configure")}
                    </span>
                  }
                  body={
                    <div>
                      {_(
                        "No partitions will be automatically configured for booting. Use with caution.",
                      )}
                    </div>
                  }
                />
              </FormGroup>
            </CardBody>
          </Card>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action isDisabled={isAcceptDisabled()} type="submit" form="bootSelectionForm">
          {_("Accept")}
        </Page.Action>
      </Page.NextActions>
    </Page>
  );
}
