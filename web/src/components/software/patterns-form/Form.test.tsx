/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { patchConfig } from "~/api";
import testingPatterns from "./patterns.test.json";
import testingProposal from "./proposal.test.json";
import SoftwarePatternsSelection from "./Form";

/**
 * Accessible labels of the checkboxes inside a container, in DOM order.
 *
 * Reads each checkbox's associated `<label>` text, so it is agnostic to the
 * checkbox id scheme (ids are not the pattern name).
 */
const checkboxLabelsIn = (container: HTMLElement): string[] =>
  within(container)
    .getAllByRole("checkbox")
    .map(
      (checkbox) =>
        container.querySelector(`label[for="${checkbox.id}"]`)?.textContent?.trim() ?? "",
    );

const patternsWithPreselected = [
  ...testingPatterns,
  {
    name: "preselected_pattern",
    category: "Base Technologies",
    icon: "./pattern-base",
    description: "A pattern preselected by the product",
    summary: "Preselected Pattern",
    order: "1225",
    preselected: true,
    desktop: false,
  },
];

const desktops = patternsWithPreselected.filter((p) => p.desktop);
const other = patternsWithPreselected.filter((p) => !p.desktop);

const mockAvailablePatterns = jest.fn();

jest.mock("~/hooks/model/system/software", () => ({
  useAvailablePatterns: () => mockAvailablePatterns(),
}));

jest.mock("~/hooks/model/proposal/software", () => ({
  useProposal: () => ({
    patterns: {
      ...testingProposal.patterns,
      preselected_pattern: "auto",
      kde: "removed",
    },
  }),
}));

jest.mock("~/api", () => ({
  patchConfig: jest.fn(),
}));

