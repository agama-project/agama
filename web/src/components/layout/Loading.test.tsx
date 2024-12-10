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
import { plainRender } from "~/test-utils";

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
  it("renders given message", async () => {
    plainRender(<Loading text="Doing something" />);
    await screen.findByText("Doing something");
  });

  describe("when not using a custom message", () => {
    it("renders the default loading environment message", async () => {
      plainRender(<Loading />);
      await screen.findByText(/Loading installation environment/i);
    });
  });

  describe("when not using the useLayout prop or its value is false", () => {
    it("does not wrap the content within a PlainLayout", () => {
      const { rerender } = plainRender(<Loading text="Making a test" />);
      expect(screen.queryByText("PlainLayout Mock")).toBeNull();
      rerender(<Loading text="Making a test" useLayout={false} />);
      expect(screen.queryByText("PlainLayout Mock")).toBeNull();
    });
  });

  describe("when using the useLayout prop", () => {
    it("wraps the content within a PlainLayout with neither, header nor sidebar", () => {
      plainRender(<Loading text="Making a test" useLayout />);
      expect(screen.queryByText("Header Mock")).toBeNull();
      expect(screen.queryByText("Sidebar Mock")).toBeNull();
      screen.getByText("PlainLayout Mock");
      screen.getByText("Making a test");
    });
  });
});
