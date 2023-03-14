/*
 * Copyright (c) [2023] SUSE LLC
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
import { plainRender } from "~/test-utils";
import { PageOptionsSlot } from "~/components/layout";
import { PageOptions } from "~/components/core";

describe("PageOptions", () => {
  it("renders given title", () => {
    plainRender(
      <>
        <PageOptionsSlot />
        <PageOptions title="Awesome options">
          The page options content
        </PageOptions>
      </>
    );

    screen.getByText("Awesome options");
  });

  it("renders given children", () => {
    plainRender(
      <>
        <PageOptionsSlot />
        <PageOptions title="Awesome options">
          The page options content
        </PageOptions>
      </>
    );

    screen.getByText("The page options content");
  });

  it("dispatches onClick events to the target", async () => {
    const onClickHandler = jest.fn();
    const { user } = plainRender(
      <>
        <PageOptionsSlot onClick={onClickHandler} />
        <PageOptions title="Awesome options">
          <button>Click tester</button>
        </PageOptions>
      </>
    );

    const button = screen.getByRole("button", { name: "Click tester" });
    await user.click(button);

    expect(onClickHandler).toHaveBeenCalled();
  });
});
