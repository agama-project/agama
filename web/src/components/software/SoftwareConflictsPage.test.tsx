/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { Conflict } from "~/types/software";
import SoftwareConflictsPage from "./SoftwareConflictsPage";

const conflicts = [
  {
    id: 0,
    description:
      "the to be installed busybox-gawk-1.37.0-33.4.noarch conflicts with 'gawk' provided by the to be installed gawk-5.3.2-1.1.x86_64",
    details: null,
    solutions: [
      {
        id: 0,
        description: "Following actions will be done:",
        details:
          "do not install gawk-5.3.2-1.1.x86_64\ndo not install kernel-default-6.14.4-1.1.x86_64\ndo not install pattern:selinux-20241218-9.1.x86_64",
      },
      {
        id: 1,
        description: "do not install busybox-gawk-1.37.0-33.4.noarch",
        details: null,
      },
    ],
  },
  {
    id: 1,
    description:
      "the to be installed tuned-2.25.1.0+git.889387b-3.1.noarch conflicts with 'tlp' provided by the to be installed tlp-1.8.0-1.1.noarch",
    details: null,
    solutions: [
      {
        id: 0,
        description: "do not install tuned-2.25.1.0+git.889387b-3.1.noarch",
        details: null,
      },
      {
        id: 1,
        description: "do not install tlp-1.8.0-1.1.noarch",
        details: null,
      },
    ],
  },
  {
    id: 2,
    description:
      "the to be installed pattern:microos_ra_verifier-5.0-98.1.x86_64 requires 'patterns-microos-ra_verifier', but this requirement cannot be provided",
    details:
      "not installable providers: patterns-microos-ra_verifier-5.0-98.1.x86_64[https-download.opensuse.org-6594e038]",
    solutions: [
      {
        id: 0,
        description: "do not install pattern:microos_ra_verifier-5.0-98.1.x86_64",
        details: null,
      },
      {
        id: 1,
        description: "do not install pattern:microos_ra_agent-5.0-98.1.x86_64",
        details: null,
      },
      {
        id: 2,
        description:
          "break pattern:microos_ra_verifier-5.0-98.1.x86_64 by ignoring some of its dependencies",
        details: null,
      },
    ],
  },
];

let mockConflicts: Conflict[];
const mockSolveConflict = jest.fn();

jest.mock("~/components/layout/Header", () => () => <div>Header Mock</div>);
jest.mock("~/components/questions/Questions", () => () => <div>Questions Mock</div>);

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useConflicts: () => mockConflicts,
  useConflictsMutation: () => ({ mutate: mockSolveConflict }),
}));

