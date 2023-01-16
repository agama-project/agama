/*
 * Copyright (c) [2022] SUSE LLC
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
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";

import { createClient } from "@client/index";
import { InstallerClientProvider } from "@context/installer";

const InstallerProvider = ({ children }) => {
  const client = createClient();
  return (
    <InstallerClientProvider client={client}>
      {children}
    </InstallerClientProvider>
  );
};

const installerRender = (ui, options = {}) => {
  return (
    {
      user: userEvent.setup(),
      ...render(ui, { wrapper: InstallerProvider, ...options })
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

export { installerRender, plainRender, createCallbackMock, mockComponent };
