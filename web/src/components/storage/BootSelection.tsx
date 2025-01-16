/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { Form, FormGroup, Radio, Stack } from "@patternfly/react-core";
import { DevicesFormSelect } from "~/components/storage";
import { Page } from "~/components/core";
import { deviceLabel } from "~/components/storage/utils";
import { StorageDevice } from "~/types/storage";
import { useAvailableDevices } from "~/queries/storage";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { useBoot } from "~/queries/storage/config-model";

// FIXME: improve classNames
// FIXME: improve and rename to BootSelectionDialog

const BOOT_AUTO_ID = "boot-auto";
const BOOT_MANUAL_ID = "boot-manual";
const BOOT_DISABLED_ID = "boot-disabled";

type BootSelectionState = {
  load: boolean;
  selectedOption?: string;
  configureBoot?: boolean;
  bootDevice?: StorageDevice;
  defaultBootDevice?: StorageDevice;
  availableDevices?: StorageDevice[];
};

/**
 * Allows the user to select the boot configuration.
 */
export default function BootSelectionDialog() {
  const [state, setState] = useState<BootSelectionState>({ load: false });
  const availableDevices = useAvailableDevices();
  const navigate = useNavigate();
  const boot = useBoot();

  useEffect(() => {
    if (state.load) return;

    let selectedOption: string;

    if (!boot.configure) {
      selectedOption = BOOT_DISABLED_ID;
    } else if (boot.isDefault) {
      selectedOption = BOOT_AUTO_ID;
    } else {
      selectedOption = BOOT_MANUAL_ID;
    }

    const bootDevice = availableDevices.find((d) => d.name === boot.deviceName);
    const defaultBootDevice = boot.isDefault ? bootDevice : undefined;

    setState({
      load: true,
      bootDevice: bootDevice || availableDevices[0],
      configureBoot: boot.configure,
      defaultBootDevice,
      availableDevices,
      selectedOption,
    });
  }, [availableDevices, boot, state.load]);

  if (!state.load) return;

  const onSubmit = async (e) => {
    e.preventDefault();

    switch (state.selectedOption) {
      case BOOT_DISABLED_ID:
        boot.disable();
        break;
      case BOOT_AUTO_ID:
        boot.setDefault();
        break;
      default:
        boot.setDevice(state.bootDevice?.name);
    }

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

  const changeBootDevice = (v) => {
    setState({ ...state, bootDevice: v });
  };

  return (
    <Page>
      <Page.Header>
        <h2>{_("Boot options")}</h2>
        <p className={textStyles.textColorSubtle}>{description}</p>
      </Page.Header>

      <Page.Content>
        <Form id="bootSelectionForm" onSubmit={onSubmit}>
          <Page.Section aria-label={_("Select a boot option")}>
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
                    <div>{_("Partitions to boot will be allocated at the following device.")}</div>
                    <DevicesFormSelect
                      aria-label={_("Choose a disk for placing the boot loader")}
                      name="bootDevice"
                      devices={state?.availableDevices || []}
                      selectedDevice={state.bootDevice}
                      onChange={changeBootDevice}
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
          </Page.Section>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
        <Page.Submit form="bootSelectionForm" isDisabled={isAcceptDisabled()} />
      </Page.Actions>
    </Page>
  );
}
