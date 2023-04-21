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
jest.mock('react-router-dom', () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigateFn,
  Navigate: ({ to: route }) => <>Navigating to {route}</>,
  Outlet: () => <>Outlet Content</>
}));

const Providers = ({ children }) => {
  const client = createClient();

  return (
    <InstallerClientProvider client={client}>
      <MemoryRouter initialEntries={initialRoutes()}>
        {children}
      </MemoryRouter>
    </InstallerClientProvider>
  );
};

const installerRender = (ui, options = {}) => {
  return (
    {
      user: userEvent.setup(),
      ...render(ui, { wrapper: Providers, ...options })
    }
  );
};

const plainRender = (ui, options = {}) => {
  return (
    {
      user: userEvent.setup(),
      ...render(ui, options)
    }
  );
};

/**
 * Creates a function to register callbacks
 *
 * It can be useful to mock functions that might receive a callback that you can
 * execute on-demand during the test.
 *
 * @return a tuple with the mocked function and the list of callbacks.
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
 * Returns fake component with given content
 *
 * @param {React.ReactNode} content - content for the fake component
 * @param {object} [options] - Options for building the fake component
 * @param {string} [options.wrapper="div"] - the HTML element to be used for wrapping given content
 *
 * @return a function component
 */
const mockComponent = (content, { wrapper } = { wrapper: "div" }) => {
  const Wrapper = wrapper;
  return () => <Wrapper>{content}</Wrapper>;
};

/**
 * Returns fake component for mocking the Layout and its slots
 *
 * Useful to be used when testing a component that uses either, the Layout itself or any of its
 * slots (a.k.a. portals)
 *
 * @return a function component to mock the Layout
 */
const mockLayout = () => ({
  __esModule: true,
  default: ({ children }) => children,
  Title: ({ children }) => children,
  PageIcon: ({ children }) => children,
  AppActions: ({ children }) => children,
  ContextualActions: ({ children }) => children,
  MainActions: ({ children }) => children,
  AdditionalInfo: ({ children }) => children,
});

export {
  plainRender,
  installerRender,
  createCallbackMock,
  mockComponent,
  mockLayout,
  mockNavigateFn,
  mockRoutes,
};
