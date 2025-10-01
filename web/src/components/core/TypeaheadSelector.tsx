/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { useRef, useState } from "react";
import {
  Flex,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
} from "@patternfly/react-core";
import { debounce } from "radashi";
import Text from "./Text";

function search<T>(elements: T[], term: string): T[] {
  const value = term.toLowerCase();

  const match = (element: T) => {
    return Object.values(element).join("").toLowerCase().includes(value);
  };

  return elements.filter(match);
}

function filter<T>(elements: T[], term: string, action: Function) {
  action(search(elements, term));
}

const searchHandler = debounce({ delay: 250 }, filter);

type Props<T> = {
  label: string;
  placeholder: string;
  options: T[];
  selected: T;
  optionRender: ({ option }: { option: T }) => React.ReactNode;
  onChange: (v: T) => void;
  inputValue: string;
};

/**
 * Build a typeahead selector
 */
export default function TypeaheadSelector<T>({
  label,
  placeholder,
  options,
  selected,
  optionRender: Option,
  onChange,
  inputValue,
}: Props<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const textInputRef = useRef();

  const updateSearchInput = (_, v) => {
    setSearchInput(v);
    searchHandler(options, searchInput, setFilteredOptions);
  };

  const resetInput = () => {
    setFilteredOptions(options);
    setSearchInput("");
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    isOpen && resetInput();
  };

  const activeItemId = "whatever";

  const onTextInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else {
      resetInput();
    }
  };

  const Toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Select or change language"
      onClick={onToggleClick}
      isExpanded={isOpen}
      style={{ width: "370px" }}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={isOpen ? searchInput : inputValue}
          onClick={onTextInputClick}
          onChange={updateSearchInput}
          id="typeahead-select-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={placeholder}
          {...(activeItemId && { "aria-activedescendant": activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-typeahead-listbox"
        />
      </TextInputGroup>
    </MenuToggle>
  );

  const onSelect = (_, v) => {
    onChange(v);
    resetInput();
    setIsOpen(false);
  };

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      <Text isBold>{label}</Text>
      <Select
        id="typeahead-select"
        isOpen={isOpen}
        selected={selected}
        onSelect={onSelect}
        onOpenChange={(isOpen) => {
          !isOpen && setIsOpen(false);
        }}
        toggle={Toggle}
        variant="typeahead"
        maxMenuHeight="330px"
      >
        <SelectList id="select-typeahead-listbox">
          {filteredOptions.map((option, index) => (
            <SelectOption key={index} isFocused={false} id={option.id} value={option} ref={null}>
              <Option option={option} />
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </Flex>
  );
}
