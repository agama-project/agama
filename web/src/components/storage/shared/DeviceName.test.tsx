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
import DeviceName from "~/components/storage/shared/DeviceName";

describe("DeviceName", () => {
  it("names the device and says how big it is", () => {
    plainRender(
      <h2>
        <DeviceName name="vdd" size={21474836480} />
      </h2>,
    );

    expect(screen.getByRole("heading", { name: "vdd (20 GiB)" })).toBeInTheDocument();
  });

  it("says the name alone when there is no size to give", () => {
    plainRender(
      <h2>
        <DeviceName name="system" />
      </h2>,
    );

    expect(screen.getByRole("heading", { name: "system" })).toBeInTheDocument();
  });
});
