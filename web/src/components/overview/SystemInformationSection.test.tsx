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
import { installerRender, mockSystem } from "~/test-utils";
import SystemInformationSection from "./SystemInformationSection";

jest.mock("~/components/network/FormattedIpsList", () => ({
  __esModule: true,
  default: () => <span>192.168.1.1</span>,
}));

describe("SystemInformationSection", () => {
  describe("when hardware data is available", () => {
    beforeEach(() => {
      mockSystem({
        hardware: {
          model: "ThinkPad X1 Carbon",
          cpu: "Intel Core i7",
          memory: 16 * 1024 * 1024 * 1024,
        },
      });
    });

    it("renders the model", () => {
      installerRender(<SystemInformationSection />);
      screen.getByText("ThinkPad X1 Carbon");
    });

    it("renders the CPU", () => {
      installerRender(<SystemInformationSection />);
      screen.getByText("Intel Core i7");
    });

    it("renders the formatted memory", () => {
      installerRender(<SystemInformationSection />);
      screen.getByText("16.00 GiB");
    });
  });

  describe("when hardware data is missing", () => {
    beforeEach(() => {
      mockSystem({
        hardware: {
          model: undefined,
          cpu: undefined,
          memory: undefined,
        },
      });
    });

    it("renders 'Unknown' for each missing hardware field", () => {
      installerRender(<SystemInformationSection />);
      expect(screen.getAllByText("Unknown")).toHaveLength(3);
    });
  });

  describe("when only some hardware data is missing", () => {
    beforeEach(() => {
      mockSystem({
        hardware: {
          model: "ThinkPad X1 Carbon",
          cpu: undefined,
          memory: undefined,
        },
      });
    });

    it("renders available fields and 'Unknown' for missing ones", () => {
      installerRender(<SystemInformationSection />);
      screen.getByText("ThinkPad X1 Carbon");
      expect(screen.getAllByText("Unknown")).toHaveLength(2);
    });
  });
});
