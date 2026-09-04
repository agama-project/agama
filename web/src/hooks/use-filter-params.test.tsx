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
import { act, screen } from "@testing-library/react";
import { useLocation } from "react-router";
import { installerRender, mockRoutes } from "~/test-utils";
import useFilterParams, { textFilter, choiceFilter } from "~/hooks/use-filter-params";

/** How long the hook waits for typing to stop, in milliseconds. */
const DEBOUNCE_DELAY = 300;

/** Shows the search part of the current URL, so tests can assert what was written. */
const CurrentSearch = () => <output>{useLocation().search}</output>;

const search = () => screen.getByRole("status").textContent;

const Subject = () => {
  const { filters, setFilter, resetFilters, hasActiveFilters } = useFilterParams({
    name: textFilter(),
    status: choiceFilter(["active", "offline"]),
  });

  return (
    <>
      <p>Name: {filters.name}</p>
      <p>Status: {filters.status}</p>
      <p>{hasActiveFilters ? "some filter active" : "no filter active"}</p>
      <button onClick={() => setFilter("name", "vda")}>type vda</button>
      <button onClick={() => setFilter("status", "offline")}>pick offline</button>
      <button onClick={() => setFilter("status", "all")}>pick every status</button>
      <button onClick={resetFilters}>clear all filters</button>
    </>
  );
};

const renderAt = (url: string) => {
  mockRoutes(url);

  return installerRender(
    <>
      <Subject />
      <CurrentSearch />
    </>,
    { userEventOptions: { advanceTimers: jest.advanceTimersByTime } },
  );
};

const waitForTypingToStop = async () => {
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_DELAY);
  });
};

describe("useFilterParams", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("reads the filters from the URL", () => {
    renderAt("/page?name=vdb&status=offline");

    screen.getByText("Name: vdb");
    screen.getByText("Status: offline");
    screen.getByText("some filter active");
  });

  it("reads a choice naming something unknown as its default", () => {
    renderAt("/page?status=nonsense");

    screen.getByText("Status: all");
    screen.getByText("no filter active");
  });

  it("writes a choice to the URL as soon as it is picked", async () => {
    const { user } = renderAt("/page");

    await user.click(screen.getByRole("button", { name: "pick offline" }));

    screen.getByText("Status: offline");
    expect(search()).toBe("?status=offline");
  });

  it("drops the param of a choice put back to its default", async () => {
    const { user } = renderAt("/page?status=offline&other=keep");

    await user.click(screen.getByRole("button", { name: "pick every status" }));

    screen.getByText("Status: all");
    expect(search()).toBe("?other=keep");
  });

  it("shows what was typed before the URL catches up", async () => {
    const { user } = renderAt("/page");

    await user.click(screen.getByRole("button", { name: "type vda" }));

    screen.getByText("Name: vda");
    expect(search()).toBe("");
  });

  it("writes what was typed once typing stops", async () => {
    const { user } = renderAt("/page");

    await user.click(screen.getByRole("button", { name: "type vda" }));
    await waitForTypingToStop();

    screen.getByText("Name: vda");
    expect(search()).toBe("?name=vda");
  });

  it("drops every filter in one update, keeping other params", async () => {
    const { user } = renderAt("/page?name=vdb&status=offline&other=keep");

    await user.click(screen.getByRole("button", { name: "clear all filters" }));

    screen.getByText("Name:");
    screen.getByText("Status: all");
    expect(search()).toBe("?other=keep");
  });

  it("drops what was typed most recently when the filters are cleared", async () => {
    const { user } = renderAt("/page");

    await user.click(screen.getByRole("button", { name: "type vda" }));
    await user.click(screen.getByRole("button", { name: "clear all filters" }));
    await waitForTypingToStop();

    screen.getByText("Name:");
    expect(search()).toBe("");
  });
});
