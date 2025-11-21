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

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";

import InitiatorSection from "./InitiatorSection";
import { ISCSIInitiator } from "~/storage";

let initiator: ISCSIInitiator;

const mockInitiatorMutation = { mutateAsync: jest.fn() };

jest.mock("~/queries/storage/iscsi", () => ({
  ...jest.requireActual("~/queries/storage/iscsi"),
  useInitiator: () => initiator,
  useInitiatorMutation: () => mockInitiatorMutation,
}));

describe("InitiatorPresenter", () => {
  describe("iBFT", () => {
    beforeEach(() => {
      initiator = { name: "iqn.1996-04.de.suse:01:62b45cf7fc", ibft: true };
    });

    it("displays the initiator data", () => {
      plainRender(<InitiatorSection />);
      screen.getByText(/read from.*iBFT/);
      screen.getByText(initiator.name);
    });
  });

  describe("without iBFT", () => {
    beforeEach(() => {
      initiator = { name: "iqn.1996-04.de.suse:01:62b45cf7fc", ibft: false };
    });

    it("displays the initiator form", () => {
      plainRender(<InitiatorSection />);
      screen.getByText(/No iSCSI Boot Firmware Table/);
      const name = screen.getByRole("textbox", { name: "Initiator name" });
      expect(name).toHaveValue(initiator.name);
    });

    it("updates the initiator data", async () => {
      const { user } = plainRender(<InitiatorSection />);

      const nameInput = screen.getByRole("textbox", { name: "Initiator name" });
      await user.clear(nameInput);
      await user.type(nameInput, "my-initiator");

      const button = screen.getByRole("button", { name: "Change" });
      await user.click(button);

      expect(mockInitiatorMutation.mutateAsync).toHaveBeenCalledWith({ name: "my-initiator" });
    });
  });
});
