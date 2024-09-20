/*
 * Copyright (c) [2023] SUSE LLC
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
import { ProgressText } from "~/components/core";

describe("ProgressText", () => {
  it("displays the message and the steps counting", () => {
    plainRender(<ProgressText message="Reading repositories" current={1} total={2} />);
    expect(screen.getByText("Reading repositories (1/2)")).toBeInTheDocument();
  });

  it("does not display the steps counting if the current step is zero", () => {
    plainRender(<ProgressText message="Reading repositories" current={0} total={2} />);
    expect(screen.getByText("Reading repositories")).toBeInTheDocument();
  });
});