describe("SofwareConflicts", () => {
  beforeEach(() => {
    mockConflicts = [{ ...conflicts[0] }];
  });

  it("does not render the conflicts toolbar", () => {
    installerRender(<SoftwareConflictsPage />);
    expect(screen.queryByText(/Multiple conflicts found/)).toBeNull();
    expect(screen.queryByText(/any order/)).toBeNull();
    expect(screen.queryByText(/resolve others/)).toBeNull();
    expect(screen.queryByText("1 of 3")).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip to previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip to next" })).toBeNull();
  });

  it("allows applying the selected solution", async () => {
    const { user } = installerRender(<SoftwareConflictsPage />);
    const applyButton = screen.getByRole("button", { name: "Apply selected solution" });
    const secondOption = screen.getByRole("radio", {
      name: conflicts[0].solutions[1].description,
    });
    await user.click(secondOption);
    await user.click(applyButton);
    expect(mockSolveConflict).toHaveBeenCalledWith({ conflictId: 0, solutionId: 1 });
  });

  it("displays an error if no solution is selected before submission", async () => {
    const { user } = installerRender(<SoftwareConflictsPage />);
    const applyButton = screen.getByRole("button", { name: "Apply selected solution" });
    const firstSolution = screen.getAllByRole("radio")[0];
    await user.click(applyButton);
    screen.getByText("Warning alert:");
    screen.getByText("Select a solution to continue");
    await user.click(firstSolution);
    await user.click(applyButton);
    expect(screen.queryByText("Warning alert:")).toBeNull();
    expect(screen.queryByText("Select a solution to continue")).toBeNull();
  });

  describe("when a conflict solution has details", () => {
    beforeEach(() => {
      mockConflicts = [
        {
          id: 0,
          description: "Fake conflict",
          details: null,
          solutions: [
            {
              id: 0,
              description: `Fake solution with details`,
              details: "Action 1\nAction 2",
            },
          ],
        },
      ];
    });

    it("renders details in a list, splitting by newline", () => {
      installerRender(<SoftwareConflictsPage />);
      const details = screen.getByRole("list");
      within(details).getByText("Action 1");
      within(details).getByText("Action 2");
    });

    describe("and the number of details is within the visible limit", () => {
      it("does not render a toggle to show/hide more", () => {
        installerRender(<SoftwareConflictsPage />);
        expect(screen.queryByRole("button", { name: /^Show.*actions$"/ })).toBeNull();
      });
    });

    describe("but the number of details exceeds the visible limit", () => {
      beforeEach(() => {
        mockConflicts = [
          {
            id: 0,
            description: "Fake conflict",
            details: null,
            solutions: [
              {
                id: 0,
                description: `Fake solution with details`,
                details: "Action 1\nAction 2\nAction 3\nAction 4",
              },
            ],
          },
        ];
      });

      it("renders a toggle to show/hide all actions", async () => {
        const { user } = installerRender(<SoftwareConflictsPage />);
        const actionsToggle = screen.getByRole("button", { name: /^Show.*actions$/ });
        const details = screen.getByRole("list");
        within(details).getByText("Action 1");
        within(details).getByText("Action 2");
        within(details).getByText("Action 3");
        expect(within(details).queryByText("Action 4")).toBeNull();
        await user.click(actionsToggle);
        within(details).getByText("Action 4");
        expect(actionsToggle).toHaveTextContent("Show less actions");
        await user.click(actionsToggle);
        expect(within(details).queryByText("Action 4")).toBeNull();
      });
    });
  });

  describe("when there is more than one conflict", () => {
    beforeEach(() => {
      mockConflicts = conflicts;
    });

    it("renders the conflicts toolbar with information and links", () => {
      installerRender(<SoftwareConflictsPage />);
      screen.getByText(/Multiple conflicts found/);
      screen.getByText(/any order/);
      screen.getByText(/resolve others/);
      screen.getByText("1 of 3");
      screen.getByRole("button", { name: "Skip to previous" });
      screen.getByRole("button", { name: "Skip to next" });
    });

    it("allows navigating between conflicts without exceeding bounds", async () => {
      const { user } = installerRender(<SoftwareConflictsPage />);
      screen.getByText("1 of 3");
      const skipToPrevious = screen.getByRole("button", { name: "Skip to previous" });
      const skipToNext = screen.getByRole("button", { name: "Skip to next" });

      expect(skipToPrevious).toBeDisabled();
      expect(skipToNext).not.toBeDisabled();

      await user.click(skipToPrevious);
      screen.getByText("1 of 3");
      screen.getByText(conflicts[0].description);
      await user.click(skipToNext);
      expect(skipToPrevious).not.toBeDisabled();
      expect(skipToNext).not.toBeDisabled();
      screen.getByText("2 of 3");
      expect(screen.queryByText(conflicts[0].description)).toBeNull();
      screen.getByText(conflicts[1].description);
      await user.click(skipToNext);
      screen.getByText("3 of 3");
      expect(screen.queryByText(conflicts[1].description)).toBeNull();
      screen.getByText(conflicts[2].description);
      expect(skipToPrevious).not.toBeDisabled();
      expect(skipToNext).toBeDisabled();
      await user.click(skipToNext);
      screen.getByText("3 of 3");
    });

    it("does not preserve the selected option after navigating", async () => {
      const { user } = installerRender(<SoftwareConflictsPage />);
      screen.getByText("1 of 3");
      const skipToPrevious = screen.getByRole("button", { name: "Skip to previous" });
      const skipToNext = screen.getByRole("button", { name: "Skip to next" });

      screen.getByText("1 of 3");
      screen.getByText(conflicts[0].description);
      let options = screen.getAllByRole("radio", { checked: false });
      expect(options.length).toBe(conflicts[0].solutions.length);

      await user.click(options[0]);
      expect(options[0]).toBeChecked();

      await user.click(skipToNext);
      screen.getByText("2 of 3");
      screen.getByText(conflicts[1].description);
      options = screen.getAllByRole("radio", { checked: false });
      expect(options.length).toBe(conflicts[1].solutions.length);
      expect(options[0]).not.toBeChecked();

      await user.click(options[0]);
      expect(options[0]).toBeChecked();

      await user.click(skipToPrevious);
      options = screen.getAllByRole("radio", { checked: false });
      expect(options.length).toBe(conflicts[0].solutions.length);
      expect(options[0]).not.toBeChecked();
    });

    it("allows applying the selected solution for the current conflict", async () => {
      const { user } = installerRender(<SoftwareConflictsPage />);
      const skipToNext = screen.getByRole("button", { name: "Skip to next" });

      await user.click(skipToNext);
      const applyButton = screen.getByRole("button", { name: "Apply selected solution" });
      const secondOption = screen.getByRole("radio", {
        name: conflicts[1].solutions[1].description,
      });
      await user.click(secondOption);
      await user.click(applyButton);
      expect(mockSolveConflict).toHaveBeenCalledWith({ conflictId: 1, solutionId: 1 });
    });
  });

  describe("when there are no conflicts", () => {
    beforeEach(() => {
      mockConflicts = [];
    });

    it("does not render the solution selection form", () => {
      installerRender(<SoftwareConflictsPage />);
      expect(screen.queryAllByRole("radio").length).toBe(0);
      expect(screen.queryByRole("button", { name: "Apply selected solution" })).toBeNull();
    });

    it("renders a message indicating there are no conflicts to address", () => {
      installerRender(<SoftwareConflictsPage />);
      screen.queryByRole("heading", { name: "No conflicts to address" });
      screen.getByText(/All conflicts have been resolved, or none were detected/);
    });
  });
});
