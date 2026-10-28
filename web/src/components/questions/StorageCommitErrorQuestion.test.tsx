/*
 * Copyright (c) [2026] SUSE LLC
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
import StorageCommitErrorQuestion from "~/components/questions/StorageCommitErrorQuestion";

const questionWithDetails: Question = {
  id: 1,
  class: "storageCommitError",
  text: "Storage configuration could not be applied. Do you want to retry?",
  field: { type: FieldType.None },
  data: {
    details: `Failed to commit storage changes

  Caused by:
  0: Device /dev/sda not found
  1: Invalid partition table`,
  },
  actions: [
    { id: "retry", label: "Retry" },
    { id: "cancel", label: "Cancel" },
  ],
  defaultAction: "cancel",
};

const questionWithoutDetails: Question = {
  id: 2,
  class: "storageCommitError",
  text: "Storage configuration could not be applied. Do you want to retry?",
  field: { type: FieldType.None },
  actions: [
    { id: "retry", label: "Retry" },
    { id: "cancel", label: "Cancel" },
  ],
  defaultAction: "cancel",
};

const answerFn = jest.fn();

describe("StorageCommitErrorQuestion", () => {
  it("renders the question text", () => {
    plainRender(
      <StorageCommitErrorQuestion question={questionWithDetails} answerCallback={answerFn} />,
    );

    screen.getByText(questionWithDetails.text);
  });

  it("renders details from question", () => {
    plainRender(
      <StorageCommitErrorQuestion question={questionWithDetails} answerCallback={answerFn} />,
    );

    screen.getByText(/Failed to commit storage changes/);
    screen.getByText(/Device \/dev\/sda not found/);
  });

  it("does not show expandable section when no details are present", () => {
    plainRender(
      <StorageCommitErrorQuestion question={questionWithoutDetails} answerCallback={answerFn} />,
    );

    expect(screen.queryByText("Show technical details")).not.toBeInTheDocument();
  });

  it("calls the callback with the selected action", async () => {
    const { user } = plainRender(
      <StorageCommitErrorQuestion question={questionWithDetails} answerCallback={answerFn} />,
    );

    const retryButton = await screen.findByRole("button", { name: "Retry" });
    await user.click(retryButton);

    expect(questionWithDetails.answer).toEqual(expect.objectContaining({ action: "retry" }));
    expect(answerFn).toHaveBeenCalledWith(questionWithDetails);

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    expect(questionWithDetails.answer).toEqual(expect.objectContaining({ action: "cancel" }));
    expect(answerFn).toHaveBeenCalledWith(questionWithDetails);
  });
});
