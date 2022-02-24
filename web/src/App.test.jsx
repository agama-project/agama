import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import App from "./App";
import InstallerClient from "./lib/InstallerClient";

jest.mock("./lib/InstallerClient");
jest.mock("./Installer", () => {
  return {
    __esModule: true,
    default: () => {
      return <div>Installer Component</div>;
    }
  };
});

describe("when the user is already logged in", () => {
  beforeEach(() => {
    InstallerClient.mockImplementation(() => {
      return {
        authorize: (_username, _password) => Promise.resolve(false),
        isLoggedIn: () => Promise.resolve(true),
        currentUser: () => Promise.resolve("jane")
      };
    });
  });

  it("shows the installer", async () => {
    authRender(<App />);
    await screen.findByText("Installer Component");
  });
});

describe("when username and password are wrong", () => {
  beforeEach(() => {
    InstallerClient.mockImplementation(() => {
      return {
        authorize: () => Promise.reject("password does not match"),
        isLoggedIn: () => Promise.resolve(false),
        onSignal: jest.fn()
      };
    });
  });

  it("shows an error", async () => {
    authRender(<App />);
    userEvent.type(screen.getByLabelText(/Username/i), "john");
    userEvent.type(screen.getByLabelText(/Password/i), "something");
    userEvent.click(screen.getByRole("button", { name: /Login/ }));
    await screen.findByText(/Authentication failed/i);
  });
});
