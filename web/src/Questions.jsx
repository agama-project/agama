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

import React, { useState, useEffect, useCallback } from "react";
import { useInstallerClient } from "./context/installer";

import GenericQuestion from "./GenericQuestion";
import LuksActivationQuestion from "./LuksActivationQuestion";

const QUESTION_TYPES = {
  generic: GenericQuestion,
  luksActivation: LuksActivationQuestion
};

export default function Questions() {
  const client = useInstallerClient();

  const [pendingQuestions, setPendingQuestions] = useState([]);

  const addQuestion = useCallback(question => {
    setPendingQuestions(pending => [...pending, question]);
  }, []);

  const removeQuestion = useCallback(id =>
    setPendingQuestions(pending => pending.filter(q => q.id !== id))
  , []);

  const answerQuestion = useCallback(question => {
    client.questions.answer(question);
    removeQuestion(question.id);
  }, [client.questions, removeQuestion]);

  useEffect(() => {
    const unsubscribeCallbacks = [];

    client.questions.getQuestions()
      .then(setPendingQuestions)
      .catch(e => console.error("Something went wrong retrieving pending questions", e));
    unsubscribeCallbacks.push(client.questions.onQuestionAdded(addQuestion));
    unsubscribeCallbacks.push(client.questions.onQuestionRemoved(removeQuestion));

    return () => { unsubscribeCallbacks.forEach(cb => cb()) };
  }, [client.questions, addQuestion, removeQuestion]);

  if (pendingQuestions.length === 0) return null;

  // Renders the first pending question
  const [currentQuestion] = pendingQuestions;
  const QuestionComponent = QUESTION_TYPES[currentQuestion.type];
  return <QuestionComponent question={currentQuestion} answerCallback={answerQuestion} />;
}
