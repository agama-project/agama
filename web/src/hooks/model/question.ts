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

import { useEffect } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { getQuestions } from "~/api";
import type { Question } from "~/model/question";

const questionsQuery = {
  queryKey: ["questions"],
  queryFn: getQuestions,
};

const useQuestions = (): Question[] => {
  return useSuspenseQuery(questionsQuery)?.data || [];
};

const useQuestionsChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "QuestionAdded" || event.type === "QuestionAnswered") {
        queryClient.invalidateQueries({ queryKey: ["questions"] });
      }
    });
  }, [client, queryClient]);

  useEffect(() => {
    if (!client) return;

    return client.onConnect(() => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    });
  }, [client, queryClient]);
};

export { useQuestions, useQuestionsChanges };
