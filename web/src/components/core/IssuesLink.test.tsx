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
import { IssuesLink } from "~/components/core";
import { IssuesList } from "~/types/issues";
import { PRODUCT as PATHS } from "~/routes/paths";

const mockStartInstallationFn = jest.fn();
let mockIssuesList: IssuesList;

jest.mock("~/api/manager", () => ({
  ...jest.requireActual("~/api/manager"),
  startInstallation: () => mockStartInstallationFn(),
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useAllIssues: () => mockIssuesList,
}));

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

  it("renders the issues link", () => {
    installerRender(<IssuesLink />);
    screen.getByRole("link", { name: "Installation issues" });
  });

  describe("but installer is rendering the product selection", () => {
    beforeEach(() => {
      mockRoutes(PATHS.changeProduct);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<IssuesLink />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("but installer is configuring the product", () => {
    beforeEach(() => {
      mockRoutes(PATHS.progress);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<IssuesLink />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

describe("when there are no installation issues", () => {
  beforeEach(() => {
    mockIssuesList = new IssuesList([], [], [], []);
  });

  it("renders nothing", () => {
    const { container } = installerRender(<IssuesLink />);
    expect(container).toBeEmptyDOMElement();
  });
});
