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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { InstallationPhase } from "~/types/status";
import { Issue, IssueSeverity, IssueSource } from "~/model/issue";
import IssuesDrawer from "./IssuesDrawer";

let phase = InstallationPhase.Config;
let mockIssuesList: Issue[];
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
      mockIssuesList = [];
    });

    itRendersNothing();
  });

  describe("when there are non-critical issues", () => {
    beforeEach(() => {
      mockIssuesList = [
        {
          description: "Registration Fake Warning",
          kind: "generic",
          source: IssueSource.Unknown,
          severity: IssueSeverity.Warn,
          details: "Registration Fake Issue details",
          scope: "product",
        },
      ];
    });

    itRendersNothing();
  });

  describe("when there are installation issues", () => {
    beforeEach(() => {
      mockIssuesList = [
        {
          description: "Registration Fake Issue",
          kind: "generic",
          source: IssueSource.Unknown,
          severity: IssueSeverity.Error,
          details: "Registration Fake Issue details",
          scope: "product",
        },
        {
          description: "Software Fake Issue",
          kind: "generic",
          source: IssueSource.Unknown,
          severity: IssueSeverity.Error,
          details: "Software Fake Issue details",
          scope: "software",
        },
        {
          description: "Storage Fake Issue 1",
          kind: "generic",
          source: IssueSource.Unknown,
          severity: IssueSeverity.Error,
          details: "Storage Fake Issue 1 details",
          scope: "storage",
        },
        {
          description: "Storage Fake Issue 2",
          kind: "generic",
          source: IssueSource.Unknown,
          severity: IssueSeverity.Error,
          details: "Storage Fake Issue 2 details",
          scope: "storage",
        },
        {
          description: "Users Fake Issue",
          kind: "generic",
          source: IssueSource.Unknown,
          severity: IssueSeverity.Error,
          details: "Users Fake Issue details",
          scope: "users",
        },
      ];
    });

    it("renders the drawer with categorized issues linking to their scope", async () => {
      const { user } = installerRender(<IssuesDrawer onClose={onCloseFn} />);

      const registrationIssues = screen.getByRole("region", { name: "Registration" });
      const softwareIssues = screen.getByRole("region", { name: "Software" });
      const storageIssues = screen.getByRole("region", { name: "Storage" });
      const usersIssues = screen.getByRole("region", { name: "Authentication" });

      const softwareLink = within(softwareIssues).getByRole("link", { name: "Software" });
      expect(softwareLink).toHaveAttribute("href", "/software");
      within(softwareIssues).getByText("Software Fake Issue");

      const storageLink = within(storageIssues).getByRole("link", { name: "Storage" });
      expect(storageLink).toHaveAttribute("href", "/storage");
      within(storageIssues).getByText("Storage Fake Issue 1");
      within(storageIssues).getByText("Storage Fake Issue 2");

      const usersLink = within(usersIssues).getByRole("link", { name: "Authentication" });
      expect(usersLink).toHaveAttribute("href", "/users");
      within(usersIssues).getByText("Users Fake Issue");

      // Regression test: right now, registration issues comes under product
      // scope. Check that it links to registration section anyway.
      const registrationLink = within(registrationIssues).getByRole("link", {
        name: "Registration",
      });
      expect(registrationLink).toHaveAttribute("href", "/registration");
      within(registrationIssues).getByText("Registration Fake Issue");

      // onClose should be called when user clicks on a section too for ensuring
      // drawer gets closed even when navigation is not needed.
      await user.click(usersLink);
      expect(onCloseFn).toHaveBeenCalled();

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
