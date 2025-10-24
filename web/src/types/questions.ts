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

type Question = {
  id: number;
  text: string;
  class: string;
  field: SelectionField | Field;
  actions: Action[];
  defaultAction?: string;
  data?: { [key: string]: string };
  answer?: Answer;
};

type Field = {
  type: FieldType;
};

type SelectionField = {
  type: FieldType.Select;
  options: object;
};

type Action = {
  id: string;
  label: string;
};

type Answer = {
  action: string;
  value?: string;
};

enum FieldType {
  None = "none",
  Password = "password",
  String = "string",
  Select = "select",
}

type AnswerCallback = (answeredQuestion: Question) => void;

export { FieldType };
export type { Question, Action, AnswerCallback };
