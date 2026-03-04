/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useState } from "react";
import { SearchInput } from "@patternfly/react-core";
import { debounce, noop } from "radashi";
import { _, TranslatedString } from "~/i18n";

type ListSearchProps<T> = {
  /** Text to display as placeholder for the search input. */
  placeholder?: TranslatedString;
  /** List of elements in which to search. */
  elements: T[];
  /** Callback to be called with the filtered list of elements. */
  onChange: (elements: T[]) => void;
};

function search<T>(elements: T[], term: string): T[] {
  const value = term.toLowerCase();

  const match = (element: T) => {
    return Object.values(element).join("").toLowerCase().includes(value);
  };

  return elements.filter(match);
}

function filterList<T>(elements: ListSearchProps<T>["elements"], term: string, action: Function) {
  action(search(elements, term));
}

const searchHandler = debounce({ delay: 500 }, filterList);

/**
 * Input field for searching in a given list of elements.
 * @component
 */
export default function ListSearch<T>({
  placeholder = _("Search"),
  elements = [],
  onChange: onChangeProp = noop,
}: ListSearchProps<T>) {
  const [value, setValue] = useState("");
  const [resultSize, setResultSize] = useState(elements.length);

  const updateResult = (result: T[]) => {
    setResultSize(result.length);
    onChangeProp(result);
  };

  const onChange = (value: string) => {
    setValue(value);
    searchHandler(elements, value, updateResult);
  };

  const onClear = () => {
    setValue("");
    updateResult(elements);
  };

  return (
    <SearchInput
      placeholder={placeholder}
      value={value}
      onChange={(_, value) => onChange(value)}
      onClear={onClear}
      resultsCount={resultSize}
    />
  );
}
