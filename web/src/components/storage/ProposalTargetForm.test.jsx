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

import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { ProposalTargetForm } from "~/components/storage";

const proposal = {
  availableDevices: [
    { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
    { id: "/dev/sdb", label: "/dev/sdb, 650 GiB" }
  ],
  result: {
    candidateDevices: ["/dev/sda"]
  }
};
const onCallbackFn = jest.fn();

describe("ProposalTargetForm", () => {
  it("renders a selector for choosing candidate devices among available devices in given proposal", () => {
    installerRender(
      <ProposalTargetForm proposal={proposal} />
    );

    const deviceSelector = screen.getByRole("combobox");
    const availableDevices = within(deviceSelector).getAllByRole("option");
    expect(availableDevices.map(d => d.textContent)).toEqual(proposal.availableDevices.map(d => d.label));
  });

  describe("Selector for choosing candidate devices", () => {
    it("gets its initial value from given proposal", () => {
      installerRender(
        <ProposalTargetForm proposal={proposal} />
      );

      const deviceSelector = screen.getByRole("combobox");
      expect(deviceSelector).toHaveValue("/dev/sda");
    });

    it("changes its value when user changes the selection", async () => {
      const { user } = installerRender(
        <ProposalTargetForm proposal={proposal} />
      );

      let deviceSelector = screen.getByRole("combobox");
      const sdbOption = within(deviceSelector).getByRole("option", { name: "/dev/sdb, 650 GiB" });
      expect(deviceSelector).toHaveValue("/dev/sda");

      await user.selectOptions(deviceSelector, sdbOption);

      deviceSelector = screen.getByRole("combobox");
      expect(deviceSelector).toHaveValue("/dev/sdb");
    });
  });

  describe("#onChange", () => {
    it("executes given onChangeCallback function with selected candidate devices", async () => {
      const { user } = installerRender(
        <ProposalTargetForm id="the-form" proposal={proposal} onChangeCallback={onCallbackFn} />
      );

      const deviceSelector = screen.getByRole("combobox");
      const sdbOption = within(deviceSelector).getByRole("option", { name: "/dev/sdb, 650 GiB" });
      await user.selectOptions(deviceSelector, sdbOption);

      expect(onCallbackFn).toHaveBeenCalledWith({ candidateDevices: ["/dev/sdb"] });
    });
  });
});
