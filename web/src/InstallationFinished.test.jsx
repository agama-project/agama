import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import InstallationFinished from "./InstallationFinished";
import { createClient } from "./lib/client";

jest.mock("./lib/client");

let startProbingFn = jest.fn();

describe("InstallationFinished", () => {
  beforeEach(() => {
    createClient.mockImplementation(() => {
      return {
        manager: {
          startProbing: startProbingFn
        }
      };
    });
  });

  it("shows the finished installation screen", async () => {
    authRender(<InstallationFinished />);

    await screen.findByText("Congratulations!");
  });

  it("shows a 'Finish' button", async () => {
    authRender(<InstallationFinished />);

    await screen.findByRole("button", { name: /Finish/i });
  });

  it("shows a 'Restart Installation' button", async () => {
    authRender(<InstallationFinished />);

    await screen.findByRole("button", { name: /Restart Installation/i });
  });

  it("starts the probing process if user clicks on 'Restart Installation' button", async () => {
    authRender(<InstallationFinished />);

    const button = await screen.findByRole("button", { name: /Restart Installation/i });
    userEvent.click(button);
    expect(startProbingFn).toHaveBeenCalled();
  });
});
