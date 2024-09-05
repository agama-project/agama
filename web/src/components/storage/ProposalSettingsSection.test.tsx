/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ProposalSettingsSection } from "~/components/storage";
import { ProposalTarget } from "~/types/storage";
import { ProposalSettingsSectionProps } from "./ProposalSettingsSection";

let props: ProposalSettingsSectionProps;

beforeEach(() => {
  props = {
    settings: {
      target: ProposalTarget.DISK,
      targetDevice: "/dev/sda",
      targetPVDevices: [],
      configureBoot: false,
      bootDevice: "",
      defaultBootDevice: "",
      encryptionPassword: "",
      encryptionMethod: "",
      spacePolicy: "delete",
      spaceActions: [],
      volumes: [],
      installationDevices: [],
    },
    availableDevices: [],
    volumeDevices: [],
    encryptionMethods: [],
    volumeTemplates: [],
    onChange: jest.fn(),
  };
});

it("allows changing the selected device", () => {
  plainRender(<ProposalSettingsSection {...props} />);
  const region = screen.getByRole("region", { name: "Installation device" });
  const link: HTMLAnchorElement = within(region).getByRole("link", { name: "Change" });
  expect(link.href).toMatch(/storage\/target-device/);
});

it("allows changing the encryption settings", async () => {
  const { user } = plainRender(<ProposalSettingsSection {...props} />);
  const region = screen.getByRole("region", { name: "Encryption" });
  const button = within(region).getByRole("button", { name: "Enable" });
  await user.click(button);
  await screen.findByRole("dialog", { name: "Encryption" });
});

it("renders a section holding file systems related stuff", () => {
  plainRender(<ProposalSettingsSection {...props} />);
  const region = screen.getByRole("region", { name: "Partitions and file systems" });
  expect(region).toBeInTheDocument();
});
