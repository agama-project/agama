/*
 * Copyright (c) [2022-2023] SUSE LLC
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

/**
 * A module for providing utility functions for testing
 *
 * @module test-utils
 */

import React from "react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";

import { createClient } from "~/client/index";
import { InstallerClientProvider } from "~/context/installer";
import { noop, isObject } from "./utils";
import cockpit from "./lib/cockpit";
import { InstallerL10nProvider } from "./context/installerL10n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Internal mock for manipulating routes, using ["/"] by default
 */
const initialRoutes = jest.fn().mockReturnValue(["/"]);

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

// Centralize the react-router-dom mock here
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigateFn,
  Navigate: ({ to: route }) => <>Navigating to {route}</>,
  Outlet: () => <>Outlet Content</>,
  useRevalidator: () => mockUseRevalidator,
}));

const Providers = ({ children, withL10n }) => {
  const client = createClient(new URL("https://localhost"));

  if (!client.onConnect) {
    client.onConnect = noop;
  }

  // FIXME: workaround to fix the tests. We should inject
  // the client instead of mocking `createClient`.
  if (!client.onDisconnect) {
    client.onDisconnect = noop;
  }

  if (!client.manager) {
    client.manager = {};
  }

  client.manager = {
    getPhase: noop,
    getStatus: noop,
    onPhaseChange: noop,
    onStatusChange: noop,
    ...client.manager,
  };

  if (withL10n) {
    return (
      <InstallerClientProvider client={client}>
        <InstallerL10nProvider>{children}</InstallerL10nProvider>
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
const installerRender = (ui, options = {}) => {
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
 * @return {[() => () => void, Array<(any) => void>]} a tuple with the mocked function and the list of callbacks.
 */
const createCallbackMock = () => {
  const callbacks = [];
  const on = (callback) => {
    callbacks.push(callback);
    return () => {
      const position = callbacks.indexOf(callback);
      if (position > -1) callbacks.splice(position, 1);
    };
  };
  return [on, callbacks];
};

/**
 * Mocks the cockpit.gettext() method with an identity function (returns
 * the original untranslated text)
 */
const mockGettext = () => {
  const gettextFn = jest.fn();
  gettextFn.mockImplementation((text) => {
    return text;
  });

  cockpit.gettext.mockImplementation(gettextFn);
};

/**
 * Helper for clearing window.localStorage and setting an initial state if needed.
 *
 * @param {Object.<string, string>} [initialState] - a collection of keys/values as
 *   expected by {@link https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem Web Storage API setItem method}
 */
const resetLocalStorage = (initialState) => {
  window.localStorage.clear();

  if (!isObject(initialState)) return;

  Object.entries(initialState).forEach(([key, value]) => {
    window.localStorage.setItem(key, value);
  });
};

export {
  plainRender,
  installerRender,
  createCallbackMock,
  mockGettext,
  mockNavigateFn,
  mockRoutes,
  mockUseRevalidator,
  resetLocalStorage,
};
