/*
 * Copyright (c) [2026] SUSE LLC
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
import { useAvailablePatterns } from "~/hooks/model/system/software";
import { SOFTWARE } from "~/routes/paths";
import NoDesktopAlert from "./NoDesktopAlert";

const mockUseAvailablePatternsFn: jest.Mock<ReturnType<typeof useAvailablePatterns>> = jest.fn();

jest.mock("~/hooks/model/system/software", () => ({
  useAvailablePatterns: () => mockUseAvailablePatternsFn(),
}));

const gnome = {
  name: "gnome",
  category: "Graphical Environments",
  icon: "./pattern-gnome-wayland",
  description: "The GNOME desktop environment ...",
  summary: "GNOME Desktop",
  order: 1010,
  preselected: false,
  desktop: true,
};

const yast2Basis = {
  name: "yast2_basis",
  category: "Base Technologies",
  icon: "./yast",
  description: "YaST tools for basic system administration.",
  summary: "YaST Base Utilities",
  order: 1220,
  preselected: false,
  desktop: false,
};

describe("NoDesktopAlert", () => {
  beforeEach(() => {
    mockUseAvailablePatternsFn.mockReturnValue({
      all: [gnome, yast2Basis],
      desktops: [gnome],
      other: [yast2Basis],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the headline and the command-line consequence", () => {
    installerRender(<NoDesktopAlert />);

    screen.getByText("No desktop selected");
    screen.getByText("The system will boot to a command-line interface.");
  });

  it("offers a link that navigates to the software section", () => {
    installerRender(<NoDesktopAlert />);

    const link = screen.getByRole("link", { name: "software" });
    expect(link).toHaveAttribute("href", expect.stringContaining(SOFTWARE.root));
  });

  it("returns null when no desktop patterns are available", () => {
    mockUseAvailablePatternsFn.mockReturnValue({
      all: [yast2Basis],
      desktops: [],
      other: [yast2Basis],
    });

    const { container } = installerRender(<NoDesktopAlert />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("No desktop selected")).not.toBeInTheDocument();
  });
});
