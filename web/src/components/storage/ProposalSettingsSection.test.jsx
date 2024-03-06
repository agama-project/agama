/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ProposalSettingsSection } from "~/components/storage";

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>
  };
});

let props;

beforeEach(() => {
  props = {};
});

const rootVolume = { mountPath: "/", fsType: "Btrfs", outline: { snapshotsConfigurable: true } };

describe("if snapshots are configurable", () => {
  beforeEach(() => {
    props.settings = { volumes: [rootVolume] };
  });

  it("renders the snapshots switch", () => {
    plainRender(<ProposalSettingsSection {...props} />);

    screen.getByRole("checkbox", { name: "Use Btrfs Snapshots" });
  });
});

describe("if snapshots are not configurable", () => {
  beforeEach(() => {
    props.settings = { volumes: [{ ...rootVolume, outline: { ...rootVolume.outline, snapshotsConfigurable: false } }] };
  });

  it("renders the snapshots switch", () => {
    plainRender(<ProposalSettingsSection {...props} />);

    expect(screen.queryByRole("checkbox", { name: "Use Btrfs Snapshots" })).toBeNull();
  });
});

describe("Encryption field", () => {
  describe("if encryption password setting is not set yet", () => {
    beforeEach(() => {
      props.settings = {};
    });

    it("does not render the encryption switch", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      expect(screen.queryByLabelText("Use encryption")).toBeNull();
    });
  });

  describe("if encryption password setting is set", () => {
    beforeEach(() => {
      props.settings = { encryptionPassword: "" };
    });

    it("renders the encryption switch", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByRole("checkbox", { name: "Use encryption" });
    });
  });

  describe("if encryption password is not empty", () => {
    beforeEach(() => {
      props.settings = { encryptionPassword: "1234" };
      props.onChange = jest.fn();
    });

    it("renders the encryption switch as selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      expect(checkbox).toBeChecked();
    });

    it("renders a button for changing the encryption settings", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      screen.getByRole("button", { name: /Encryption settings/ });
    });

    it("changes the selection on click", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      await user.click(checkbox);

      expect(checkbox).not.toBeChecked();
      expect(props.onChange).toHaveBeenCalled();
    });

    it("allows changing the encryption settings when clicking on the settings button", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const button = screen.getByRole("button", { name: /Encryption settings/ });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).toHaveBeenCalled();
    });

    it("allows canceling the changes of the encryption settings", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const button = screen.getByRole("button", { name: /Encryption settings/ });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).not.toHaveBeenCalled();
    });
  });

  describe("if encryption password is empty", () => {
    beforeEach(() => {
      props.settings = { encryptionPassword: "" };
      props.onChange = jest.fn();
    });

    it("renders the encryption switch as not selected", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      expect(checkbox).not.toBeChecked();
    });

    it("does not render a button for changing the encryption settings", () => {
      plainRender(<ProposalSettingsSection {...props} />);

      const button = screen.queryByRole("button", { name: /Encryption settings/ });
      expect(button).toBeNull();
    });

    it("changes the selection and allows changing the settings on click", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      await user.click(checkbox);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "1234");
      await user.type(passwordConfirmInput, "1234");
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      expect(props.onChange).toHaveBeenCalled();
      expect(checkbox).toBeChecked();
    });

    it("does not select encryption if the settings are canceled", async () => {
      const { user } = plainRender(<ProposalSettingsSection {...props} />);

      const checkbox = screen.getByRole("checkbox", { name: "Use encryption" });
      await user.click(checkbox);

      const popup = await screen.findByRole("dialog");
      screen.getByText("Encryption settings");

      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).not.toHaveBeenCalled();
      expect(checkbox).not.toBeChecked();
    });
  });
});
