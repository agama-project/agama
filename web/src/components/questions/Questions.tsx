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
import {
  GenericQuestion,
  QuestionWithPassword,
  LuksActivationQuestion,
} from "~/components/questions";
import { useQuestions, useQuestionsConfig, useQuestionsChanges } from "~/queries/questions";
import { AnswerCallback, QuestionType } from "~/types/questions";

export default function Questions(): React.ReactNode {
  useQuestionsChanges();
  const pendingQuestions = useQuestions();
  const questionsConfig = useQuestionsConfig();

  if (pendingQuestions.length === 0) return null;

  const answerQuestion: AnswerCallback = (answeredQuestion) =>
    questionsConfig.mutate(answeredQuestion);

  // Renders the first pending question
  const [currentQuestion] = pendingQuestions;

  let QuestionComponent = GenericQuestion;

  // show specialized popup for question which need password
  if (currentQuestion.type === QuestionType.withPassword) {
    QuestionComponent = QuestionWithPassword;
  }

  // show specialized popup for luks activation question
  // more can follow as it will be needed
  if (currentQuestion.class === "storage.luks_activation") {
    QuestionComponent = LuksActivationQuestion;
  }

  return <QuestionComponent question={currentQuestion} answerCallback={answerQuestion} />;
}
