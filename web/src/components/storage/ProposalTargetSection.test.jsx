/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { ProposalTargetSection } from "~/components/storage";

const calculateFn = jest.fn();
const proposal = {
  availableDevices: [
    { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
    { id: "/dev/sdb", label: "/dev/sdb, 1 TiB" }
  ],
  result : {
    candidateDevices: ["/dev/sda"],
    lvm: false
  }
};

describe("when there are no available devices", () => {
  it("renders an informative text", () => {
    installerRender(<ProposalTargetSection proposal={{ availableDevices: [] }} />);

    screen.getByText("No available devices");
  });
});

describe("when there are available devices", () => {
  it("renders the device selector", async () => {
    installerRender(<ProposalTargetSection proposal={proposal} calculateProposal={calculateFn} />);

    screen.getByRole("combobox", { name: "Storage device selector" });
  });

  it("triggers the proposal calculation when a device is selected", async () => {
    const calculateFn = jest.fn();

    const { user } = installerRender(<ProposalTargetSection proposal={proposal} calculateProposal={calculateFn} />);

    const devicesSelector = screen.getByRole("combobox", { name: "Storage device selector" });
    const sdbOption = screen.getByRole("option", { name: "/dev/sdb, 1 TiB" });
    await user.selectOptions(devicesSelector, sdbOption);

    expect(calculateFn).toHaveBeenCalled();
  });
});
