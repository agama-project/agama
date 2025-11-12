/*
 * Copyright (c) [2022-2024] SUSE LLC
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

/* eslint-disable i18next/no-literal-string */

/**
 * A module for providing utility functions for testing
 *
 * @module test-utils
 */

import React from "react";
import { MemoryRouter, useParams } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { render, within } from "@testing-library/react";
import { createClient } from "~/client/index";
import { InstallerClientProvider } from "~/context/installer";
import { InstallerL10nProvider } from "~/context/installerL10n";
import { isObject, noop } from "radashi";
import { DummyWSClient } from "./client/ws";
import { System } from "./types/system";

/**
 * Internal mock for manipulating routes, using ["/"] by default
 */
const initialRoutes = jest.fn().mockReturnValue(["/"]);

/**
 * Internal mock for manipulating params
 */
let paramsMock: ReturnType<typeof useParams> = {};

/**
 * Allows checking when react-router-dom navigate function  was
 * called with certain path
 *
 * @example
 *   expect(mockNavigateFn).toHaveBeenCalledWith("/")
 */
const mockNavigateFn = jest.fn();

/**
 * Allows checking when the useRevalidator function has been called
 *
 * @example
 *   expect(mockUseRevalidator).toHaveBeenCalled()
 */
const mockUseRevalidator = jest.fn();

/**
 * Allows manipulating MemoryRouter routes for testing purpose
 *
 * NOTE: on purpose, it will take effect only once.
 *
 * @example
 *   mockRoutes("/products", "/storage");
 *
 * @param {...string} routes
 */
const mockRoutes = (...routes) => initialRoutes.mockReturnValueOnce(routes);

/**
 * Allows mocking useParams react-router-dom hook for testing purpose
 *
 * @example
 *   mockParams({ id: "vda" });
 */
const mockParams = (params: ReturnType<typeof useParams>) => (paramsMock = params);

// Centralize the react-router mock here
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useHref: (to) => to,
  useNavigate: () => mockNavigateFn,
  useMatches: () => [],
  useParams: () => paramsMock,
  Navigate: ({ to: route }) => <>Navigating to {route}</>,
  Outlet: () => <>Outlet Content</>,
  useRevalidator: () => mockUseRevalidator,
  useLinkClickHandler:
    ({ to }) =>
    () => {
      to;
    },
}));

const Providers = ({ children, withL10n }) => {
  const ws = new DummyWSClient();
  const client = createClient(new URL("https://localhost"), ws);

  if (!client.onConnect) {
    client.onConnect = noop;
  }

  // FIXME: workaround to fix the tests. We should inject
  // the client instead of mocking `createClient`.
  if (!client.onClose) {
    client.onClose = noop;
  }

  if (withL10n) {
    const fetchConfig = async (): Promise<System> => ({
      l10n: {
        keymap: "us",
        timezone: "Europe/Berlin",
        locale: "en_US",
      },
    });
    return (
      <InstallerClientProvider client={client}>
        <InstallerL10nProvider initialLanguage="en-US" fetchConfigFn={fetchConfig}>
          {children}
        </InstallerL10nProvider>
      </InstallerClientProvider>
    );
  }

  return <InstallerClientProvider client={client}>{children}</InstallerClientProvider>;
};

/**
 * Wrapper around react-testing-library#render for rendering components within
 * installer providers.
 *
 * @see #plainRender for rendering without installer providers
 */
const installerRender = (ui: React.ReactNode, options: { withL10n?: boolean } = {}) => {
  const queryClient = new QueryClient({});

  const Wrapper = ({ children }) => (
    <Providers withL10n={options.withL10n}>
      <MemoryRouter initialEntries={initialRoutes()}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    </Providers>
  );

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
};

/**
 * Wrapper around react-testing-library#render for rendering components without
 * installer providers.
 *
 * @see #installerRender for using installer providers
 *
 * @note Please, be aware that it's needed to mock the core/Sidebar component
 * when testing a Page with #plainRender helper in order to avoid the test crashing
 * because mounted without provides unless you take care of mocking core/sidebar
 * content. The reason for this is that core/Page is always rendering
 * core/Sidebar as part of the layout.
 */
const plainRender = (ui, options = {}) => {
  const queryClient = new QueryClient({});

  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
};

/**
 * Creates a function to register callbacks
 *
 * It can be useful to mock functions that might receive a callback that you can
 * execute on-demand during the test.
 *
 * @return a tuple with the mocked function and the list of callbacks.
 */
const createCallbackMock = (): [(callback: Function) => () => void, Array<(arg0) => void>] => {
  const callbacks = [];
  const on = (callback: Function) => {
    callbacks.push(callback);
    return () => {
      const position = callbacks.indexOf(callback);
      if (position > -1) callbacks.splice(position, 1);
    };
  };
  return [on, callbacks];
};

/**
 * Helper for clearing window.localStorage and setting an initial state if needed.
 *
 * @param [initialState] - a collection of keys/values as
 *   expected by {@link https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem Web Storage API setItem method}
 */
const resetLocalStorage = (initialState?: { [key: string]: string }) => {
  window.localStorage.clear();

  if (!isObject(initialState)) return;

  Object.entries(initialState).forEach(([key, value]) => {
    window.localStorage.setItem(key, value);
  });
};

/**
 * Extracts all cell values from a specific column in an HTML table,
 * based on the column's `data-label` attribute.
 *
 * Skips the header row and returns trimmed text content for each matching cell.
 *
 * @param table - The `<table>` element to extract data from.
 * @param columnName - The value of the `data-label` attribute identifying the column (e.g., "Device", "Size").
 * @returns An array of strings containing the text content of each cell in the specified column.
 *
 * @example
 * ```ts
 * const table = screen.getByRole("table");
 * const deviceNames = getColumnValues(table, "Device");
 * expect(deviceNames).toEqual(["/dev/sda", "/dev/sdb", "/dev/sdc"]);
 * ```
 */
const getColumnValues = (table: HTMLElement | HTMLTableElement, columnName: string) =>
  within(table)
    .getAllByRole("row")
    .slice(1) // Skip header
    .map((row) => row.querySelector(`[data-label="${columnName}"]`)?.textContent?.trim());

export {
  plainRender,
  installerRender,
  createCallbackMock,
  mockNavigateFn,
  mockParams,
  mockRoutes,
  mockUseRevalidator,
  resetLocalStorage,
  getColumnValues,
};
