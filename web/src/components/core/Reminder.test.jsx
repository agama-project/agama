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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { Reminder } from "~/components/core";

describe("Reminder", () => {
  it("renders a status region by default", () => {
    plainRender(<Reminder>Example</Reminder>);
    const reminder = screen.getByRole("status");
    within(reminder).getByText("Example");
  });

  it("renders a region with given role", () => {
    plainRender(<Reminder role="alert">Example</Reminder>);
    const reminder = screen.getByRole("alert");
    within(reminder).getByText("Example");
  });

  it("renders given title", () => {
    plainRender(
      <Reminder title={<span><strong>Kindly</strong> reminder</span>}>
        <a href="#">Visit the settings section</a>
      </Reminder>
    );
    screen.getByRole("heading", { name: "Kindly reminder", level: 4 });
  });

  it("does not render a heading if title is not given", () => {
    plainRender(<Reminder>Without title</Reminder>);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("does not render a heading if title is an empty string", () => {
    plainRender(<Reminder title="">Without title</Reminder>);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders given children", () => {
    plainRender(
      <Reminder><a href="#">Visit the settings section</a></Reminder>
    );
    screen.getByRole("link", { name: "Visit the settings section" });
  });
});
