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
import { useLocation } from "react-router";
import { installerRender, mockRoutes } from "~/test-utils";
import { _ } from "~/i18n";
import useSortedByParam from "~/hooks/use-sorted-by-param";

import type { SelectableDataTableColumn } from "~/components/core/SelectableDataTable";

/** Shows the search part of the current URL, so tests can assert what was written. */
const CurrentSearch = () => <output>{useLocation().search}</output>;

const search = () => screen.getByRole("status").textContent;

const columns: SelectableDataTableColumn[] = [
  { name: _("Name"), value: () => null, sortingKey: "name" },
  { name: _("Status"), value: () => null, sortingKey: "status" },
  {
    // A computed key has no name of its own, hence the explicit identifier.
    name: _("Channel"),
    value: () => null,
    sortingKey: () => 0,
    sortingId: "channel",
  },
  { name: _("Actions"), value: () => null },
];

const defaultValue = { index: 0, direction: "asc" } as const;

/**
 * Renders the sorting held in the given param, and lets a test change it.
 */
const Subject = ({ param = "s" }: { param?: string }) => {
  const [sortedBy, updateSorting] = useSortedByParam(columns, { param, defaultValue });

  return (
    <>
      <p>{`${param}: ${sortedBy.index} ${sortedBy.direction}`}</p>
      <button onClick={() => updateSorting({ index: 2, direction: "desc" })}>
        {`sort ${param} by channel, descending`}
      </button>
      <button onClick={() => updateSorting({ index: 1, direction: "asc" })}>
        {`sort ${param} by status`}
      </button>
      <button onClick={() => updateSorting({ index: 0, direction: "asc" })}>
        {`sort ${param} by name`}
      </button>
      <button onClick={() => updateSorting({ index: 3, direction: "desc" })}>
        {`sort ${param} by actions`}
      </button>
    </>
  );
};

const renderAt = (url: string, subject: React.ReactNode) => {
  mockRoutes(url);

  return installerRender(
    <>
      {subject}
      <CurrentSearch />
    </>,
  );
};

describe("useSortedByParam", () => {
  it("falls back to the given default when the param is missing", () => {
    renderAt("/page", <Subject />);
    screen.getByText("s: 0 asc");
  });

  it("reads the column and the direction from the URL", () => {
    renderAt("/page?s=status:desc", <Subject />);
    screen.getByText("s: 1 desc");
  });

  it("reads a column addressed by its sorting id", () => {
    renderAt("/page?s=channel", <Subject />);
    screen.getByText("s: 2 asc");
  });

  it("takes ascending as the direction when the param does not say", () => {
    renderAt("/page?s=status", <Subject />);
    screen.getByText("s: 1 asc");
  });

  it("falls back when the param names a column that does not exist", () => {
    renderAt("/page?s=nonsense:desc", <Subject />);
    screen.getByText("s: 0 asc");
  });

  it("falls back when the direction is not one it understands", () => {
    renderAt("/page?s=status:sideways", <Subject />);
    screen.getByText("s: 0 asc");
  });

  it("writes the column and the direction", async () => {
    const { user } = renderAt("/page", <Subject />);

    await user.click(screen.getByRole("button", { name: "sort s by channel, descending" }));

    screen.getByText("s: 2 desc");
    expect(search()).toBe("?s=channel%3Adesc");
  });

  it("leaves the direction out when ascending", async () => {
    const { user } = renderAt("/page", <Subject />);

    await user.click(screen.getByRole("button", { name: "sort s by status" }));

    expect(search()).toBe("?s=status");
  });

  it("removes the param when sorting is back to the default, keeping the others", async () => {
    const { user } = renderAt("/page?s=status&other=keep", <Subject />);

    await user.click(screen.getByRole("button", { name: "sort s by name" }));

    screen.getByText("s: 0 asc");
    expect(search()).toBe("?other=keep");
  });

  it("removes the param when the column cannot be addressed", async () => {
    const { user } = renderAt("/page?s=status", <Subject />);

    await user.click(screen.getByRole("button", { name: "sort s by actions" }));

    expect(search()).toBe("");
  });

  it("keeps two tables apart, each reading only its own param", async () => {
    const { user } = renderAt(
      "/page?first=status:desc",
      <>
        <Subject param="first" />
        <Subject param="second" />
      </>,
    );

    screen.getByText("first: 1 desc");
    screen.getByText("second: 0 asc");

    await user.click(screen.getByRole("button", { name: "sort second by channel, descending" }));

    screen.getByText("first: 1 desc");
    screen.getByText("second: 2 desc");
    expect(search()).toBe("?first=status%3Adesc&second=channel%3Adesc");
  });
});
