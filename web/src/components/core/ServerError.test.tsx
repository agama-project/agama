/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { noop } from "radashi";
import * as utils from "~/utils";
import ServerError from "./ServerError";

describe("ServerError", () => {
  it("wraps a generic server problem message", () => {
    installerRender(<ServerError />);
    screen.getByText("Cannot connect");
    screen.getByText("Check whether Agama server is running.");
  });

  it("calls location.reload when user clicks on 'Reload'", async () => {
    jest.spyOn(utils, "locationReload").mockImplementation(noop);
    const { user } = installerRender(<ServerError />);
    const reloadButton = await screen.findByRole("button", { name: /Reload/i });
    await user.click(reloadButton);
    expect(utils.locationReload).toHaveBeenCalled();
  });
});
