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

import { screen, within } from "@testing-library/react";
import { installerRender } from "@/test-utils";
import { ProposalSettingsForm } from "@components/storage";

const proposal = {
  lvm: false,
  encryptionPassword: ""
};
const onSubmitFn = jest.fn();
const onValidateFn = jest.fn();

describe("ProposalSettingsForm", () => {
  it("renders an input for changing LVM settings", () => {
    installerRender(
      <ProposalSettingsForm proposal={proposal} />
    );

    screen.getByRole("checkbox", { name: "Use LVM" });
  });

  it("renders a group with the encryption options", () => {
    installerRender(
      <ProposalSettingsForm proposal={proposal} />
    );

    const encryptionOptions = screen.getByRole("group", { name: "Encrypt devices" });
    within(encryptionOptions).getByRole("checkbox", { name: "Encrypt devices" });
    // NOTE: an input[type=password] has no role, find it by its label.
    // Read more at:
    //   - https://www.w3.org/TR/html-aria/#el-input-password
    //     If a cell in the third column includes the term **No role** it indicates that authors
    //     **MUST NOT** overwrite the implicit ARIA semantics, or native semantics of the HTML element.
    //   - https://github.com/w3c/aria/issues/935
    //   - https://github.com/testing-library/dom-testing-library/issues/567#issuecomment-967789345
    within(encryptionOptions).getByLabelText("Password");
  });

  describe("Input for setting LVM", () => {
    it("gets its initial value from given proposal", () => {
      installerRender(
        <ProposalSettingsForm proposal={{ lvm: true }} />
      );

      const lvmCheckbox = screen.getByRole("checkbox", { name: "Use LVM" });
      expect(lvmCheckbox).toBeChecked();
    });

    it("changes its value when user clicks on it", async () => {
      const { user } = installerRender(
        <ProposalSettingsForm proposal={proposal} />
      );

      const lvmCheckbox = screen.getByRole("checkbox", { name: "Use LVM" });

      expect(lvmCheckbox).not.toBeChecked();
      await user.click(lvmCheckbox);
      expect(lvmCheckbox).toBeChecked();
    });
  });

  describe("Input for enabling encryption options", () => {
    it("gets rendered as NOT checked when given proposal does not contain a password", () => {
      installerRender(
        <ProposalSettingsForm proposal={proposal} />
      );

      const encryptionOptionsCheckbox = screen.getByRole("checkbox", { name: "Encrypt devices" });
      expect(encryptionOptionsCheckbox).not.toBeChecked();
    });

    it("gets rendered as checked when given proposal contains a password", () => {
      installerRender(
        <ProposalSettingsForm proposal={{ encryptionPassword: "s3cr3t" }} />
      );

      const encryptionOptionsCheckbox = screen.getByRole("checkbox", { name: "Encrypt devices" });
      expect(encryptionOptionsCheckbox).toBeChecked();
    });

    it("changes its state when user clicks on it", async () => {
      const { user } = installerRender(
        <ProposalSettingsForm
          proposal={proposal}
          onValidate={onValidateFn}
        />
      );

      const encryptionOptionsCheckbox = screen.getByRole("checkbox", { name: "Encrypt devices" });

      expect(encryptionOptionsCheckbox).not.toBeChecked();
      await user.click(encryptionOptionsCheckbox);
      expect(encryptionOptionsCheckbox).toBeChecked();
    });
  });

  describe("Input for entering an encryption password", () => {
    it("changes its state when user types on it", async () => {
      const { user } = installerRender(
        <ProposalSettingsForm
          proposal={{ encryptionPassword: "s3cr3t" }}
          onValidate={onValidateFn}
        />
      );

      const encryptionPasswordInput = screen.getByLabelText("Password");

      expect(encryptionPasswordInput).toHaveValue("s3cr3t");
      await user.clear(encryptionPasswordInput);
      await user.type(encryptionPasswordInput, "notS3cr3t");
      expect(encryptionPasswordInput).toHaveValue("notS3cr3t");
    });
  });

  describe("#onSubmit", () => {
    it("executes given onSubmit function with form settings", async () => {
      // FIXME: our forms do not have submit button because they are submitted
      // from outside (usually from the popup buttons). That's why we have the id prop.
      // Ideally, we should add a prop for choosing when a child submit button
      // should be rendered and when not.
      const FormWrapper = () => {
        return (
          <>
            <ProposalSettingsForm
              id="the-form"
              proposal={proposal}
              onSubmit={onSubmitFn}
              onValidate={onValidateFn}
            />
            <button type="submit" form="the-form">Submit the form</button>
          </>
        );
      };

      const { user } = installerRender(<FormWrapper />);

      const lvmCheckbox = screen.getByRole("checkbox", { name: "Use LVM" });
      const encryptDevicesCheckbox = screen.getByRole("checkbox", { name: "Encrypt devices" });
      const encryptionPasswordInput = screen.getByLabelText("Password");

      await user.click(lvmCheckbox);
      await user.click(encryptDevicesCheckbox);
      await user.type(encryptionPasswordInput, "notS3cr3tAt4ll");

      const submitButton = screen.getByRole("button", { name: "Submit the form" });

      await user.click(submitButton);

      expect(onSubmitFn).toHaveBeenCalledWith({ lvm: true, encryptionPassword: "notS3cr3tAt4ll" });
    });

    describe("when user enters the encryption password but disables the option before sending the form", () => {
      it("executes onSubmit function with an emtpy password", async () => {
        const FormWrapper = () => {
          return (
            <>
              <ProposalSettingsForm
                id="the-form"
                proposal={proposal}
                onSubmit={onSubmitFn}
                onValidate={onValidateFn}
              />
              <button type="submit" form="the-form">Submit the form</button>
            </>
          );
        };

        const { user } = installerRender(<FormWrapper />);

        const encryptDevicesCheckbox = screen.getByRole("checkbox", { name: "Encrypt devices" });
        const encryptionPasswordInput = screen.getByLabelText("Password");

        await user.click(encryptDevicesCheckbox);
        await user.type(encryptionPasswordInput, "notS3cr3tAt4ll");
        await user.click(encryptDevicesCheckbox);

        const submitButton = screen.getByRole("button", { name: "Submit the form" });

        await user.click(submitButton);

        expect(onSubmitFn).toHaveBeenCalledWith(
          expect.objectContaining({ encryptionPassword: "" })
        );
      });
    });
  });
});
