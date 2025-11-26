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
import { useLocation, useNavigate } from "react-router";
import { ActionGroup, Content, Form, FormGroup, Radio, Stack } from "@patternfly/react-core";
import { DevicesFormSelect } from "~/components/storage";
import { Page, SubtleContent } from "~/components/core";
import { deviceLabel, formattedPath } from "~/components/storage/utils";
import { useCandidateDevices, useDevices } from "~/hooks/api/system/storage";
import { useModel } from "~/hooks/storage/model";
import { isDrive } from "~/storage/device";
import {
  useSetBootDevice,
  useSetDefaultBootDevice,
  useDisableBootConfig,
} from "~/hooks/storage/boot";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import type { storage } from "~/api/system";
import type { Model } from "~/storage/model";

const filteredCandidates = (candidates: storage.Device[], model: Model): storage.Device[] => {
  return candidates.filter((candidate) => {
    const collection = isDrive(candidate) ? model.drives : model.mdRaids;
    const device = collection.find((d) => d.name === candidate.name);
    return !device || !device.filesystem;
  });
};

// FIXME: improve classNames
// FIXME: improve and rename to BootSelectionDialog

const BOOT_AUTO_ID = "boot-auto";
const BOOT_MANUAL_ID = "boot-manual";
const BOOT_DISABLED_ID = "boot-disabled";

type BootSelectionState = {
  load: boolean;
  selectedOption?: string;
  configureBoot?: boolean;
  bootDevice?: storage.Device;
  defaultBootDevice?: storage.Device;
  candidateDevices?: storage.Device[];
};

/**
 * Allows the user to select the boot configuration.
 */
export default function BootSelection() {
  const location = useLocation();
  const [state, setState] = useState<BootSelectionState>({ load: false });
  const navigate = useNavigate();
  const devices = useDevices();
  const model = useModel();
  const candidateDevices = filteredCandidates(useCandidateDevices(), model);
  const setBootDevice = useSetBootDevice();
  const setDefaultBootDevice = useSetDefaultBootDevice();
  const disableBootConfig = useDisableBootConfig();

  useEffect(() => {
    if (state.load || !model) return;

    const boot = model.boot;
    let selectedOption: string;

    if (!boot.configure) {
      selectedOption = BOOT_DISABLED_ID;
    } else if (boot.isDefault) {
      selectedOption = BOOT_AUTO_ID;
    } else {
      selectedOption = BOOT_MANUAL_ID;
    }

    const bootDevice = devices.find((d) => d.name === boot.getDevice()?.name);
    const defaultBootDevice = boot.isDefault ? bootDevice : undefined;
    let candidates = [...candidateDevices];
    // Add the current boot device if it does not belong to the candidate devices.
    if (bootDevice && !candidates.includes(bootDevice)) {
      candidates = [bootDevice, ...candidates];
    }

    setState({
      load: true,
      bootDevice: bootDevice || candidateDevices[0],
      configureBoot: boot.configure,
      defaultBootDevice,
      candidateDevices: candidates,
      selectedOption,
    });
  }, [devices, candidateDevices, model, state.load]);

  if (!state.load || !model) return;

  const onSubmit = async (e) => {
    e.preventDefault();

    switch (state.selectedOption) {
      case BOOT_DISABLED_ID:
        disableBootConfig();
        break;
      case BOOT_AUTO_ID:
        setDefaultBootDevice();
        break;
      default:
        setBootDevice(state.bootDevice?.name);
    }

    navigate({ pathname: "..", search: location.search });
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
      return sprintf(
        // TRANSLATORS: %s is replaced by the formatted path of the root file system (eg. "/")
        _(
          "Partitions to boot will be set up if needed at the installation disk, \
          based on the location of the %s file system.",
        ),
        formattedPath("/"),
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is replaced by a device name and size (e.g., sda (500GiB)), %2$s is
      // replaced by the formatted path of the root file system (eg. "/")
      _(
        "Partitions to boot will be set up if needed at the installation disk. \
        Currently %1$s, based on the location of the %2$s file system.",
      ),
      deviceLabel(state.defaultBootDevice),
      formattedPath("/"),
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
        <Content component="h2">{_("Boot options")}</Content>
        <SubtleContent>{description}</SubtleContent>
      </Page.Header>

      <Page.Content>
        <Form id="bootSelectionForm" onSubmit={onSubmit}>
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
                  <p>{_("Partitions to boot will be set up if needed at the following device.")}</p>
                  <DevicesFormSelect
                    aria-label={_("Choose a disk for placing the boot loader")}
                    name="bootDevice"
                    devices={state?.candidateDevices || []}
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
          <ActionGroup>
            <Page.Submit form="bootSelectionForm" isDisabled={isAcceptDisabled()} />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
