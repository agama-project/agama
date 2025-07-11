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
import Radio from "./RadioEnhanced";

describe("RadioEnhanced", () => {
  it("renders the label using an `lg` size", () => {
    plainRender(<Radio label="Just a radio" name="radio-test" id="radio-test-1" />);

    const radio = screen.getByText("Just a radio");
    expect(radio.classList).toContain("pf-v6-u-font-size-lg");
  });

  it("renders the label in bold when radio is checked", () => {
    plainRender(<Radio label="Just a radio" name="radio-test" id="radio-test-1" isChecked />);

    const radio = screen.getByText("Just a radio");
    expect(radio.classList).toContain("pf-v6-u-font-weight-bold");
  });
});