describe("SoftwarePatternsSelection", () => {
  beforeEach(() => {
    mockAvailablePatterns.mockReturnValue({
      all: patternsWithPreselected,
      desktops,
      other,
    });
  });

  it("renders one h3 per category, in order", async () => {
    installerRender(<SoftwarePatternsSelection />);
    const headings = await screen.findAllByRole("heading", { level: 3 });
    const headingsText = headings.map((node) => node.textContent);
    expect(headingsText[0]).toMatch(/^Graphical Environments/);
    expect(headingsText[1]).toMatch(/^Base Technologies/);
    expect(headingsText[2]).toMatch(/^Desktop Functions/);
    expect(headings).toHaveLength(3);
  });

  it("exposes each category as a group labelled by its heading", async () => {
    installerRender(<SoftwarePatternsSelection />);
    const groups = await screen.findAllByRole("group");
    expect(groups).toHaveLength(3);
    // Each category checkbox set is reachable as a group labelled by its name.
    screen.getByRole("group", { name: /Graphical Environments/ });
    screen.getByRole("group", { name: /Base Technologies/ });
    screen.getByRole("group", { name: /Desktop Functions/ });
  });

  it("lets the user pick the right pattern when two categories share a label", async () => {
    // Two distinct patterns (different name) that look identical (same summary)
    // but live in different categories. The category group is what tells them
    // apart for a screen reader and for scoped queries.
    const sharedSummary = "Shared Tooling";
    const lookalikePatterns = [
      {
        name: "shared_in_base",
        category: "Base Technologies",
        icon: "./pattern-base",
        description: "Shared tooling under base technologies",
        summary: sharedSummary,
        order: "1000",
        preselected: false,
        desktop: false,
      },
      {
        name: "shared_in_desktop",
        category: "Desktop Functions",
        icon: "./pattern-desktop",
        description: "Shared tooling under desktop functions",
        summary: sharedSummary,
        order: "1000",
        preselected: false,
        desktop: false,
      },
    ];
    mockAvailablePatterns.mockReturnValue({
      all: lookalikePatterns,
      desktops: [],
      other: lookalikePatterns,
    });

    const { user } = installerRender(<SoftwarePatternsSelection />);

    const baseGroup = await screen.findByRole("group", { name: /Base Technologies/ });
    const desktopGroup = screen.getByRole("group", { name: /Desktop Functions/ });

    // Same accessible label in both groups, yet each is uniquely reachable.
    const baseCheckbox = within(baseGroup).getByRole("checkbox", { name: sharedSummary });
    const desktopCheckbox = within(desktopGroup).getByRole("checkbox", { name: sharedSummary });
    expect(baseCheckbox).not.toBe(desktopCheckbox);

    // Picking the one under Base Technologies leaves the other untouched.
    await user.click(baseCheckbox);
    expect(baseCheckbox).toBeChecked();
    expect(desktopCheckbox).not.toBeChecked();
  });

  it("stays valid when the backend lists the same pattern under several categories", async () => {
    // Defensive: listing the same pattern name under several categories is not an
    // expected or supported scenario, but the UI must not break if it ever does.
    //
    // A single pattern (same name) reported under two categories. The backend
    // selects patterns by name, so both entries represent the same selection;
    // each must still render with a unique id and a correctly associated label
    // (no clashing ids, no broken label targeting).
    const duplicatedPattern = (category: string) => ({
      name: "shared_pattern",
      category,
      icon: "./pattern-shared",
      description: `Shared pattern listed under ${category}`,
      summary: "Shared Pattern",
      order: "1000",
      preselected: false,
      desktop: false,
    });
    const patterns = [
      duplicatedPattern("Base Technologies"),
      duplicatedPattern("Desktop Functions"),
    ];
    mockAvailablePatterns.mockReturnValue({ all: patterns, desktops: [], other: patterns });

    const { user } = installerRender(<SoftwarePatternsSelection />);

    const baseGroup = await screen.findByRole("group", { name: /Base Technologies/ });
    const desktopGroup = screen.getByRole("group", { name: /Desktop Functions/ });
    const baseCheckbox = within(baseGroup).getByRole("checkbox", { name: "Shared Pattern" });
    const desktopCheckbox = within(desktopGroup).getByRole("checkbox", { name: "Shared Pattern" });

    // Distinct DOM nodes with distinct ids despite the shared pattern name.
    expect(baseCheckbox.id).not.toEqual(desktopCheckbox.id);

    // They back the same pattern, so toggling one reflects in both.
    await user.click(baseCheckbox);
    expect(baseCheckbox).toBeChecked();
    expect(desktopCheckbox).toBeChecked();
  });

  it("renders each category containing its patterns in order", async () => {
    installerRender(<SoftwarePatternsSelection />);

    const baseGroup = await screen.findByRole("group", { name: /Base Technologies/ });
    // Order is driven by the `order` field on each pattern.
    expect(checkboxLabelsIn(baseGroup)).toEqual([
      "YaST Base Utilities",
      "YaST Desktop Utilities",
      "YaST Server Utilities",
      "Preselected Pattern",
    ]);
  });

  it("sorts patterns by their order field within each category", async () => {
    installerRender(<SoftwarePatternsSelection />);

    const graphicalGroup = await screen.findByRole("group", { name: /Graphical Environments/ });
    // gnome (1010), kde (1110), xfce (1310), basic_desktop (1802)
    expect(checkboxLabelsIn(graphicalGroup)).toEqual([
      "GNOME Desktop Environment (Wayland)",
      "KDE Applications and Plasma 5 Desktop",
      "XFCE Desktop Environment",
      "A very basic desktop (previously part of x11 pattern)",
    ]);

    const desktopGroup = screen.getByRole("group", { name: /Desktop Functions/ });
    // multimedia (1580), office (1640)
    expect(checkboxLabelsIn(desktopGroup)).toEqual(["Multimedia", "Office Software"]);
  });

  it("renders a search input with placeholder and accessible name", async () => {
    installerRender(<SoftwarePatternsSelection />);
    // The textbox has an aria-label for screen readers
    const searchInput = await screen.findByRole("textbox", {
      name: /Filter by name and description/,
    });
    // And a placeholder for sighted users
    expect(searchInput).toHaveAttribute("placeholder", "Filter by name and description");
  });

  it("shows a per-category 'X of Y selected' counter", async () => {
    installerRender(<SoftwarePatternsSelection />);
    // 3 of 4 in Base Technologies are auto-selected in the mock proposal
    // (yast2_basis, yast2_desktop, preselected_pattern); yast2_server is "none".
    await screen.findByText(/3 of 4 selected/);
  });

  it("updates the counter live as the user toggles a checkbox", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection />);

    await screen.findByText(/3 of 4 selected/);

    const serverCheckbox = screen.getByRole("checkbox", { name: /YaST Server/ });
    await user.click(serverCheckbox);

    screen.getByText(/4 of 4 selected/);
  });

  it("toggles the checkbox when the user clicks its label", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection />);

    const checkbox = await screen.findByRole("checkbox", { name: /YaST Server/ });
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByText(/YaST Server Utilities/));
    expect(checkbox).toBeChecked();
  });

  it("hides the 'auto selected' label on an AUTO pattern once the user touches it", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection />);
    const y2BasisPattern = testingPatterns.find((p) => p.name === "yast2_basis");

    const basisCheckbox = await screen.findByRole("checkbox", {
      name: y2BasisPattern.summary,
    });

    // 5 patterns are AUTO in the mock: yast2_basis, yast2_desktop, office,
    // multimedia, and preselected_pattern.
    expect(screen.getAllByText(/auto selected/i)).toHaveLength(5);

    await user.click(basisCheckbox);

    expect(screen.queryAllByText(/auto selected/i)).toHaveLength(4);
  });

  describe("when the search filter is active", () => {
    it("shows the match count with total context on the filter input badge", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
      await user.type(searchFilter, "multimedia");

      screen.getByText(/1 of 10 patterns/);
    });

    it("shows an explicit empty state on the filter input badge when nothing matches", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
      await user.type(searchFilter, "zzz-nothing-matches");

      screen.getByText("No patterns match");
      expect(screen.queryByText(/0 of \d+ patterns/)).toBeNull();
    });

    it("keeps every category visible and shows a placeholder for the empty ones", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
      await user.type(searchFilter, "multimedia");

      const headings = screen.getAllByRole("heading", { level: 3 });
      expect(headings).toHaveLength(3);

      screen.getByRole("checkbox", { name: /Multimedia/ });
      expect(screen.queryByRole("checkbox", { name: /Office/ })).toBeNull();

      screen.getByRole("heading", { name: /Base Technologies/, level: 3 });
      screen.getByRole("heading", { name: /Graphical Environments/, level: 3 });

      const placeholders = screen.getAllByText(/No patterns match the filter/i);
      expect(placeholders).toHaveLength(2);
    });

    it("shows the match count or the empty-state placeholder next to each per-category counter", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
      await user.type(searchFilter, "multimedia");

      screen.getByText(/3 of 4 selected/);

      // n_() picks the singular form at count === 1: "1 matches the filter".
      screen.getByText(/1 matches the filter/);

      expect(screen.queryByText(/0 match the filter/)).toBeNull();
      const emptyStates = screen.getAllByText(/No patterns match the filter/i);
      expect(emptyStates).toHaveLength(2);
    });

    it("maintains pattern order when filtering", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const searchFilter = await screen.findByRole("textbox", { name: /Filter/ });
      await user.type(searchFilter, "yast");

      // Should match yast2_basis (1220), yast2_desktop (1222), yast2_server (1224)
      // in order by their order field
      const names = screen
        .getAllByRole("checkbox")
        .map((c) => document.querySelector(`label[for="${c.id}"]`)?.textContent?.trim() ?? "");
      expect(names).toEqual([
        "YaST Base Utilities",
        "YaST Desktop Utilities",
        "YaST Server Utilities",
      ]);
    });
  });

  describe("when submitting the form", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("removes patterns that were initially selected (AUTO) and are now unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const y2BasisPattern = testingPatterns.find((p) => p.name === "yast2_basis");

      const basisCheckbox = await screen.findByRole("checkbox", {
        name: y2BasisPattern.summary,
      });
      expect(basisCheckbox).toBeChecked();

      await user.click(basisCheckbox);
      expect(basisCheckbox).not.toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["yast2_basis"]),
            remove: expect.arrayContaining(["yast2_basis"]),
          },
        },
      });
    });

    it("removes patterns that were initially selected (USER) and are now unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const gnomePattern = testingPatterns.find((p) => p.name === "gnome");

      const gnomeCheckbox = await screen.findByRole("checkbox", {
        name: gnomePattern.summary,
      });
      expect(gnomeCheckbox).toBeChecked();

      await user.click(gnomeCheckbox);
      expect(gnomeCheckbox).not.toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["gnome"]),
            remove: expect.arrayContaining(["gnome"]),
          },
        },
      });
    });

    it("adds newly selected patterns", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const kdePattern = testingPatterns.find((p) => p.name === "kde");

      const kdeCheckbox = await screen.findByRole("checkbox", {
        name: kdePattern.summary,
      });
      expect(kdeCheckbox).not.toBeChecked();

      await user.click(kdeCheckbox);
      expect(kdeCheckbox).toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.arrayContaining(["kde"]),
            remove: expect.not.arrayContaining(["kde"]),
          },
        },
      });
    });

    it("skips API call when form is pristine (nothing changed)", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      // Form is pristine, no API call should be made
      expect(patchConfig).not.toHaveBeenCalled();
    });

    it("only adds touched patterns when user makes changes", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const kdePattern = testingPatterns.find((p) => p.name === "kde");

      // Touch one pattern (select kde)
      const kdeCheckbox = await screen.findByRole("checkbox", {
        name: kdePattern.summary,
      });
      await user.click(kdeCheckbox);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            // Only touched patterns (kde) and USER patterns (gnome)
            add: expect.arrayContaining(["kde", "gnome"]),
            // Unselected patterns that remain unselected are not included
            remove: expect.not.arrayContaining(["xfce", "yast2_server"]),
          },
        },
      });
    });

    it("removes preselected patterns when unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);

      const preselectedCheckbox = await screen.findByRole("checkbox", {
        name: /Preselected Pattern/,
      });
      expect(preselectedCheckbox).toBeChecked();

      await user.click(preselectedCheckbox);
      expect(preselectedCheckbox).not.toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.not.arrayContaining(["preselected_pattern"]),
            remove: expect.arrayContaining(["preselected_pattern"]),
          },
        },
      });
    });

    it("keeps REMOVED patterns in remove list when they remain unchecked", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const gnomePattern = testingPatterns.find((p) => p.name === "gnome");

      // Make a change to make form dirty (toggle gnome off then on)
      const gnomeCheckbox = await screen.findByRole("checkbox", {
        name: gnomePattern.summary,
      });
      await user.click(gnomeCheckbox);
      await user.click(gnomeCheckbox);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            add: expect.arrayContaining(["gnome"]),
            // kde was REMOVED and remains unchecked
            remove: expect.arrayContaining(["kde"]),
          },
        },
      });
    });

    it("adds AUTO-selected patterns when user touches them (uncheck/recheck)", async () => {
      const { user } = installerRender(<SoftwarePatternsSelection />);
      const y2BasisPattern = testingPatterns.find((p) => p.name === "yast2_basis");

      const basisCheckbox = await screen.findByRole("checkbox", {
        name: y2BasisPattern.summary,
      });
      expect(basisCheckbox).toBeChecked();

      // Uncheck then recheck (makes it dirty)
      await user.click(basisCheckbox);
      expect(basisCheckbox).not.toBeChecked();
      await user.click(basisCheckbox);
      expect(basisCheckbox).toBeChecked();

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(patchConfig).toHaveBeenCalledWith({
        software: {
          patterns: {
            // Now yast2_basis is added because user touched it (dirty)
            add: expect.arrayContaining(["gnome", "yast2_basis"]),
            remove: expect.arrayContaining(["kde"]),
          },
        },
      });
    });
  });
});

