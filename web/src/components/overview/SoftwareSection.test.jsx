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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { noop } from "~/utils";
import { createClient } from "~/client";
import SoftwareSection from "~/components/overview/SoftwareSection";

jest.mock("~/client");

const gnomePattern = {
  name: "gnome",
  category: "Graphical Environments",
  icon: "./pattern-gnome",
  summary: "GNOME Desktop Environment (Wayland)",
  order: 1120,
};

const kdePattern = {
  name: "kde",
  category: "Graphical Environments",
  icon: "./pattern-kde",
  summary: "KDE Applications and Plasma Desktop",
  order: 1110,
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      software: {
        onSelectedPatternsChanged: noop,
        getProposal: jest.fn().mockResolvedValue({ size: "500 MiB", patterns: { kde: 1 } }),
        getPatterns: jest.fn().mockResolvedValue([gnomePattern, kdePattern]),
      },
    };
  });
});

it.only("renders the required space and the selected patterns", async () => {
  installerRender(<SoftwareSection />);
  await screen.findByText("500 MiB");
  await screen.findByText(kdePattern.summary);
});
