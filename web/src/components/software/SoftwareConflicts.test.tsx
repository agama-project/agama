/*
 * Copyright (c) [2025] SUSE LLC
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
import { Conflict } from "~/types/software";
import SoftwareConflicts from "./SoftwareConflicts";

let mockConflicts: Conflict[];

const multipleConflicts = [
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

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useConflicts: () => mockConflicts,
}));

describe("SofwareConflicts", () => {
  describe("when there is more than one conflict", () => {
    beforeEach(() => {
      mockConflicts = multipleConflicts;
    });

    it("renders a toolbar with conflicts info and links", () => {
      installerRender(<SoftwareConflicts />);
      screen.getByRole("heading", { name: "Conflict 1 of 3" });
      screen.getByRole("button", { name: "Skip to Previous" });
      screen.getByRole("button", { name: "Skip to Next" });
    });
  });
});
