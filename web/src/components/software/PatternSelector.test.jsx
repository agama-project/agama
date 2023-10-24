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
import { act, screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import { createClient } from "~/client";

import test_patterns from "./PatternSelector.test.json";
import PatternSelector from "./PatternSelector";

jest.mock("~/client");
const selectedPatternsFn = jest.fn().mockResolvedValue([]);
const getUsedSpaceFn = jest.fn().mockResolvedValue();
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

const PatternItemMock = ({ pattern }) => <span>{pattern.summary}</span>;
jest.mock("~/components/software/PatternItem", () => ({ pattern }) => { return <PatternItemMock pattern={pattern} /> });

describe("PatternSelector", () => {
  it("displays the pattern groups in correct order", async () => {
    const { container } = await act(async () => installerRender(<PatternSelector />));
    const groups = Array.from(container.querySelectorAll("h2")).map((node) => node.textContent);

    expect(groups).toEqual(["Documentation", "Base Technologies", "Development"]);
  });

  it("displays the patterns in a group in correct order", async () => {
    await act(async () => installerRender(<PatternSelector />));

    // the "Development" pattern group
    const develGroup = screen.getByText("Development");
    // the "Development" pattern names
    const develPatterns = Array.from(develGroup.nextElementSibling.childNodes).map((node) => node.textContent);

    // sorted by order, the WSL pattern with empty order is the last one
    expect(develPatterns).toEqual(["Base Development", "C/C++ Development", "RPM Build Environment", "Base WSL packages"]);
  });

  it("displays only the matching patterns when using the search filter", async () => {
    const { user } = await act(async () => installerRender(<PatternSelector />));

    // enter "wsl" into the search filter
    const searchFilter = screen.getByPlaceholderText("Search");
    await user.type(searchFilter, "wsl");

    // the "Development" pattern group
    const develGroup = screen.getByText("Development");
    // the "Development" pattern names
    const develPatterns = Array.from(develGroup.nextElementSibling.childNodes).map((node) => node.textContent);

    // only the WSL pattern is displayed
    expect(develPatterns).toEqual(["Base WSL packages"]);
  });
});
