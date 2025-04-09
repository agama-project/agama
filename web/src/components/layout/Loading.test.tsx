/*
 * Copyright (c) [2022] SUSE LLC
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
import { installerRender, plainRender } from "~/test-utils";

import Loading from "./Loading";

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

describe("Loading", () => {
  it("renders provided text", async () => {
    plainRender(<Loading text="Loading something" />);
    await screen.findByText("Loading something");
  });

  it("uses provided aria-label", async () => {
    plainRender(<Loading aria-label="Loading something" />);
    const icon = await screen.findByLabelText("Loading something");
    expect(icon).toHaveRole("progressbar");
  });

  it("uses 'Loading' as default aria-label when neither text nor aria-label is provided", async () => {
    plainRender(<Loading />);
    const icon = await screen.findByLabelText("Loading");
    expect(icon).toHaveRole("progressbar");
  });

  it("hides the spinner icon from a11y tree when text is given", () => {
    const { container } = plainRender(<Loading text="Loading something" />);
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden");
  });

  it("wraps itself within a PlainLayout without header and sideabar when listenQuestions is enabled", () => {
    installerRender(<Loading text="Making a test" listenQuestions />);
    expect(screen.queryByText("Header Mock")).toBeNull();
    expect(screen.queryByText("Sidebar Mock")).toBeNull();
    screen.getByText("PlainLayout Mock");
    screen.getByText("Making a test");
  });

  it("does not wrap itself within a PlainLayout when listenQuestions is not used or set to false", () => {
    const { rerender } = plainRender(<Loading text="Making a test" />);
    expect(screen.queryByText("PlainLayout Mock")).toBeNull();
    rerender(<Loading text="Making a test" listenQuestions={false} />);
    expect(screen.queryByText("PlainLayout Mock")).toBeNull();
  });
});
