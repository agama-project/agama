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

import { screen } from "@testing-library/react";
import { installerRender } from "./test-utils";

import LuksActivationQuestion from "./LuksActivationQuestion";

const question = {
  id: 1,
  text: "A Luks device found. Do you want to open it?",
  attempt: 1
};

const answerFn = jest.fn();

const renderQuestion = () => (
  installerRender(<LuksActivationQuestion question={question} answerCallback={answerFn} />)
);

describe("LuksActivationQuestions", () => {
  it("renders the question text", async () => {
    renderQuestion();

    await screen.findByText(question.text);
  });

  it("contains a textinput for entering the password", async () => {
    renderQuestion();

    const passwordInput = await screen.findByLabelText("Encryption Password");
    expect(passwordInput).not.toBeNull();
  });

  it("contains a 'Skip' action", async () => {
    renderQuestion();

    const skipButton = await screen.findByRole("button", { name: /Skip/ });
    expect(skipButton).not.toBeNull();
  });

  it("contains a 'Decrypt' action", async () => {
    renderQuestion();

    const decryptButton = await screen.findByRole("button", { name: /Decrypt/ });
    expect(decryptButton).not.toBeNull();
  });

  describe("when it is the first attempt", () => {
    it("does not contain a warning", async () => {
      renderQuestion();

      const warning = screen.queryByText(/Given encryption password/);
      expect(warning).toBeNull();
    });
  });

  describe("when it is not the first attempt", () => {
    beforeEach(() => question.attempt = 2);

    it("contains a warning", async () => {
      renderQuestion();

      await screen.findByText(/Given encryption password/);
    });
  });

  describe("when the user decides to skip the encrypted device", () => {
    it("sends the 'skip' answer without setting the password", async() => {
      const { user } = renderQuestion();

      const passwordInput = await screen.findByLabelText("Encryption Password");

      // Simulate that user enters a password before deciding to skip opening the device
      await user.type(passwordInput, "notSecret");

      const skipButton = await screen.findByRole("button", { name: /Skip/ });
      await user.click(skipButton);

      expect(question).toEqual(expect.not.objectContaining({ password: "notSecret" }));
      expect(question).toEqual(expect.objectContaining({ answer: "skip" }));
      expect(answerFn).toHaveBeenCalledWith(question);
    });
  });

  describe("when the user goes for opening the device", () => {
    it("sends the 'decrypt' along with the password", async() => {
      const { user } = renderQuestion();

      const passwordInput = await screen.findByLabelText("Encryption Password");

      await user.type(passwordInput, "notSecret");
      const decryptButton = await screen.findByRole("button", { name: /Decrypt/ });
      await user.click(decryptButton);

      expect(question).toEqual(expect.objectContaining({ password: "notSecret" }));
      expect(question).toEqual(expect.objectContaining({ answer: "decrypt" }));
      expect(answerFn).toHaveBeenCalledWith(question);
    });
  });
});
