/*
 * Copyright (c) [2025] SUSE LLC
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

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { Question, FieldType } from "~/model/question";
import PackageErrorQuestion from "~/components/questions/PackageErrorQuestion";

const answerFn = jest.fn();
const question: Question = {
  id: 1,
  class: "software.package_error.provide_error",
  text: "Package download failed",
  field: { type: FieldType.None },
  actions: [
    { id: "retry", label: "Retry" },
    { id: "skip", label: "Skip" },
  ],
  defaultAction: "Retry",
  data: { package: "foo", error_code: "INVALID" },
};

const renderQuestion = () =>
  plainRender(<PackageErrorQuestion question={question} answerCallback={answerFn} />);

describe("PackageErrorQuestion", () => {
  it("renders the question text", () => {
    renderQuestion();

    screen.queryByText(question.text);
  });

  describe("when the user clicks Retry", () => {
    it("calls the callback with Retry value", async () => {
      const { user } = renderQuestion();

      const retryButton = await screen.findByRole("button", { name: "Retry" });
      await user.click(retryButton);

      expect(question.answer).toEqual(expect.objectContaining({ action: "retry" }));
      expect(answerFn).toHaveBeenCalledWith(question);
    });
  });
});
