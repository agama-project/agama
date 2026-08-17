/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { useState } from "react";

import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { _ } from "~/i18n";

import Popup, { PopupProps } from "./Popup";

let isOpen: boolean;
let isLoading: boolean;
const confirmFn = jest.fn();
const cancelFn = jest.fn();

/**
 * Props for {@link TestingPopup}, which always renders its own title and
 * content.
 */
type TestingPopupProps = Omit<PopupProps, "title" | "aria-label" | "children">;

const TestingPopup = (props: TestingPopupProps) => {
  const [isMounted, setIsMounted] = useState(true);
  const loadingText = _("Loading text");

  if (!isMounted) return null;

  return (
    <Popup
      title="Testing Popup Title"
      isOpen={isOpen}
      isLoading={isLoading}
      loadingText={loadingText}
      {...props}
    >
      <p>The Popup Content</p>
      <button onClick={() => setIsMounted(false)}>Unmount Popup</button>
      <Popup.Actions>
        <Popup.Confirm onClick={confirmFn} isDisabled />
        <Popup.Cancel onClick={cancelFn} />
      </Popup.Actions>
    </Popup>
  );
};

describe("Popup", () => {
  const loadingText = _("Loading text");

  describe("when it is not open", () => {
    beforeEach(() => {
      isOpen = false;
    });

    it("renders nothing", async () => {
      installerRender(<TestingPopup />);

      const dialog = screen.queryByRole("dialog");
      expect(dialog).toBeNull();
    });
  });

  describe("when it is open", () => {
    beforeEach(() => {
      isOpen = true;
    });

    it("renders given title and titleAddon inside PF/ModalHeader", async () => {
      installerRender(
        <Popup isOpen title="Awesome Popup" titleAddon={<button>With action at title</button>}>
          <p>Testing</p>
        </Popup>,
      );

      const dialog = await screen.findByRole("dialog");
      const header = within(dialog).getByRole("banner");
      within(header).getByRole("heading", { name: "Awesome Popup" });
      within(header).getByRole("button", { name: "With action at title" });
    });

    it("does not render a header when no title is given", async () => {
      installerRender(
        <Popup isOpen aria-label="Bare popup" titleAddon={<button>Addon</button>}>
          <button>Testing</button>
        </Popup>,
      );

      await screen.findByRole("dialog");
      expect(screen.queryByRole("banner")).toBeNull();
    });

    it("names the dialog after the given title", async () => {
      installerRender(<TestingPopup />);

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveAccessibleName("Testing Popup Title");
    });

    it("describes the dialog with its content", async () => {
      installerRender(<TestingPopup />);

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveAccessibleDescription(expect.stringContaining("The Popup Content"));
    });

    it("names the dialog after aria-label when rendered without a title", async () => {
      installerRender(
        <Popup isOpen aria-label="Bare popup">
          <button>Testing</button>
        </Popup>,
      );

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveAccessibleName("Bare popup");
    });

    describe("and no onClose callback is given", () => {
      it("renders no close button and ignores the Escape key", async () => {
        const { user } = installerRender(<TestingPopup />);

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();

        await user.keyboard("{Escape}");
        screen.getByRole("dialog");
      });
    });

    describe("and an onClose callback is given", () => {
      it("renders a close button and honors the Escape key", async () => {
        const onClose = jest.fn();
        const { user } = installerRender(<TestingPopup onClose={onClose} />);

        const dialog = await screen.findByRole("dialog");
        const closeButton = within(dialog).getByRole("button", { name: "Close" });

        await user.click(closeButton);
        expect(onClose).toHaveBeenCalled();

        onClose.mockClear();
        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalled();
      });
    });

    describe("and not loading", () => {
      beforeEach(() => {
        isLoading = false;
      });

      it("renders the popup content inside a PF/Modal", async () => {
        installerRender(<TestingPopup />);

        const dialog = await screen.findByRole("dialog");
        expect(dialog.classList.contains("pf-v6-c-modal-box")).toBe(true);

        within(dialog).getByText("The Popup Content");
      });

      it("does not display a progress message", async () => {
        installerRender(<TestingPopup />);

        const dialog = await screen.findByRole("dialog");

        expect(within(dialog).queryByText(loadingText)).toBeNull();
      });

      it("renders the popup actions inside a PF/Modal footer", async () => {
        installerRender(<TestingPopup />);

        const dialog = await screen.findByRole("dialog");
        // NOTE: Sadly, PF Modal/ModalFooter does not have a footer or navigation role.
        // So, using https://developer.mozilla.org/es/docs/Web/API/Document/querySelector
        // for getting the footer. See https://github.com/testing-library/react-testing-library/issues/417 too.
        const footer = dialog.querySelector("footer");

        within(footer).getByText("Confirm");
        within(footer).getByText("Cancel");
      });

      it("renders a footer even when no actions are given", async () => {
        installerRender(
          <Popup isOpen title="No actions">
            {/* PF focus trap needs at least one tabbable node inside the dialog */}
            <button>Just content</button>
          </Popup>,
        );

        const dialog = await screen.findByRole("dialog");
        const footer = dialog.querySelector("footer");

        expect(footer).not.toBeNull();
        expect(within(footer).queryAllByRole("button")).toEqual([]);
      });

      it("places actions in the body when they are not a direct Popup.Actions child", async () => {
        installerRender(
          <Popup isOpen title="Wrapped actions">
            <p>Just content</p>
            <>
              <Popup.Actions>
                <Popup.Confirm onClick={confirmFn} />
              </Popup.Actions>
            </>
          </Popup>,
        );

        const dialog = await screen.findByRole("dialog");
        const footer = dialog.querySelector("footer");

        expect(within(footer).queryByRole("button", { name: "Confirm" })).toBeNull();
        within(dialog).getByRole("button", { name: "Confirm" });
      });
    });

    describe("and loading", () => {
      beforeEach(() => {
        isLoading = true;
      });

      it("displays progress message instead of the content", async () => {
        installerRender(<TestingPopup />);

        const dialog = await screen.findByRole("dialog");

        expect(within(dialog).queryByText("The Popup Content")).toBeNull();
        within(dialog).getByText(loadingText);
      });
    });
  });
});

