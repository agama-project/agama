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
import { screen } from "@testing-library/react";
import { installerRender, mockRoutes } from "~/test-utils";
import IssuesDrawerToggle from "./IssuesDrawerToggle";
import { InstallationPhase } from "~/types/status";
import { IssuesList } from "~/types/issues";

let phase = InstallationPhase.Config;
let mockIssuesList: IssuesList;
const onClickFn = jest.fn();

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
    const { container } = installerRender(
      <IssuesDrawerToggle isExpanded={false} onClick={onClickFn} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

describe("IssuesDrawerToggle", () => {
  describe("when there are no installation issues", () => {
    beforeEach(() => {
      mockIssuesList = new IssuesList([], [], [], []);
    });

    itRendersNothing();
  });

  describe("when there are installation issues", () => {
    beforeEach(() => {
      mockIssuesList = new IssuesList(
        [
          {
            description: "Fake Issue",
            source: 0,
            severity: 0,
            details: "Fake Issue details",
          },
        ],
        [],
        [],
        [],
      );
    });

    it("renders the toggle using given props", async () => {
      const { user } = installerRender(
        <IssuesDrawerToggle isExpanded onClick={onClickFn} label={"The issues drawer toggle"} />,
      );
      const toggle = screen.getByRole("button", { name: "The issues drawer toggle" });
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      await user.click(toggle);
      expect(onClickFn).toHaveBeenCalled();
    });

    describe("at install phase", () => {
      beforeEach(() => {
        phase = InstallationPhase.Install;
      });

      itRendersNothing();
    });

    describe("at config phase and /products/progress path", () => {
      beforeEach(() => {
        phase = InstallationPhase.Config;
        mockRoutes("/products/progress");
      });

      itRendersNothing();
    });

    describe("at config phase and /login path", () => {
      beforeEach(() => {
        phase = InstallationPhase.Config;
        mockRoutes("/login");
      });

      itRendersNothing();
    });
  });
});
