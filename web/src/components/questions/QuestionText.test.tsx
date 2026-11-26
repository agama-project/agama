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
import QuestionText from "~/components/questions/QuestionText";

describe("QuestionText", () => {
  it("renders a single paragraph unchanged", () => {
    plainRender(<QuestionText text="Just one paragraph of text" />);

    const paragraph = screen.getByText("Just one paragraph of text");
    expect(paragraph.tagName).toBe("P");
  });

  it("splits text into paragraphs on a blank line", () => {
    plainRender(<QuestionText text={"First paragraph.\n\nSecond paragraph."} />);

    const first = screen.getByText("First paragraph.");
    const second = screen.getByText("Second paragraph.");
    expect(first.tagName).toBe("P");
    expect(second.tagName).toBe("P");
  });

  it("collapses multiple consecutive blank lines into a single break", () => {
    plainRender(<QuestionText text={"First paragraph.\n\n\n\nSecond paragraph."} />);

    screen.getByText("First paragraph.");
    screen.getByText("Second paragraph.");
    expect(screen.getAllByText(/paragraph\./)).toHaveLength(2);
  });

  it("ignores leading and trailing blank lines", () => {
    plainRender(<QuestionText text={"\n\nFirst paragraph.\n\nSecond paragraph.\n\n"} />);

    expect(screen.getAllByText(/paragraph\./)).toHaveLength(2);
  });

  it("treats a whitespace-only line as a blank line", () => {
    plainRender(<QuestionText text={"First paragraph.\n   \nSecond paragraph."} />);

    screen.getByText("First paragraph.");
    screen.getByText("Second paragraph.");
    expect(screen.getAllByText(/paragraph\./)).toHaveLength(2);
  });
});
