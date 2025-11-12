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
import { Question, FieldType } from "~/api/question";
import RegistrationCertificateQuestion from "~/components/questions/RegistrationCertificateQuestion";

const question: Question = {
  id: 1,
  class: "registration.certificate",
  text: "Trust certificate?",
  field: { type: FieldType.None },
  actions: [
    { id: "yes", label: "Yes" },
    { id: "no", label: "No" },
  ],
  defaultAction: "yes",
  data: {
    url: "https://test.com",
    issuer_name: "test",
    issue_date: "01-01-2025",
    expiration_date: "01-01-2030",
    sha1_fingerprint: "AA:BB:CC",
    sha256_fingerprint: "11:22:33:44:55",
  },
};

const answerFn = jest.fn();

const renderQuestion = () =>
  plainRender(<RegistrationCertificateQuestion question={question} answerCallback={answerFn} />);

it("renders the question text", async () => {
  renderQuestion();

  await screen.findByText(question.text);
});

it("renders the certificate data", async () => {
  renderQuestion();

  const data = question.data;
  await screen.findByText(data.url);
  await screen.findByText(data.issuer_name);
  await screen.findByText(data.issue_date);
  await screen.findByText(data.expiration_date);
  await screen.findByText(data.sha1_fingerprint);
  await screen.findByText(data.sha256_fingerprint);
});
