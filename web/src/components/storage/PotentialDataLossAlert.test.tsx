/*
 * Copyright (c) [2026] SUSE LLC
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
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { STORAGE } from "~/routes/paths";
import PotentialDataLossAlert from "./PotentialDataLossAlert";

const mockUseDestructiveActionsFn: jest.Mock<ReturnType<typeof useDestructiveActions>> = jest.fn();

jest.mock("~/hooks/use-destructive-actions", () => ({
  useDestructiveActions: () => mockUseDestructiveActionsFn(),
}));

const deletePartitionAction = { device: 1, text: "Delete /dev/sda1", delete: true, subvol: false };
const resizeAction = { device: 2, text: "Resize /dev/sda2", delete: false, subvol: false };

describe("PotentialDataLossAlert", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when there are no destructive actions", () => {
    beforeEach(() => {
      mockUseDestructiveActionsFn.mockReturnValue({ actions: [], affectedSystems: [] });
    });

    it("renders nothing", () => {
      const { container } = installerRender(<PotentialDataLossAlert />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when there are destructive actions", () => {
    beforeEach(() => {
      mockUseDestructiveActionsFn.mockReturnValue({
        actions: [deletePartitionAction, resizeAction],
        affectedSystems: [],
      });
    });

    it("renders a generic data-loss headline", () => {
      installerRender(<PotentialDataLossAlert />);
      screen.getByText("Proceeding may result in data loss");
    });

    it("lists each destructive action", () => {
      installerRender(<PotentialDataLossAlert />);
      screen.getByText("Delete /dev/sda1");
      screen.getByText("Resize /dev/sda2");
    });

    it("offers a link that navigates to the storage section", () => {
      installerRender(<PotentialDataLossAlert />);

      const link = screen.getByRole("link", { name: "storage" });
      expect(link).toHaveAttribute("href", expect.stringContaining(STORAGE.root));
    });
  });

  describe("when existing systems will be wiped", () => {
    beforeEach(() => {
      mockUseDestructiveActionsFn.mockReturnValue({
        actions: [deletePartitionAction],
        affectedSystems: ["Windows", "openSUSE Tumbleweed"],
      });
    });

    it("names the affected systems in the headline", () => {
      installerRender(<PotentialDataLossAlert />);
      screen.getByText(/Proceeding will delete existing data, including .*Windows.*Tumbleweed/);
    });
  });
});
