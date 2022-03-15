import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import InstallationProgress from "./InstallationProgress";
import { createClient } from "./lib/client";
import statuses from "./lib/client/statuses";

jest.mock("./lib/client");

let getStatusFn = jest.fn();

describe("InstallationProgress", () => {
  beforeEach(() => {
    createClient.mockImplementation(() => {
      return {
        manager: {
          onChange: _changes => Promise.resolve({}),
          getStatus: getStatusFn
        }
      };
    });
  });

  describe("when probing the system", () => {
    beforeEach(() => {
      getStatusFn = () => statuses.PROBING;
    });

    it("uses 'Probing' as title", async () => {
      authRender(<InstallationProgress />);

      await screen.findByText("Probing");
    });

    it("shows none actions", async () => {
      authRender(<InstallationProgress />);

      await screen.findByText("Probing");

      const button = screen.queryByRole("button", { name: /Finish/ });
      expect(button).toBeNull();
    });
  });

  describe("when installing", () => {
    beforeEach(() => {
      getStatusFn = () => statuses.INSTALLING;
    });

    it("uses 'Installing' as title", async () => {
      authRender(<InstallationProgress />);

      await screen.findByText("Installing");

      const button = await screen.findByRole("button", { name: /Finish/ });
      expect(button).toHaveAttribute("disabled");
    });

    it("shows disabled 'Finish' action", async () => {
      authRender(<InstallationProgress />);

      const button = await screen.findByRole("button", { name: /Finish/ });
      expect(button).toHaveAttribute("disabled");
    });
  });

  describe("when installation finished", () => {
    beforeEach(() => {
      getStatusFn = () => statuses.INSTALLED;
    });

    it("shows the finished installation screen", async () => {
      authRender(<InstallationProgress />);

      await screen.findByText("Congratulations!");
      await screen.findByRole("button", { name: /Finish/ });
    });

    it("shows enabled 'Finish' action", async () => {
      authRender(<InstallationProgress />);

      const button = await screen.findByRole("button", { name: /Finish/ });
      expect(button).not.toHaveAttribute("disabled");
    });
  });
});
