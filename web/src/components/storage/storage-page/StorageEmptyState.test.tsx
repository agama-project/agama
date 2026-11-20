/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import StorageEmptyState from "~/components/storage/storage-page/StorageEmptyState";

const mockReset = jest.fn();
const mockDasd = jest.fn();
const mockZfcp = jest.fn();

jest.mock("~/hooks/model/config/storage", () => ({
  ...jest.requireActual("~/hooks/model/config/storage"),
  useReset: () => mockReset,
}));
jest.mock("~/hooks/model/system/dasd", () => ({
  ...jest.requireActual("~/hooks/model/system/dasd"),
  useSystem: () => mockDasd(),
}));
jest.mock("~/hooks/model/system/zfcp", () => ({
  ...jest.requireActual("~/hooks/model/system/zfcp"),
  useSystem: () => mockZfcp(),
}));
jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useActions: () => [],
}));
jest.mock("~/components/storage/storage-page/PlannedChangesPopup", () => () => (
  <div>the final layout and every action</div>
));

/** Everything that can be acted on is a tertiary button, or a link looking like one. */
const expectAllTertiary = () => {
  const actions = [...screen.queryAllByRole("button"), ...screen.queryAllByRole("link")];
  expect(actions.length).toBeGreaterThan(0);
  actions.forEach((a) => expect(a).toHaveClass("pf-m-tertiary"));
};

describe("StorageEmptyState", () => {
  beforeEach(() => {
    mockDasd.mockReturnValue(null);
    mockZfcp.mockReturnValue(null);
  });

  describe("when there are no devices", () => {
    it("says so and offers iSCSI", () => {
      installerRender(<StorageEmptyState state={{ kind: "noDevices" }} />);

      screen.getByRole("heading", { name: "No devices found" });
      screen.getByRole("link", { name: "Connect to iSCSI targets" });
      expect(screen.queryByRole("link", { name: "Activate zFCP disks" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Manage DASD devices" })).toBeNull();
      expectAllTertiary();
    });

    it("offers zFCP and DASD where the system has them", () => {
      mockDasd.mockReturnValue({});
      mockZfcp.mockReturnValue({});
      installerRender(<StorageEmptyState state={{ kind: "noDevices" }} />);

      screen.getByRole("link", { name: "Activate zFCP disks" });
      screen.getByRole("link", { name: "Manage DASD devices" });
      expectAllTertiary();
    });
  });

  describe("when the configuration is invalid", () => {
    it("lists the issues and offers to reset", async () => {
      const issues = [{ description: "Issue one" }, { description: "Issue two" }];
      // @ts-expect-error: only what is shown is given
      const { user } = installerRender(<StorageEmptyState state={{ kind: "invalid", issues }} />);

      screen.getByRole("heading", { name: "Invalid storage settings" });
      screen.getByText("Issue one");
      screen.getByText("Issue two");
      expectAllTertiary();
      await user.click(screen.getByRole("button", { name: "Reset to the default configuration" }));
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe("when the configuration is unknown and there is no layout", () => {
    it("offers to reset, and nothing to preview", async () => {
      const { user } = installerRender(
        <StorageEmptyState state={{ kind: "unknown", hasProposal: false }} />,
      );

      screen.getByRole("heading", { name: "Unable to modify the settings" });
      screen.getByText("The storage configuration uses elements not supported by this interface.");
      expect(document.querySelector(".pf-m-warning")).not.toBeNull();
      expect(screen.queryByRole("button", { name: "Preview result" })).toBeNull();
      expectAllTertiary();
      await user.click(screen.getByRole("button", { name: "Reset to the default configuration" }));
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe("when the configuration is unknown but a layout was calculated", () => {
    it("says it is not an error, and offers to preview the result and to reset", async () => {
      const { user } = installerRender(
        <StorageEmptyState state={{ kind: "unknown", hasProposal: true }} />,
      );

      screen.getByText(/correct and the installation can proceed/);
      expect(document.querySelector(".pf-m-info")).not.toBeNull();
      expect(document.querySelector(".pf-m-warning")).toBeNull();
      screen.getByRole("button", { name: "Reset to the default configuration" });
      expectAllTertiary();
      await user.click(screen.getByRole("button", { name: "Preview result" }));
      const popup = screen.getByRole("dialog", { name: "Planned storage changes" });
      within(popup).getByText("the final layout and every action");
      expect(document.querySelector(".agm-unseen-dot")).toBeNull();
    });
  });
});
