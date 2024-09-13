/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { OverviewPage } from "~/components/overview";
import { IssuesList } from "~/types/issues";
import { Product } from "~/types/software";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
};

const mockIssuesList = new IssuesList([], [], [], []);

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: () => ({ selectedProduct: tumbleweed }),
  useProductChanges: () => jest.fn(),
}));

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssuesChanges: () => jest.fn().mockResolvedValue(mockIssuesList),
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
});
