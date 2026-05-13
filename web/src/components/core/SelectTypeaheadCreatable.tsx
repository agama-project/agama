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

import React from "react";
import {
  Select,
  SelectOption,
  SelectList,
  SelectOptionProps,
  MenuToggle,
  MenuToggleElement,
  MenuToggleStatus,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
} from "@patternfly/react-core";
import TimesIcon from "@patternfly/react-icons/dist/esm/icons/times-icon";
import { _, TranslatedString } from "~/i18n";

export type SelectTypeaheadCreatableProps = {
  id?: string;
  value: string;
  options: SelectOptionProps[];
  placeholder?: TranslatedString;
  // Text to show for creating a new option.
  createText?: TranslatedString;
  onChange?: (value: string) => void;
  status?: MenuToggleStatus;
  // Accessible name for the toggle
  toggleName: TranslatedString;
  // Accessible name for the options list
  listName: TranslatedString;
  // Accessible name for input text
  inputName: TranslatedString;
  // Accessible name for clear button
  clearButtonName: TranslatedString;
};

/**
 * Allows selecting or creating a value.
 *
 * Part of this code was taken from the patternfly example, see
 * https://www.patternfly.org/components/menus/select#typeahead-with-create-option.
 */
export default function SelectTypeaheadCreatable({
  id,
  value,
  options,
  placeholder,
  createText = _("Add"),
  onChange,
  status,
  toggleName,
  listName,
  inputName,
  clearButtonName,
}: SelectTypeaheadCreatableProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");
  const [selectOptions, setSelectOptions] = React.useState<SelectOptionProps[]>([]);
  const [focusedItemIndex, setFocusedItemIndex] = React.useState<number | null>(null);
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const textInputRef = React.useRef<HTMLInputElement>();

  const CREATE_NEW = "create";

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  React.useEffect(() => {
    let newSelectOptions: SelectOptionProps[] = options;

    // Filter menu items based on the text input value when one exists.
    if (filterValue) {
      newSelectOptions = options.filter((menuItem) =>
        String(menuItem.children).toLowerCase().includes(filterValue.toLowerCase()),
      );

      // If no option matches the filter exactly, display creation option.
      if (!options.some((option) => option.value === filterValue)) {
        newSelectOptions = [
          ...newSelectOptions,
          { children: `${createText} "${filterValue}"`, value: CREATE_NEW },
        ];
      }

      // Open the menu when the input value changes and the new value is not empty.
      if (!isOpen) {
        setIsOpen(true);
      }
    }

    setSelectOptions(newSelectOptions);
  }, [filterValue, isOpen, options, createText]);

  const createItemId = (value) => `select-typeahead-${value.replace(" ", "-")}`;

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions[itemIndex];
    setActiveItemId(createItemId(focusedItem.value));
  };

  const reset = () => {
    setInputValue(value);
    setFilterValue("");
  };

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const selectOption = (value: string | number, content?: string | number) => {
    setInputValue(String(content));
    setFilterValue("");
    onChange && onChange(String(value));
    closeMenu();
  };

  const onSelect = (event: React.UIEvent | undefined, value: string | number | undefined) => {
    event.preventDefault();
    if (value) {
      if (value === CREATE_NEW) {
        selectOption(filterValue, filterValue);
      } else {
        const optionText = selectOptions.find((option) => option.value === value)?.children;
        selectOption(value, optionText as string);
      }
    }
  };

  const onTextInputChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setInputValue(value);
    setFilterValue(value);
    resetActiveAndFocusedItem();
  };

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (selectOptions.every((option) => option.isDisabled)) {
      return;
    }

    if (key === "ArrowUp") {
      // When no index is set or at the first index, focus to the last, otherwise decrement focus
      // index.
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = selectOptions.length - 1;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }

      // Skip disabled options
      while (selectOptions[indexToFocus].isDisabled) {
        indexToFocus--;
        if (indexToFocus === -1) {
          indexToFocus = selectOptions.length - 1;
        }
      }
    }

    if (key === "ArrowDown") {
      // When no index is set or at the last index, focus to the first, otherwise increment focus
      // index.
      if (focusedItemIndex === null || focusedItemIndex === selectOptions.length - 1) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }

      // Skip disabled options.
      while (selectOptions[indexToFocus].isDisabled) {
        indexToFocus++;
        if (indexToFocus === selectOptions.length) {
          indexToFocus = 0;
        }
      }
    }

    setActiveAndFocusedItem(indexToFocus);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions[focusedItemIndex] : null;

    switch (event.key) {
      case "Enter":
        if (isOpen && focusedItem && !focusedItem.isAriaDisabled) {
          onSelect(event, focusedItem.value as string);
        }

        if (!isOpen) {
          setIsOpen(true);
        }

        break;
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        handleMenuArrowKeys(event.key);
        break;
    }
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onClearButtonClick = () => {
    selectOption("", "");
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      aria-label={toggleName}
      variant="typeahead"
      onClick={onToggleClick}
      isExpanded={isOpen}
      status={status}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          inputId={id}
          value={inputValue}
          aria-label={inputName}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={placeholder}
          {...(activeItemId && { "aria-activedescendant": activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-create-typeahead-listbox"
        />

        <TextInputGroupUtilities {...(!inputValue ? { style: { display: "none" } } : {})}>
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label={clearButtonName}
            icon={<TimesIcon aria-hidden />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      id="create-typeahead-select"
      isOpen={isOpen}
      selected={value}
      onSelect={onSelect}
      onOpenChange={(isOpen) => {
        reset();
        !isOpen && closeMenu();
      }}
      toggle={toggle}
      variant="typeahead"
    >
      <SelectList id="select-create-typeahead-listbox" aria-label={listName}>
        {selectOptions.map((option, index) => (
          <SelectOption
            key={option.value || option.children}
            isFocused={focusedItemIndex === index}
            className={option.className}
            id={createItemId(option.value)}
            {...option}
            ref={null}
          />
        ))}
      </SelectList>
    </Select>
  );
}
