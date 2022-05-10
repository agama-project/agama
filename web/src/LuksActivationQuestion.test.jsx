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
  attempt: 1,
  options: ["open", "skip"],
  defaultOption: "open"
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

  it("contains the default option as primary action", async () => {
    renderQuestion();

    const button = await screen.findByRole("button", { name: "Open" });
    expect(button.classList.contains("pf-m-primary")).toBe(true);
  });

  it("contains the non default option as secondary action", async () => {
    renderQuestion();

    const button = await screen.findByRole("button", { name: "Skip" });
    expect(button.classList.contains("pf-m-secondary")).toBe(true);
  });

  describe("when it is the first attempt", () => {
    it("does not contain a warning", async () => {
      renderQuestion();

      const warning = screen.queryByText(/Given encryption password/);
      expect(warning).toBeNull();
    });
  });

  describe("when it is not the first attempt", () => {
    beforeEach(() => { question.attempt = 2 });

    it("contains a warning", async () => {
      renderQuestion();

      await screen.findByText(/Given encryption password/);
    });
  });

  describe("when the user clicks on the secondary action", () => {
    it("calls the callback after setting the answer but not the password", async() => {
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

  describe("when clicks on the primary action", () => {
    it("calls the callback after setting both, answer and password", async() => {
      const { user } = renderQuestion();

      const passwordInput = await screen.findByLabelText("Encryption Password");

      await user.type(passwordInput, "notSecret");
      const button = await screen.findByRole("button", { name: /Open/ });
      await user.click(button);

      expect(question).toEqual(expect.objectContaining({ password: "notSecret" }));
      expect(question).toEqual(expect.objectContaining({ answer: "open" }));
      expect(answerFn).toHaveBeenCalledWith(question);
    });
  });
});
