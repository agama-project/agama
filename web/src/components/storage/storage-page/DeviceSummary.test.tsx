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
import { plainRender } from "~/test-utils";
import DeviceSummary from "~/components/storage/storage-page/DeviceSummary";

describe("DeviceSummary", () => {
  describe("when everything on the device is being kept", () => {
    it("names the disk, and what to allow so the system fits", () => {
      plainRender(<DeviceSummary name="vdd" reason="keptContent" />);

      screen.getByRole("heading", { level: 3, name: /There is not enough room on vdd/ });
      screen.getByText(/Everything on vdd is being kept/);
      screen.getByText(/shrink or delete/);
    });
  });

  describe("when the device has no room at all", () => {
    it("says so, and where else the system can go", () => {
      plainRender(<DeviceSummary name="vdd" reason="tooSmall" />);

      screen.getByRole("heading", { level: 3, name: /vdd is too small for the new system/ });
      screen.getByText("Install on another device, or add one to the plan.");
    });
  });
});
