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

import { get, patch } from "~/api/http";
import { Question } from "~/types/questions";

/**
 * Returns the list of questions
 */
const fetchQuestions = async (): Promise<Question[]> => await get("/api/v2/questions");

/**
 * Update a questions' answer
 *
 * The answer is part of the Question object.
 */
const updateAnswer = async (question: Question): Promise<void> => {
  const { id, answer } = question;
  await patch(`/api/v2/questions`, { id, answer });
};

export { fetchQuestions, updateAnswer };
