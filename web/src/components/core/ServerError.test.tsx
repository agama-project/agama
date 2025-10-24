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
import { installerRender } from "~/test-utils";
import { noop } from "radashi";
import * as utils from "~/utils";
import ServerError from "./ServerError";

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/components/layout/Header", () => () => <div>Header Mock</div>);
jest.mock("~/components/layout/Sidebar", () => () => <div>Sidebar Mock</div>);
jest.mock("~/components/layout/Layout", () => {
  const layout = jest.requireActual("~/components/layout/Layout");
  const OriginalPlainLayout = layout.Plain;

  return {
    ...layout,
    Plain: ({ ...props }) => (
      <>
        <div>PlainLayout Mock</div>
        <OriginalPlainLayout {...props} />
      </>
    ),
  };
});

describe("ServerError", () => {
  it("wraps a generic server problem message into a plain layout with neither, header nor sidebar", () => {
    installerRender(<ServerError />);
    expect(screen.queryByText("Header Mock")).toBeNull();
    expect(screen.queryByText("Sidebar Mock")).toBeNull();
    screen.getByText("PlainLayout Mock");
    screen.getByText(/Cannot connect to Agama server/i);
  });

  it("calls location.reload when user clicks on 'Reload'", async () => {
    jest.spyOn(utils, "locationReload").mockImplementation(noop);
    const { user } = installerRender(<ServerError />);
    const reloadButton = await screen.findByRole("button", { name: /Reload/i });
    await user.click(reloadButton);
    expect(utils.locationReload).toHaveBeenCalled();
  });
});
