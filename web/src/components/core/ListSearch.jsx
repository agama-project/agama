/*
 * Copyright (c) [2023] SUSE LLC
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

import { _ } from "~/i18n";
import { noop, useDebounce } from "~/utils";

const search = (elements, term) => {
  const match = (element) => {
    return Object.values(element)
      .join('')
      .toLowerCase()
      .includes(term);
  };

  return elements.filter(match);
};

/**
 * Input field for searching in a given list of elements.
 * @component
 *
 * @param {object} props
 * @param {string} [props.placeholder]
 * @param {object[]} [props.elements] - List of elements in which to search.
 * @param {(elements: object[]) => void} - Callback to be called with the filtered list of elements.
 */
export default function ListSearch({
  placeholder = _("Search"),
  elements = [],
  onChange: onChangeProp = noop
}) {
  const searchHandler = useDebounce(term => onChangeProp(search(elements, term)), 500);

  const onChange = (e) => searchHandler(e.target.value);

  return (
    <input role="search" type="text" placeholder={placeholder} onChange={onChange} />
  );
}
