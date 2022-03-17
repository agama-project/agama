import React from "react";

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";

import DBusError from "./DBusError";

describe("DBusError", () => {
  it("includes a generic D-Bus connection problem message", async () => {
    authRender(<DBusError />);

    await screen.findByText(/Could not connect to the D-Bus service/i);
  });

  it("includes a button for reloading", async () => {
    authRender(<DBusError />);

    await screen.findByRole("button", { name: /Reload/i });
  });

  it("calls location.reload when user clicks on 'Reload'", async () => {
    authRender(<DBusError />);

    const reloadButton = await screen.findByRole("button", { name: /Reload/i });

    // Mock location.reload
    // https://remarkablemark.org/blog/2021/04/14/jest-mock-window-location-href
    const { location } = window;
    delete window.location;
    window.location = { reload: jest.fn() };

    userEvent.click(reloadButton);
    expect(window.location.reload).toHaveBeenCalled();

    // restore windows.location
    window.location = location;
  });
});
