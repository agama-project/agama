/*
 * Copyright (c) [2024] SUSE LLC
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
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
 * Query to retrieve questions
 */
const questionsQuery = () => ({
  queryKey: ["questions"],
  queryFn: () => fetch("/api/questions").then((res) => res.json()),
});

/**
 * Hook that builds a mutation given question, allowing to answer it

 * TODO: improve/simplify it once the backend API is improved.
 */
const useQuestionsConfig = () => {
  const query = {
    mutationFn: (question: Question) => {
      const answer: Answer = { generic: { answer: question.answer } };

      if (question.type === QuestionType.withPassword) {
        answer.withPassword = { password: question.password };
      }

      return fetch(`/api/questions/${question.id}/answer`, {
        method: "PUT",
        body: JSON.stringify(answer),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  };
  return useMutation(query);
};

/**
 * Hook for listening questions changes and performing proper invalidations
 */
const useQuestionsChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      if (event.type === "QuestionsChanged") {
        queryClient.invalidateQueries({ queryKey: ["questions"] });
      }
    });
  }, [client, queryClient]);
};

/**
 * Hook for retrieving available questions
 */
const useQuestions = () => {
  const { data, isPending } = useQuery(questionsQuery());
  return isPending ? [] : data.map(buildQuestion);
};

export { questionsQuery, useQuestions, useQuestionsConfig, useQuestionsChanges };
