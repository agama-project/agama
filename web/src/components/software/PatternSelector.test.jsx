/*
 * Copyright (c) [2023] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import { createClient } from "~/client";

import test_patterns from "./PatternSelector.test.json";
import PatternSelector from "./PatternSelector";

jest.mock("~/client");
const selectedPatternsFn = jest.fn().mockResolvedValue([]);
const getUsedSpaceFn = jest.fn().mockResolvedValue("1 Gb");
const getIssuesFn = jest.fn().mockResolvedValue([]);
const patternsFn = jest.fn().mockResolvedValue(test_patterns);

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      software: {
        selectedPatterns: selectedPatternsFn,
        getUsedSpace: getUsedSpaceFn,
        getIssues: getIssuesFn,
        patterns: patternsFn
      },
    };
  });
});

const PatternItemMock = ({ pattern }) => <h3>{pattern.summary}</h3>;
jest.mock("~/components/software/PatternItem", () => ({ pattern }) => { return <PatternItemMock pattern={pattern} /> });

describe("PatternSelector", () => {
  it("displays a summary", async () => {
    installerRender(<PatternSelector />);
    const summarySection = await screen.findByRole("region", { name: /Software summary/ });
    within(summarySection).findByText(/Installation will take/);
  });

  it("displays an input for filtering", async () => {
    installerRender(<PatternSelector />);
    const summarySection = await screen.findByRole("region", { name: /Software summary/ });
    within(summarySection).getByRole("textbox", { name: "Search" });
  });

  it("displays the pattern groups in correct order", async () => {
    installerRender(<PatternSelector />);
    const headings = await screen.findAllByRole("heading", { level: 2 });
    const headingsText = headings.map(node => node.textContent);
    expect(headingsText).toEqual(["Documentation", "Base Technologies", "Development"]);
  });

  it("displays the patterns in a group in correct order", async () => {
    installerRender(<PatternSelector />);

    // the "Development" pattern group
    const develGroup = await screen.findByRole("region", { name: "Development" });

    // the "Development" pattern names
    const develPatternsHeadings = within(develGroup).getAllByRole("heading", { level: 3 });
    const develPatterns = develPatternsHeadings.map((node) => node.textContent);

    // sorted by order, the WSL pattern with empty order is the last one
    expect(develPatterns).toEqual(["Base Development", "C/C++ Development", "RPM Build Environment", "Base WSL packages"]);
  });

  it("displays only the matching patterns when using the search filter", async () => {
    const { user } = installerRender(<PatternSelector />);

    // enter "wsl" into the search filter
    const searchFilter = await screen.findByRole("textbox", { name: "Search" });
    await user.type(searchFilter, "wsl");

    // the "Development" pattern group
    const develGroup = screen.getByRole("region", { name: "Development" });

    // the "Development" pattern names
    const develPatternsHeadings = within(develGroup).getAllByRole("heading", { level: 3 });
    const develPatterns = develPatternsHeadings.map((node) => node.textContent);

    // only the WSL pattern is displayed
    expect(develPatterns).toEqual(["Base WSL packages"]);
  });
});
