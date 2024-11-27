/*
 * Copyright (c) [2024] SUSE LLC
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
import { InstallationPhase } from "~/types/status";
import { IssuesList } from "~/types/issues";
import IssuesDrawer from "./IssuesDrawer";

let phase = InstallationPhase.Config;
let mockIssuesList: IssuesList;
const onCloseFn = jest.fn();

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useAllIssues: () => mockIssuesList,
}));

jest.mock("~/queries/status", () => ({
  useInstallerStatus: () => ({
    phase,
  }),
}));

const itRendersNothing = () =>
  it("renders nothing", () => {
    const { container } = installerRender(<IssuesDrawer onClose={onCloseFn} />);
    expect(container).toBeEmptyDOMElement();
  });

describe("IssuesDrawer", () => {
  describe("when there are no installation issues", () => {
    beforeEach(() => {
      mockIssuesList = new IssuesList([], [], [], []);
    });

    itRendersNothing();
  });

  describe("when there are installation issues", () => {
    beforeEach(() => {
      mockIssuesList = new IssuesList(
        [],
        [
          {
            description: "Software Fake Issue",
            source: 0,
            severity: 0,
            details: "Software Fake Issue details",
          },
        ],
        [
          {
            description: "Storage Fake Issue 1",
            source: 0,
            severity: 0,
            details: "Storage Fake Issue 1 details",
          },
          {
            description: "Storage Fake Issue 2",
            source: 0,
            severity: 0,
            details: "Storage Fake Issue 2 details",
          },
        ],
        [
          {
            description: "Users Fake Issue",
            source: 0,
            severity: 0,
            details: "Users Fake Issue details",
          },
        ],
      );
    });

    it("renders the drawer with categorized issues linking to their scope", async () => {
      const { user } = installerRender(<IssuesDrawer onClose={onCloseFn} />);

      const softwareIssues = screen.getByRole("region", { name: "Software" });
      const storageIssues = screen.getByRole("region", { name: "Storage" });
      const usersIssues = screen.getByRole("region", { name: "Users" });

      const softwareLink = within(softwareIssues).getByRole("link", { name: "Software" });
      expect(softwareLink).toHaveAttribute("href", "/software");
      within(softwareIssues).getByText("Software Fake Issue");

      const storageLink = within(storageIssues).getByRole("link", { name: "Storage" });
      expect(storageLink).toHaveAttribute("href", "/storage");
      within(storageIssues).getByText("Storage Fake Issue 1");
      within(storageIssues).getByText("Storage Fake Issue 2");

      const usersLink = within(usersIssues).getByRole("link", { name: "Users" });
      expect(usersLink).toHaveAttribute("href", "/users");
      within(usersIssues).getByText("Users Fake Issue");

      const closeButton = screen.getByRole("button", { name: "Close" });
      await user.click(closeButton);
      expect(onCloseFn).toHaveBeenCalled();
    });

    describe("at install phase", () => {
      beforeEach(() => {
        phase = InstallationPhase.Install;
      });

      itRendersNothing();
    });
  });
});
