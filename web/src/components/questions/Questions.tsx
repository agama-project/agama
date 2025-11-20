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

import React from "react";
import GenericQuestion from "~/components/questions/GenericQuestion";
import QuestionWithPassword from "~/components/questions/QuestionWithPassword";
import LuksActivationQuestion from "~/components/questions/LuksActivationQuestion";
import PackageErrorQuestion from "~/components/questions/PackageErrorQuestion";
import UnsupportedAutoYaST from "~/components/questions/UnsupportedAutoYaST";
import RegistrationCertificateQuestion from "~/components/questions/RegistrationCertificateQuestion";
import LoadConfigRetryQuestion from "~/components/questions/LoadConfigRetryQuestion";
import { useQuestions, useQuestionsChanges } from "~/hooks/api/question";
import { patchQuestion } from "~/api";
import { AnswerCallback, FieldType } from "~/api/question";

export default function Questions(): React.ReactNode {
  useQuestionsChanges();
  const allQuestions = useQuestions();

  const pendingQuestions = allQuestions.filter((q) => !q.answer);
  if (pendingQuestions.length === 0) return null;

  const answerQuestion: AnswerCallback = async (answeredQuestion) =>
    await patchQuestion(answeredQuestion);

  // Renders the first pending question
  const [currentQuestion] = pendingQuestions;

  let QuestionComponent = GenericQuestion;

  const questionClass = currentQuestion.class;

  // show specialized popup for question which need password
  if (currentQuestion.field.type === FieldType.Password) {
    QuestionComponent = QuestionWithPassword;
  }

  // show specialized popup for luks activation question
  // more can follow as it will be needed
  if (questionClass === "storage.luks_activation") {
    QuestionComponent = LuksActivationQuestion;
  }

  if (questionClass === "autoyast.unsupported") {
    QuestionComponent = UnsupportedAutoYaST;
  }

  // special popup for package errors (libzypp callbacks)
  if (questionClass.startsWith("software.package_error.")) {
    QuestionComponent = PackageErrorQuestion;
  }

  // special popup for self signed registration certificate
  if (questionClass === "registration.certificate") {
    QuestionComponent = RegistrationCertificateQuestion;
  }

  // special popup for self signed registration certificate
  if (questionClass === "load.retry") {
    QuestionComponent = LoadConfigRetryQuestion;
  }

  return <QuestionComponent question={currentQuestion} answerCallback={answerQuestion} />;
}
