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
import { installerRender } from "~/test-utils";
import { DASDTable } from "~/components/storage/dasd";
import { DASDDevice } from "~/types/dasd";

let mockDASDDevices: DASDDevice[] = [];

jest.mock("~/queries/dasd", () => ({
  useDASDDevices: () => mockDASDDevices,
  useDASDMutation: () => jest.fn(),
  useFormatDASDMutation: () => jest.fn(),
}));

describe("DASDTable", () => {
  describe("when there is some DASD devices available", () => {
    beforeEach(() => {
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

    it("renders those devices", () => {
      installerRender(<DASDTable />);
      screen.getByText("active");
    });
  });
});
