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
import { mockProgresses, plainRender } from "~/test-utils";
import { ProgressReport } from "~/components/core";

describe("ProgressReport", () => {
  describe("when there are details of the storage service", () => {
    beforeEach(() => {
      mockProgresses([
        {
          scope: "manager",
          step: "Partition disks",
          index: 1,
          size: 3,
          steps: ["Partition disks", "Install software", "Install bootloader"],
        },
        {
          scope: "storage",
          step: "Doing some partitioning",
          index: 1,
          size: 1,
          steps: ["Doing some partitioning"],
        },
      ]);
    });

    it("shows the progress including the details", () => {
      plainRender(<ProgressReport title="Testing progress" />);

      expect(screen.getByText(/Partition disks/)).toBeInTheDocument();
      expect(screen.getByText(/Install software/)).toBeInTheDocument();

      // NOTE: not finding the whole text because it is now split in two <span> because of PF/Truncate
      expect(screen.getByText(/Doing some/)).toBeInTheDocument();
      expect(screen.getByText(/\(1\/1\)/)).toBeInTheDocument();
    });
  });

  describe("when there are details of the software service", () => {
    beforeEach(() => {
      mockProgresses([
        {
          scope: "manager",
          step: "Installing software",
          index: 2,
          size: 3,
          steps: ["Partition disks", "Install software", "Install bootloader"],
        },
        {
          scope: "software",
          step: "Installing vim",
          index: 5,
          size: 200,
          steps: ["Installing vim"],
        },
      ]);
    });

    it("shows the progress including the details", () => {
      plainRender(<ProgressReport title="Testing progress" />);

      expect(screen.getByText(/Partition disks/)).toBeInTheDocument();
      expect(screen.getByText(/Install software/)).toBeInTheDocument();

      // NOTE: not finding the whole text because it is now split in two <span> because of PF/Truncate
      expect(screen.getByText(/Installing vim/)).toBeInTheDocument();
      expect(screen.getByText(/\(5\/200\)/)).toBeInTheDocument();
    });
  });
});
