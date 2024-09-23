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
import { _ } from "~/i18n";
import { noop, useDebounce } from "~/utils";

const search = (elements, term) => {
  const value = term.toLowerCase();

  const match = (element) => {
    return Object.values(element).join("").toLowerCase().includes(value);
  };

  return elements.filter(match);
};

/**
 * TODO: Rename and/or refactor?
 * Input field for searching in a given list of elements.
 * @component
 *
 * @param {object} props
 * @param {string} [props.placeholder]
 * @param {object[]} [props.elements] - List of elements in which to search.
 * @param {(elements: object[]) => void} [props.onChange] - Callback to be called with the filtered list of elements.
 */
export default function ListSearch({
  placeholder = _("Search"),
  elements = [],
  onChange: onChangeProp = noop,
}) {
  const [value, setValue] = useState("");
  const [resultSize, setResultSize] = useState(elements.length);

  const updateResult = (result) => {
    setResultSize(result.length);
    onChangeProp(result);
  };

  const searchHandler = useDebounce((term) => {
    updateResult(search(elements, term));
  }, 500);

  const onChange = (value) => {
    setValue(value);
    searchHandler(value);
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
