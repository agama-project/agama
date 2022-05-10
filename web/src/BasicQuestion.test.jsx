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

import { screen, prettyDOM } from "@testing-library/react";
import { installerRender } from "./test-utils";

import BasicQuestion from "./BasicQuestion";

const question = {
  id: 1,
  text: "Do you want to continue?",
  options: ["yes", "no", "maybe"]
};

const answerFn = jest.fn();

const renderQuestion = () => (
  installerRender(<BasicQuestion question={question} answerCallback={answerFn} />)
);

describe("BasicQuestions", () => {
  it.only("renders the question text", async () => {
    const { container } = renderQuestion();
    console.log(prettyDOM(container));

    await screen.findByText(question.text);
  });

  it("contains a 'Cancel' action", async () => {
    renderQuestion();

    const skipButton = await screen.findByRole("button", { name: /Cancel/ });
    expect(skipButton).not.toBeNull();
  });

  it("contains a 'Confirm' action", async () => {
    renderQuestion();

    const decryptButton = await screen.findByRole("button", { name: /Confirm/ });
    expect(decryptButton).not.toBeNull();
  });

  it("sends 'yes' answer when user confirms", async() => {
    const { user } = renderQuestion();

    const confirmButton = await screen.findByRole("button", { name: /Confirm/ });
    await user.click(confirmButton);

    expect(question).toEqual(expect.objectContaining({ answer: "yes" }));
    expect(answerFn).toHaveBeenCalledWith(question);
  });

  it("sends 'no' answer when user cancels", async() => {
    const { user } = renderQuestion();

    const cancelButton = await screen.findByRole("button", { name: /Cancel/ });
    await user.click(cancelButton);

    expect(question).toEqual(expect.objectContaining({ answer: "no" }));
    expect(answerFn).toHaveBeenCalledWith(question);
  });
});
