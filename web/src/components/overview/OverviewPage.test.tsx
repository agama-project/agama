/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { OverviewPage } from "~/components/overview";
import { IssuesList } from "~/types/issues";
import { Product } from "~/types/software";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
};

let mockIssuesList: IssuesList = new IssuesList([], [], [], []);

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: () => ({ selectedProduct: tumbleweed }),
  useProductChanges: () => jest.fn(),
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssuesChanges: () => jest.fn().mockResolvedValue(mockIssuesList),
  useAllIssues: () => mockIssuesList,
}));

jest.mock("~/components/overview/L10nSection", () => () => <div>Localization Section</div>);
jest.mock("~/components/overview/StorageSection", () => () => <div>Storage Section</div>);
jest.mock("~/components/overview/SoftwareSection", () => () => <div>Software Section</div>);
jest.mock("~/components/core/InstallButton", () => () => <div>Install Button</div>);

describe("when a product is selected", () => {
  it("renders the overview page content and the Install button", async () => {
    installerRender(<OverviewPage />);
    screen.findByText("Localization Section");
    screen.findByText("Storage Section");
    screen.findByText("Software Section");
    screen.findByText("Install Button");
  });

  it("renders found issues, if any", () => {});
});

describe("when there are issues", () => {
  beforeEach(() => {
    mockIssuesList = new IssuesList(
      [
        {
          description: "Fake Issue",
          details: "Fake Issue details",
          source: 0,
          severity: 1,
        },
      ],
      [],
      [],
      [],
    );
  });

  it("renders the issues section", () => {
    installerRender(<OverviewPage />);
    screen.findByText("Installation blocking issues");
    screen.findByText("Fake Issue");
    screen.findByText("Fake Issue details");
  });
});

describe("when there are no issues", () => {
  beforeEach(() => {
    mockIssuesList = new IssuesList([], [], [], []);
  });

  it("does not render the issues section", () => {
    installerRender(<OverviewPage />);
    expect(screen.queryByText("Installation blocking issues")).toBeNull();
  });
});
