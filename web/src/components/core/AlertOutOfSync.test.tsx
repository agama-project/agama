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

import React, { act } from "react";
import { screen, within } from "@testing-library/dom";
import { installerRender, plainRender } from "~/test-utils";
import AlertOutOfSync from "./AlertOutOfSync";

const mockOnEvent = jest.fn();
const mockReload = jest.fn();

const mockClient = {
  id: "current-client",
  isConnected: jest.fn().mockResolvedValue(true),
  isRecoverable: jest.fn(),
  onConnect: jest.fn(),
  onClose: jest.fn(),
  onError: jest.fn(),
  onEvent: mockOnEvent,
};

let consoleErrorSpy: jest.SpyInstance;

jest.mock("~/context/installer", () => ({
  ...jest.requireActual("~/context/installer"),
  useInstallerClient: () => mockClient,
}));
jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  locationReload: () => mockReload(),
}));

describe("AlertOutOfSync", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  it("renders nothing if scope is missing", () => {
    // @ts-expect-error: scope is required prop
    const { container } = plainRender(<AlertOutOfSync />);
    expect(container).toBeEmptyDOMElement();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("must receive a value for `scope`"),
    );
  });

  it("renders nothing if scope empty", () => {
    const { container } = plainRender(<AlertOutOfSync scope="" />);
    expect(container).toBeEmptyDOMElement();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("must receive a value for `scope`"),
    );
  });

  it("shows alert on matching changes event from a different client for subscribed scope", () => {
    let eventCallback;
    mockClient.onEvent.mockImplementation((cb) => {
      eventCallback = cb;
      return () => {};
    });

    installerRender(<AlertOutOfSync scope="Watched" />);

    // Should not render the alert initially
    expect(screen.queryByRole("dialog")).toBeNull();

    // Simulate a change event for a different scope
    act(() => {
      eventCallback({ type: "NotWatchedChanged", clientId: "other-client" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();

    // Simulate a change event for the subscribed scope, from current client
    act(() => {
      eventCallback({ type: "WatchedChanged", clientId: "current-client" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();

    // Simulate a change event for the subscribed scope, from different client
    act(() => {
      eventCallback({ type: "WatchedChanged", clientId: "other-client" });
    });

    const dialog = screen.getByRole("dialog", { name: "Configuration out of sync" });
    within(dialog).getByRole("button", { name: "Reload now" });
  });

  it("dismisses automatically the alert on matching changes event from current client for subscribed scope", () => {
    let eventCallback;
    mockClient.onEvent.mockImplementation((cb) => {
      eventCallback = cb;
      return () => {};
    });

    installerRender(<AlertOutOfSync scope="Watched" />);

    // Simulate a change event for the subscribed scope, from different client
    act(() => {
      eventCallback({ type: "WatchedChanged", clientId: "other-client" });
    });

    screen.getByRole("dialog", { name: "Configuration out of sync" });

    // Simulate a change event for the subscribed scope, from current client
    act(() => {
      eventCallback({ type: "WatchedChanged", clientId: "current-client" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("triggers a location relaod when clicking on `Reload now`", async () => {
    let eventCallback;
    mockClient.onEvent.mockImplementation((cb) => {
      eventCallback = cb;
      return () => {};
    });

    const { user } = installerRender(<AlertOutOfSync scope="Watched" />);

    // Simulate a change event for the subscribed scope, from different client
    act(() => {
      eventCallback({ type: "WatchedChanged", clientId: "other-client" });
    });

    const reloadButton = screen.getByRole("button", { name: "Reload now" });
    await user.click(reloadButton);
    expect(mockReload).toHaveBeenCalled();
  });
});
