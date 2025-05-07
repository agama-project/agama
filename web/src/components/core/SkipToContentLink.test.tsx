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
import SkipToContentLink from "./SkipToContentLink";

const scrollIntoViewMock = jest.fn();

describe("SkipToContent", () => {
  beforeAll(() => {
    // .scrollIntoView is not yet implemented at jsdom, https://github.com/jsdom/jsdom/issues/1695
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterAll(() => {
    HTMLElement.prototype.scrollIntoView = undefined;
  });

  it("renders with default label and contentId", () => {
    plainRender(<SkipToContentLink />);
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("renders with custom label and contentId", () => {
    plainRender(<SkipToContentLink contentId="navigation">Skip to navigation</SkipToContentLink>);
    const skipToNavigationLink = screen.getByRole("link", { name: "Skip to navigation" });
    expect(skipToNavigationLink).toHaveAttribute("href", "#navigation");
  });

  it("focuses and scrolls to target element on [Enter]", async () => {
    const { user } = plainRender(
      <>
        <SkipToContentLink />
        <a href="https://agama-project.github.io/docs">Agama documentation</a>
        <a href="#fake-anchor">Link to elsewhere</a>
        <div id="main-content" tabIndex={-1}>
          Main content
        </div>
      </>,
    );

    const skipToContentLink = screen.getByRole("link", { name: "Skip to content" });
    const mainContent = screen.getByText("Main content");
    expect(skipToContentLink).not.toHaveFocus();
    expect(mainContent).not.toHaveFocus();
    await user.tab();
    expect(skipToContentLink).toHaveFocus();
    expect(mainContent).not.toHaveFocus();
    await user.keyboard("[Enter]");
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(skipToContentLink).not.toHaveFocus();
    expect(mainContent).toHaveFocus();
  });

  it("focuses and scrolls to target element on click", async () => {
    const { user } = plainRender(
      <>
        <SkipToContentLink />
        <a href="https://agama-project.github.io/docs">Agama documentation</a>
        <a href="#fake-anchor">Link to elsewhere</a>
        <div id="main-content" tabIndex={-1}>
          Main content
        </div>
      </>,
    );

    const skipToContentLink = screen.getByRole("link", { name: "Skip to content" });
    const mainContent = screen.getByText("Main content");
    expect(skipToContentLink).not.toHaveFocus();
    expect(mainContent).not.toHaveFocus();
    await user.click(skipToContentLink);
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(skipToContentLink).not.toHaveFocus();
    expect(mainContent).toHaveFocus();
  });
});