describe("SoftwarePatternsSelection scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows only desktop patterns when scope is 'desktops'", async () => {
    installerRender(<SoftwarePatternsSelection scope="desktops" />);

    await screen.findByRole("checkbox", { name: /GNOME/ });
    await screen.findByRole("checkbox", { name: /KDE/ });
    expect(screen.queryByRole("checkbox", { name: /YaST Base/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Multimedia/ })).toBeNull();
  });

  it("shows only non-desktop patterns when scope is 'other'", async () => {
    installerRender(<SoftwarePatternsSelection scope="other" />);

    await screen.findByRole("checkbox", { name: /YaST Base/ });
    await screen.findByRole("checkbox", { name: /Multimedia/ });
    expect(screen.queryByRole("checkbox", { name: /GNOME/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /KDE/ })).toBeNull();
  });

  it("preserves REMOVED desktop patterns (in the 'remove' key) when submitting with scope 'other'", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection scope="other" />);

    // Touch a non-desktop pattern to make the form dirty
    const serverCheckbox = await screen.findByRole("checkbox", { name: /YaST Server/ });
    await user.click(serverCheckbox);

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);

    // GNOME was USER-selected on the desktop scope and must survive submission here
    expect(patchConfig).toHaveBeenCalledWith({
      software: {
        patterns: {
          add: expect.arrayContaining(["gnome", "yast2_server"]),
          remove: expect.not.arrayContaining(["gnome"]),
        },
      },
    });
  });

  it("does not alter non-desktop patterns when submitting with scope 'desktops'", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection scope="desktops" />);

    // Touch a desktop pattern to make the form dirty
    const kdeCheckbox = await screen.findByRole("checkbox", { name: /KDE/ });
    await user.click(kdeCheckbox);

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);

    const nonDesktopPatterns = [
      "yast2_basis",
      "yast2_desktop",
      "yast2_server",
      "multimedia",
      "office",
    ];
    expect(patchConfig).toHaveBeenCalledWith({
      software: {
        patterns: {
          add: expect.not.arrayContaining(nonDesktopPatterns),
          remove: expect.not.arrayContaining(nonDesktopPatterns),
        },
      },
    });
  });

  it("preserves REMOVED desktop patterns (in the 'remove' key) when submitting with scope 'other'", async () => {
    const { user } = installerRender(<SoftwarePatternsSelection scope="other" />);

    // Touch a non-desktop pattern to make the form dirty
    const serverCheckbox = await screen.findByRole("checkbox", { name: /YaST Server/ });
    await user.click(serverCheckbox);

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);

    // kde was REMOVED and must remain in remove even though it is not shown here
    expect(patchConfig).toHaveBeenCalledWith({
      software: {
        patterns: {
          add: expect.not.arrayContaining(["kde"]),
          remove: expect.arrayContaining(["kde"]),
        },
      },
    });
  });

  it("redirects to main software page when no patterns are available for the scope", () => {
    mockAvailablePatterns.mockReturnValue({
      all: other,
      desktops: [],
      other,
    });

    installerRender(<SoftwarePatternsSelection scope="desktops" />);

    screen.getByText("Navigating to /software");
  });
});
