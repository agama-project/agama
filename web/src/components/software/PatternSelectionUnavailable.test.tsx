/*
 * Copyright (c) [2026] SUSE LLC
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
import PatternSelectionUnavailable from "./PatternSelectionUnavailable";

const mockUseIssues = jest.fn();
const mockUseAvailablePatterns = jest.fn();

jest.mock("~/hooks/model/issue", () => ({
  useIssues: (scope) => mockUseIssues(scope),
}));

jest.mock("~/hooks/model/system/software", () => ({
  useAvailablePatterns: () => mockUseAvailablePatterns(),
}));

describe("PatternSelectionUnavailable", () => {
  it("renders the unavailable message", () => {
    mockUseIssues.mockReturnValue([]);
    mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

    installerRender(<PatternSelectionUnavailable />);
    screen.getByText("Software selection is not available");
  });

  describe("when there is a missing_registration issue", () => {
    it("shows the issue description", () => {
      mockUseIssues.mockReturnValue([
        {
          scope: "product",
          class: "missing_registration",
          description: "Product registration is required",
        },
      ]);
      mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

      installerRender(<PatternSelectionUnavailable />);
      screen.getByText("Product registration is required");
    });

    it("shows a link to registration", () => {
      mockUseIssues.mockReturnValue([
        {
          scope: "product",
          class: "missing_registration",
          description: "Product registration is required",
        },
      ]);
      mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

      installerRender(<PatternSelectionUnavailable />);
      const link = screen.getByRole("link", { name: /Go to registration/ });
      expect(link).toHaveAttribute("href", "/registration");
    });
  });

  describe("when there is a missing_product issue", () => {
    it("shows the issue description", () => {
      mockUseIssues.mockReturnValue([
        {
          scope: "product",
          class: "missing_product",
          description: "Base product is not available",
        },
      ]);
      mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

      installerRender(<PatternSelectionUnavailable />);
      screen.getByText("Base product is not available");
    });

    it("shows an additional hint about network connectivity", () => {
      mockUseIssues.mockReturnValue([
        {
          scope: "product",
          class: "missing_product",
          description: "Base product is not available",
        },
      ]);
      mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

      installerRender(<PatternSelectionUnavailable />);
      screen.getByText(/This might be due to network connectivity/);
    });

    it("shows a link to network settings", () => {
      mockUseIssues.mockReturnValue([
        {
          scope: "product",
          class: "missing_product",
          description: "Base product is not available",
        },
      ]);
      mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

      installerRender(<PatternSelectionUnavailable />);
      const link = screen.getByRole("link", { name: /Go to network settings/ });
      expect(link).toHaveAttribute("href", "/network");
    });
  });

  describe("when there are no product issues", () => {
    describe("and there are zero patterns available", () => {
      it("shows message about adding software after installation", () => {
        mockUseIssues.mockReturnValue([]);
        mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

        installerRender(<PatternSelectionUnavailable />);
        screen.getByText(/Additional software can be added after the installation is complete/);
      });

      it("does not show any links", () => {
        mockUseIssues.mockReturnValue([]);
        mockUseAvailablePatterns.mockReturnValue({ all: [], desktops: [], other: [] });

        installerRender(<PatternSelectionUnavailable />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
      });
    });

    describe("and patterns exist but selection could not be loaded", () => {
      it("shows generic error message", () => {
        mockUseIssues.mockReturnValue([]);
        mockUseAvailablePatterns.mockReturnValue({
          all: [{ name: "base", summary: "Base System", description: "...", desktop: false }],
          desktops: [],
          other: [{ name: "base", summary: "Base System", description: "...", desktop: false }],
        });

        installerRender(<PatternSelectionUnavailable />);
        screen.getByText(/The software selection could not be loaded/);
      });

      it("does not show any links", () => {
        mockUseIssues.mockReturnValue([]);
        mockUseAvailablePatterns.mockReturnValue({
          all: [{ name: "base", summary: "Base System", description: "...", desktop: false }],
          desktops: [],
          other: [{ name: "base", summary: "Base System", description: "...", desktop: false }],
        });

        installerRender(<PatternSelectionUnavailable />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
      });
    });
  });
});
