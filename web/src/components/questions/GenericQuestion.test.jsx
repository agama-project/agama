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
import { installerRender } from "~/test-utils";
import { GenericQuestion } from "~/components/questions";

const question = {
  id: 1,
  text: "Do you write unit tests?",
  options: ["always", "sometimes", "never"],
  defaultOption: "sometimes",
};

const answerFn = jest.fn();

const renderQuestion = () =>
  installerRender(<GenericQuestion question={question} answerCallback={answerFn} />);

describe("GenericQuestion", () => {
  it("renders the question text", async () => {
    renderQuestion();

    await screen.findByText(question.text);
  });

  it("sets chosen option and calls the callback after user clicking an action", async () => {
    const { user } = renderQuestion();

    let button = await screen.findByRole("button", { name: /Sometimes/ });
    await user.click(button);
    expect(question).toEqual(expect.objectContaining({ answer: "sometimes" }));
    expect(answerFn).toHaveBeenCalledWith(question);

    button = await screen.findByRole("button", { name: /Always/ });
    await user.click(button);
    expect(question).toEqual(expect.objectContaining({ answer: "always" }));
    expect(answerFn).toHaveBeenCalledWith(question);

    button = await screen.findByRole("button", { name: /Never/ });
    await user.click(button);
    expect(question).toEqual(expect.objectContaining({ answer: "never" }));
    expect(answerFn).toHaveBeenCalledWith(question);
  });
});
