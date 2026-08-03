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
import {
  useSearchParamState,
  useSearchParamTokens,
  useClearSearchParams,
} from "~/hooks/use-search-param-state";

/** Shows the search part of the current URL, so tests can assert what was written. */
const CurrentSearch = () => <output>{useLocation().search}</output>;

const search = () => screen.getByRole("status").textContent;

const renderAt = (url: string, subject: React.ReactNode) => {
  mockRoutes(url);

  return installerRender(
    <>
      {subject}
      <CurrentSearch />
    </>,
  );
};

describe("useSearchParamState", () => {
  const Subject = () => {
    const [tab, setTab] = useSearchParamState("st", "0");

    return (
      <>
        <p>Tab: {tab}</p>
        <button onClick={() => setTab(2)}>select third</button>
        <button onClick={() => setTab(0)}>select first</button>
        <button onClick={() => setTab(undefined)}>clear</button>
      </>
    );
  };

  it("falls back to the given default when the param is missing", () => {
    renderAt("/page", <Subject />);
    screen.getByText("Tab: 0");
  });

  it("reads the value from the URL", () => {
    renderAt("/page?st=1", <Subject />);
    screen.getByText("Tab: 1");
  });

  it("writes the value to the URL", async () => {
    const { user } = renderAt("/page", <Subject />);

    await user.click(screen.getByRole("button", { name: "select third" }));

    screen.getByText("Tab: 2");
    expect(search()).toBe("?st=2");
  });

  it("removes the param when the value is unset, keeping the others", async () => {
    const { user } = renderAt("/page?st=1&other=keep", <Subject />);

    await user.click(screen.getByRole("button", { name: "clear" }));

    screen.getByText("Tab: 0");
    expect(search()).toBe("?other=keep");
  });

  it("removes the param when the value written is the default", async () => {
    const { user } = renderAt("/page?st=1", <Subject />);

    await user.click(screen.getByRole("button", { name: "select first" }));

    screen.getByText("Tab: 0");
    expect(search()).toBe("");
  });

  it("keeps a default spelled out in the URL until something is written", () => {
    renderAt("/page?st=0", <Subject />);

    screen.getByText("Tab: 0");
    expect(search()).toBe("?st=0");
  });
});

describe("useSearchParamTokens", () => {
  const Subject = () => {
    const { tokens, hasSearchParamToken, toggleSearchParamToken } = useSearchParamTokens("e");

    return (
      <>
        <p>Tokens: {tokens.join("|")}</p>
        <p>{hasSearchParamToken("d0") ? "d0 present" : "d0 absent"}</p>
        <button onClick={() => toggleSearchParamToken("d0")}>toggle d0</button>
      </>
    );
  };

  it("reports no tokens when the param is missing", () => {
    renderAt("/page", <Subject />);
    screen.getByText("d0 absent");
  });

  it("reads the tokens from the URL", () => {
    renderAt("/page?e=d0,vgsystem", <Subject />);

    screen.getByText("Tokens: d0|vgsystem");
    screen.getByText("d0 present");
  });

  it("adds a token, keeping the ones already there", async () => {
    const { user } = renderAt("/page?e=d1", <Subject />);

    await user.click(screen.getByRole("button", { name: "toggle d0" }));

    screen.getByText("Tokens: d1|d0");
    screen.getByText("d0 present");
  });

  it("removes a token", async () => {
    const { user } = renderAt("/page?e=d0,d1", <Subject />);

    await user.click(screen.getByRole("button", { name: "toggle d0" }));

    screen.getByText("Tokens: d1");
    screen.getByText("d0 absent");
  });

  it("drops the param once the last token is removed, keeping the others", async () => {
    const { user } = renderAt("/page?e=d0&other=keep", <Subject />);

    await user.click(screen.getByRole("button", { name: "toggle d0" }));

    expect(search()).toBe("?other=keep");
  });
});

describe("useClearSearchParams", () => {
  const Subject = () => {
    const clearSearchParams = useClearSearchParams();

    return <button onClick={() => clearSearchParams("e", "st")}>reset</button>;
  };

  it("drops every given param in a single update, keeping the rest", async () => {
    const { user } = renderAt("/page?e=d0&st=1&rt=2", <Subject />);

    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(search()).toBe("?rt=2");
  });
});
