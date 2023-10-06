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
import { act, screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import { createClient } from "~/client";
import cockpit from "../../lib/cockpit";

import PatternItem from "./PatternItem";

jest.mock("~/client");
const addPatternFn = jest.fn().mockResolvedValue();
const removePatternFn = jest.fn().mockResolvedValue();
beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      software: {
        addPattern: addPatternFn,
        removePattern: removePatternFn,
      },
    };
  });
});

jest.mock("../../lib/cockpit");
const readFn = jest.fn().mockResolvedValue("");
const fileFn = jest.fn();
fileFn.mockImplementation(() => {
  return {
    read: readFn
  };
});
cockpit.file.mockImplementation(fileFn);

const pattern = {
  category: "Documentation",
  description: "Help and Support Documentation",
  icon: "./pattern-documentation",
  name: "documentation",
  order: "1005",
  summary: "Help and Support Documentation"
};

describe("PatternItem", () => {
  it("displays the pattern summary and description", async () => {
    await act(async () => installerRender(<PatternItem pattern={pattern} />));

    // the summary is displayed
    screen.getByText(pattern.summary);
    // the description is displayed
    screen.getByText(pattern.description);
  });

  it("displays the pattern icon if it as available", async () => {
    readFn.mockResolvedValue("<?xml version=\"1.0\" ?>");
    const { container } = await act(async () => installerRender(<PatternItem pattern={pattern} />));

    expect(container.querySelector(".pattern-label-icon img")).not.toBeNull();
  });

  it("displays the generic fallback icon if the pattern icon is not available", async () => {
    readFn.mockResolvedValue("");
    const { container } = await act(async () => installerRender(<PatternItem pattern={pattern} />));

    expect(container.querySelector(".pattern-label-icon svg")).not.toBeNull();
  });

  it("selects unselected pattern after clicking it", async () => {
    pattern.selected = undefined;
    const { container, user } = await act(async () => installerRender(<PatternItem pattern={pattern} />));

    // console.log(prettyDOM(container));
    await user.click(container.querySelector(".pattern-container"));

    expect(addPatternFn).toHaveBeenCalledWith(pattern.name);
  });

  it("deselects selected pattern after clicking it", async () => {
    pattern.selected = 0;
    const { container, user } = await act(async () => installerRender(<PatternItem pattern={pattern} />));

    await user.click(container.querySelector(".pattern-container"));

    expect(removePatternFn).toHaveBeenCalledWith(pattern.name);
  });

  it("deselects automatically selected pattern after clicking it", async () => {
    pattern.selected = 1;
    const { container, user } = await act(async () => installerRender(<PatternItem pattern={pattern} />));

    await user.click(container.querySelector(".pattern-container"));

    expect(removePatternFn).toHaveBeenCalledWith(pattern.name);
  });
});
