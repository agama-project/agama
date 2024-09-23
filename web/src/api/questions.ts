/*
 * Copyright (c) [2024] SUSE LLC
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

import { get, put } from "~/api/http";
import { Answer, Question, QuestionType } from "~/types/questions";

type APIQuestion = {
  generic?: Question;
  withPassword?: Pick<Question, "password">;
};

/**
 * Internal method to build proper question objects
 *
 * TODO: improve/simplify it once the backend API is improved.
 */
function buildQuestion(httpQuestion: APIQuestion) {
  const question: Question = { ...httpQuestion.generic };

  if (httpQuestion.generic) {
    question.type = QuestionType.generic;
    question.answer = httpQuestion.generic.answer;
  }

  if (httpQuestion.withPassword) {
    question.type = QuestionType.withPassword;
    question.password = httpQuestion.withPassword.password;
  }

  return question;
}

/**
 * Returns the list of questions
 */
const fetchQuestions = async (): Promise<Question[]> => {
  const apiQuestions: APIQuestion[] = await get("/api/questions");
  return apiQuestions.map(buildQuestion);
};

/**
 * Update a questions' answer
 *
 * The answer is part of the Question object.
 */
const updateAnswer = async (question: Question): Promise<void> => {
  const answer: Answer = { generic: { answer: question.answer } };

  if (question.type === QuestionType.withPassword) {
    answer.withPassword = { password: question.password };
  }

  await put(`/api/questions/${question.id}/answer`, answer);
};

export { fetchQuestions, updateAnswer };
