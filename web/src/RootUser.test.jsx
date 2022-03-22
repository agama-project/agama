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

import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import { createClient } from "./lib/client";

import RootUser from "./RootUser";

jest.mock("./lib/client");

let password;
let isRootPasswordSetFn = () => Promise.resolve(true);
let setRootPasswordFn = jest.fn();

const openDialog = async () => {
  authRender(<RootUser />);

  const dialogLink = await screen.findByRole("button", { name: /Root Password/i });
  userEvent.click(dialogLink);
};

const closeDialog = async () => {
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
};

const enterPasswordAndConfirm = async password => {
  const passwordInput = await screen.findByTestId("root-password-input");
  userEvent.type(passwordInput, password);

  const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
  act(() => {
    userEvent.click(confirmButton);
  });

  expect(setRootPasswordFn).toHaveBeenCalled();
};

const clickCancelAndCloseDialog = async () => {
  const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
  userEvent.click(cancelButton);

  await closeDialog();
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      users: {
        isRootPasswordSet: isRootPasswordSetFn,
        setRootPassword: setRootPasswordFn
      }
    };
  });
});

describe("RootUser", () => {
  describe("while waiting for the root password status", () => {
    it("displays a loading component", async () => {
      authRender(<RootUser />);
      await screen.findByText("Loading root password status");
    });
  });

  describe("when the root password is not set", () => {
    beforeEach(() => {
      isRootPasswordSetFn = () => Promise.resolve(false);
    });

    it("displays a link to set the root password", async () => {
      authRender(<RootUser />);
      await screen.findByRole("button", { name: /not set yet/i });
    });

    describe("and user clicks on the link", () => {
      it("displays a dialog for setting the root password", async () => {
        await openDialog();

        await screen.findByRole("dialog");
        await screen.findByText(/Set Root Password/i);
      });
    });
  });

  describe("when the root password is set", () => {
    beforeEach(() => {
      isRootPasswordSetFn = () => Promise.resolve(true);
    });

    it("displays a link to change the root password", async () => {
      authRender(<RootUser />);
      await screen.findByRole("button", { name: /already set/i });
    });

    describe("and user clicks on the link", () => {
      it("displays a dialog for changing the root password", async () => {
        await openDialog();

        await screen.findByRole("dialog");
        await screen.findByText(/Change Root Password/i);
      });
    });
  });

  describe("when the user opens the dialog", () => {
    it("stars with the confirm action disabled", async () => {
      await openDialog();

      const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
      expect(confirmButton).toBeDisabled();
    });

    describe("and enters a password", () => {
      beforeEach(() => {
        password = "notS3cr3t";
      });

      it("enables the confirm button", async () => {
        await openDialog();

        const passwordInput = await screen.findByTestId("root-password-input");
        userEvent.type(passwordInput, password);

        const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
        expect(confirmButton).toBeEnabled();
      });

      describe("and confirms the change", () => {
        describe("but an error happens while setting the new password", () => {
          beforeEach(() => {
            setRootPasswordFn = jest.fn().mockImplementation(() => {
              throw new Error("Error while setting the root password");
            });
          });

          it("displays an error", async () => {
            await openDialog();
            await enterPasswordAndConfirm(password);
            await screen.findByText(/Something went wrong/i);
          });

          it("does not close the dialog", async () => {
            await openDialog();
            await enterPasswordAndConfirm(password);
            await screen.findByRole("dialog");
          });
        });

        describe("and the password is set correctly", () => {
          beforeEach(() => {
            setRootPasswordFn = jest.fn();
          });

          it("closes the dialog", async () => {
            await openDialog();
            await enterPasswordAndConfirm(password);
            await closeDialog();
          });
        });
      });

      describe("but cancels the change", () => {
        beforeEach(() => {
          setRootPasswordFn = jest.fn();
        });
        it("does not set a new password", async () => {
          await openDialog();

          const passwordInput = await screen.findByTestId("root-password-input");
          userEvent.type(passwordInput, password);

          const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
          userEvent.click(cancelButton);

          expect(setRootPasswordFn).not.toHaveBeenCalled();
        });

        it("closes the dialog", async () => {
          await openDialog();

          const passwordInput = await screen.findByTestId("root-password-input");
          userEvent.type(passwordInput, password);

          await clickCancelAndCloseDialog();
        });
      });
    });

    describe("and do not enter a password", () => {
      it("does not enable the confirm action", async () => {
        await openDialog();

        const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
        expect(confirmButton).toBeDisabled();
      });

      describe("and clicks on cancel action", () => {
        it("closes the dialog", async () => {
          await openDialog();

          await clickCancelAndCloseDialog();
        });
      });
    });
  });
});
