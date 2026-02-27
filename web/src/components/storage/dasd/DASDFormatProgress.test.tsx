/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import type { Device } from "~/model/system/dasd";

import DASDFormatProgress from "./DASDFormatProgress";

// FIXME: adapt to new API
type FormatSummary = {
  total: number;
  step: number;
  done: boolean;
};

type FormatJob = {
  jobId: string;
  summary?: { [key: string]: FormatSummary };
};

/* eslint-disable @typescript-eslint/no-unused-vars */
let mockDASDFormatJobs: FormatJob[];
let mockDASDDevices: Device[];

// Skipped during migration to v2
describe.skip("DASDFormatProgress", () => {
  describe("when there is already some progress", () => {
    beforeEach(() => {
      mockDASDFormatJobs = [
        {
          jobId: "0.0.0200",
          summary: {
            "0.0.0200": {
              total: 5,
              step: 1,
              done: false,
            },
          },
        },
      ];

      mockDASDDevices = [
        {
          channel: "0.0.0200",
          active: false,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];
    });

    it("renders the progress", () => {
      installerRender(<DASDFormatProgress />);
      expect(screen.queryByRole("progressbar")).toBeInTheDocument();
      screen.getByText("0.0.0200 - dasda");
    });
  });

  describe("when there are no running jobs", () => {
    beforeEach(() => {
      mockDASDFormatJobs = [];

      mockDASDDevices = [
        {
          channel: "0.0.0200",
          active: false,
          deviceName: "dasda",
          type: "eckd",
          formatted: false,
          diag: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
        },
      ];
    });

    it("does not render any progress", () => {
      installerRender(<DASDFormatProgress />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });
});