describe("Popup.PrimaryAction", () => {
  it("renders a 'primary' button with given children as content", async () => {
    installerRender(<Popup.PrimaryAction>Do something</Popup.PrimaryAction>);

    const button = screen.queryByRole("button", { name: "Do something" });
    expect(button.classList.contains("pf-m-primary")).toBe(true);
  });
});

describe("Popup.SecondaryAction", () => {
  it("renders a 'secondary' button with given children as content", async () => {
    installerRender(<Popup.SecondaryAction>Do something</Popup.SecondaryAction>);

    const button = screen.queryByRole("button", { name: "Do something" });
    expect(button.classList.contains("pf-m-secondary")).toBe(true);
  });

  it("renders a 'link' button when asLink is set", async () => {
    installerRender(<Popup.SecondaryAction asLink>Do something</Popup.SecondaryAction>);

    const button = screen.queryByRole("button", { name: "Do something" });
    expect(button.classList.contains("pf-m-link")).toBe(true);
  });
});

describe("Popup.AncillaryAction", () => {
  it("renders a 'link' button with given children as content", async () => {
    installerRender(<Popup.AncillaryAction>Do not use</Popup.AncillaryAction>);

    const button = screen.queryByRole("button", { name: "Do not use" });
    expect(button.classList.contains("pf-m-link")).toBe(true);
  });
});

describe("Popup.DangerousAction", () => {
  it("renders a 'danger' button with given children as content", async () => {
    installerRender(<Popup.DangerousAction>Format everything</Popup.DangerousAction>);

    const button = screen.queryByRole("button", { name: "Format everything" });
    expect(button.classList.contains("pf-m-danger")).toBe(true);
  });
});

describe("Popup.Confirm", () => {
  describe("when holding no children", () => {
    it("renders a 'primary' button using 'Confirm' text as content", async () => {
      installerRender(<Popup.Confirm />);

      const button = screen.queryByRole("button", { name: "Confirm" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-primary")).toBe(true);
    });
  });

  describe("when holding children", () => {
    it("renders a 'primary' button with children as content", async () => {
      installerRender(<Popup.Confirm>Let's go</Popup.Confirm>);

      const button = screen.queryByRole("button", { name: "Let's go" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-primary")).toBe(true);
    });
  });
});

describe("Popup.Cancel", () => {
  describe("when holding no children", () => {
    it("renders a 'secondary' button using 'Cancel' text as content", async () => {
      installerRender(<Popup.Cancel />);

      const button = screen.queryByRole("button", { name: "Cancel" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-secondary")).toBe(true);
    });
  });

  describe("when holding children", () => {
    it("renders a 'secondary' button with children as content", async () => {
      installerRender(<Popup.Cancel>Discard</Popup.Cancel>);

      const button = screen.queryByRole("button", { name: "Discard" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-secondary")).toBe(true);
    });
  });

  describe("when asLink is set", () => {
    it("renders a 'link' button", async () => {
      installerRender(<Popup.Cancel asLink />);

      const button = screen.queryByRole("button", { name: "Cancel" });
      expect(button).not.toBeNull();
      expect(button.classList.contains("pf-m-link")).toBe(true);
    });
  });
});
