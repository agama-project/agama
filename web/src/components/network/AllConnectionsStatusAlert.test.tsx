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
import { plainRender } from "~/test-utils";
import AllConnectionsStatusAlert from "./AllConnectionsStatusAlert";

describe("AllConnectionsStatusAlert", () => {
  it("renders an alert with 'full-transient' mode correctly", () => {
    plainRender(<AllConnectionsStatusAlert mode="full-transient" connections={3} />);

    screen.getByText("No connections will be available in the installed system");
    screen.getByRole("button", { name: "Set all to be available in the installed system" });
  });

  it("renders an alert with 'full-persistent' mode correctly", () => {
    plainRender(<AllConnectionsStatusAlert mode="full-persistent" connections={3} />);

    screen.getByText("All connections will be available in the installed system");
    screen.getByRole("button", { name: "Set all for installation only" });
  });

  it("renders an alert with 'mixed' mode correctly", () => {
    plainRender(<AllConnectionsStatusAlert mode="mixed" connections={3} />);

    screen.getByText("Some connections will be available in the installed system.");
    screen.getByRole("button", { name: "Set all to be available in the installed system" });
    screen.getByRole("button", { name: "Set all for installation only" });
  });

  it("renders nothing the alert if there is only one connection and mode is not 'full-transient'", () => {
    const { container } = plainRender(
      <AllConnectionsStatusAlert mode="full-persistent" connections={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders alert when there is only one connection and mode is 'full-transient'", () => {
    plainRender(<AllConnectionsStatusAlert mode="full-transient" connections={1} />);

    screen.getByText("No connections will be available in the installed system");
  });

  // TODO: update below test when actions are implemented
  it.skip("triggers the correct action on button click", async () => {
    const onAllPermanentClick = jest.fn();
    const onAllTransientClick = jest.fn();

    const { user } = plainRender(<AllConnectionsStatusAlert mode="mixed" connections={3} />);

    const allPermanent = screen.getByRole("button", {
      name: "Set all to be available in the installed system",
    });
    const allTransient = screen.getByRole("button", { name: "Set all for installation only" });

    await user.click(allPermanent);
    expect(onAllPermanentClick).toHaveBeenCalled();

    await user.click(allTransient);
    expect(onAllTransientClick).toHaveBeenCalled();
  });
});
