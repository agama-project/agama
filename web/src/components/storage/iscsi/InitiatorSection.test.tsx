/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { installerRender } from "~/test-utils";
import { STORAGE } from "~/routes/paths";
import InitiatorSection from "./InitiatorSection";

const ibftInitiator = { name: "iqn.1996-04.de.suse:01:62b45cf7fc", ibft: true };
const noIbftInitiator = { name: "iqn.1996-04.de.suse:01:62b45cf7fc", ibft: false };

const mockUseSystemFn = jest.fn();

jest.mock("~/hooks/model/system/iscsi", () => ({
  ...jest.requireActual("~/hooks/model/system/iscsi"),
  useSystem: () => mockUseSystemFn(),
}));

describe("InitiatorSection", () => {
  beforeEach(() => {
    mockUseSystemFn.mockReturnValue({
      initiator: ibftInitiator,
    });
  });

  it("renders the initiator name", () => {
    installerRender(<InitiatorSection />);
    screen.getByText(ibftInitiator.name);
  });

  describe("when read from iBFT", () => {
    it("does not render a link to configure it when read from iBFT", () => {
      installerRender(<InitiatorSection />);
      screen.getByText(/read from.*iBFT/);
      screen.getByText(/Initiator cannot be changed/);
      expect(screen.queryByRole("link", { name: /configured manually/ })).toBeNull();
    });
  });

  describe("when not read from iBFT", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({
        initiator: noIbftInitiator,
      });
    });

    it("renders a link to configure the target", () => {
      installerRender(<InitiatorSection />);
      const link = screen.getByRole("link", { name: /configured manually/ });
      expect(link).toHaveAttribute("href", STORAGE.iscsi.initiator);
    });
  });
});
