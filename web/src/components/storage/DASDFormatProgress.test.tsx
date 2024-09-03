/*
 * Copyright (c) [2024] SUSE LLC
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
import { installerRender, plainRender } from "~/test-utils";
import DASDFormatProgress from "./DASDFormatProgress";
import { DASDDevice, FormatJob } from "~/types/dasd";

let mockDASDFormatJobs: FormatJob[];
let mockDASDDevices: DASDDevice[];

jest.mock("~/queries/dasd", () => ({
  useDASDRunningFormatJobs: () => mockDASDFormatJobs,
  useDASDDevices: () => mockDASDDevices,
}));

describe("DASDFormatProgress", () => {
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
          id: "0.0.0200",
          enabled: false,
          deviceName: "dasda",
          deviceType: "eckd",
          formatted: false,
          diag: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
          hexId: 0x200,
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
          id: "0.0.0200",
          enabled: false,
          deviceName: "dasda",
          deviceType: "eckd",
          formatted: false,
          diag: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
          hexId: 0x200,
        },
      ];
    });

    it("does not render any progress", () => {
      installerRender(<DASDFormatProgress />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });
});
