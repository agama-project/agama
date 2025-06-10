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
import Annotation from "./Annotation";

describe("Annotation", () => {
  it('renders the default "emergency" icon when no icon is provided', () => {
    const { container } = plainRender(<Annotation>Configured for installation only</Annotation>);

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon-name", "emergency");
  });

  it("renders a custom icon when icon is provided", () => {
    const { container } = plainRender(
      <Annotation icon="info">Configured for installation only</Annotation>,
    );

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon-name", "info");
  });

  it("renders children inside a <b> element", () => {
    plainRender(<Annotation>Configured for installation only</Annotation>);

    const content = screen.getByText("Configured for installation only");
    expect(content.tagName).toBe("STRONG");
  });
});
