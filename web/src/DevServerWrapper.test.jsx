/*
 * Copyright (c) [2023] SUSE LLC
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
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import DevServerWrapper from "~/DevServerWrapper";

// mock XMLHttpRequest object
const xhrMock = {
  open: jest.fn(),
  send: jest.fn(),
};

describe("DevServerWrapper", () => {
  it("displays loading content at the beginning and starts a request", async () => {
    jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => xhrMock);

    render(<DevServerWrapper />);
    screen.getByText(/Loading installation environment/);

    expect(xhrMock.open).toBeCalledWith("GET", "/cockpit/login");
    expect(xhrMock.send).toHaveBeenCalled();
  });

  describe("when user is not authenticated", () => {
    const xhrMockNotAuth = {
      status: 401,
      ...xhrMock
    };

    beforeEach(() => {
      jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => xhrMockNotAuth);
    });

    it("displays the login dialog", async () => {
      const { container } = render(<DevServerWrapper />);
      // wait until the XHR finish handler is set up
      await waitFor(() => expect(xhrMockNotAuth.onloadend).toBeDefined());
      act(() => xhrMockNotAuth.onloadend());

      // an iframe with Cockpit terminal application is used for logging in
      const iframe = container.querySelector("iframe");
      expect(iframe.src).toMatch(/cockpit\/@localhost\/system\/terminal.html$/);
    });
  });

  describe("when user is already authenticated", () => {
    const xhrMockAuth = {
      status: 200,
      ...xhrMock
    };

    beforeEach(() => {
      jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => xhrMockAuth);
    });

    it("displays the children content", async () => {
      render(<DevServerWrapper>Testing content</DevServerWrapper>);
      // wait until the XHR finish handler is set up
      await waitFor(() => expect(xhrMockAuth.onloadend).toBeDefined());
      act(() => xhrMockAuth.onloadend());
      // children are displayed
      await screen.findByText("Testing content");
    });
  });

  describe("when authentication status request fails", () => {
    const xhrMockError = {
      status: 500,
      ...xhrMock
    };

    beforeEach(() => {
      jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => xhrMockError);
    });

    it("displays an error message", async () => {
      render(<DevServerWrapper />);
      // wait until the XHR finish handler is set up
      await waitFor(() => expect(xhrMockError.onloadend).toBeDefined());
      act(() => xhrMockError.onloadend());
      await screen.findByText("Cannot connect to the Cockpit server");
    });
  });

  describe("when authentication status request times out", () => {
    beforeEach(() => {
      jest.spyOn(window, 'XMLHttpRequest').mockImplementation(() => xhrMock);
    });

    it("displays an error message", async () => {
      render(<DevServerWrapper />);
      // wait until the XHR finish handler is set up
      await waitFor(() => expect(xhrMock.ontimeout).toBeDefined());
      act(() => xhrMock.ontimeout());
      await screen.findByText("Cannot connect to the Cockpit server");
    });
  });
});
