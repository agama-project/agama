/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useMemo, useState } from "react";
import {
  FormGroup,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
} from "@patternfly/react-core";
import { TimesIcon } from "@patternfly/react-icons";
import { useFieldContext } from "~/hooks/form";
import { _ } from "~/i18n";

type Option = {
  value: string;
  label: string;
  description?: string;
};

type SearchableSelectFieldProps = {
  label: string;
  options: Option[];
  placeholder?: string;
  maxHeight?: string;
};

/**
 * Searchable select field with inline filtering.
 *
 * Provides a select component with built-in search functionality, allowing
 * users to filter options by typing. Follows ARIA patterns for accessible
 * combobox interaction.
 *
 * @example
 * ```tsx
 * <form.AppField name="language">
 *   {(field) => (
 *     <field.SearchableSelectField
 *       label="Language"
 *       options={[
 *         { value: "en_US", label: "English", description: "United States" },
 *         { value: "es_ES", label: "Spanish", description: "Spain" }
 *       ]}
 *     />
 *   )}
 * </form.AppField>
 * ```
 */
export default function SearchableSelectField({
  label,
  options,
  placeholder,
  maxHeight = "300px",
}: SearchableSelectFieldProps) {
  const field = useFieldContext<string>();
  const [isOpen, setIsOpen] = useState(false);
  const [filterValue, setFilterValue] = useState("");

  const filteredOptions = useMemo(() => {
    if (!filterValue) return options;

    const lowerFilter = filterValue.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(lowerFilter) ||
        option.description?.toLowerCase().includes(lowerFilter),
    );
  }, [options, filterValue]);

  const selectedOption = options.find((opt) => opt.value === field.state.value);

  const onToggle = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (_event: React.MouseEvent | undefined, value: string | number | undefined) => {
    if (typeof value === "string") {
      field.handleChange(value);
      setIsOpen(false);
      setFilterValue("");
    }
  };

  const toggle = (toggleRef: React.Ref<HTMLButtonElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={onToggle}
      isExpanded={isOpen}
      style={{ width: "100%" }}
      aria-label={typeof label === "string" ? label : undefined}
    >
      {selectedOption ? (
        <>
          {selectedOption.label}
          {selectedOption.description && ` - ${selectedOption.description}`}
        </>
      ) : (
        placeholder || _("Select an option")
      )}
    </MenuToggle>
  );

  return (
    <FormGroup label={label} fieldId={field.name}>
      <Select
        id={field.name}
        isOpen={isOpen}
        selected={field.state.value}
        onSelect={onSelect}
        onOpenChange={(isOpen) => setIsOpen(isOpen)}
        toggle={toggle}
      >
        <TextInputGroup>
          <TextInputGroupMain
            value={filterValue}
            onChange={(_event, value) => setFilterValue(value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && filterValue) {
                setFilterValue("");
                e.stopPropagation();
              }
            }}
            // TRANSLATORS: placeholder text for search input in searchable select
            placeholder={_("Type to filter")}
            role="combobox"
            isExpanded={isOpen}
            aria-controls="select-listbox"
          />
          {filterValue && (
            <TextInputGroupUtilities>
              <Button
                variant="plain"
                onClick={() => setFilterValue("")}
                // TRANSLATORS: button to clear search filter
                aria-label={_("Clear filter")}
              >
                <TimesIcon />
              </Button>
            </TextInputGroupUtilities>
          )}
        </TextInputGroup>
        <SelectList id="select-listbox" style={{ maxHeight, overflowY: "auto" }}>
          {filteredOptions.length === 0 ? (
            <SelectOption isDisabled>
              {
                // TRANSLATORS: message shown when search filter returns no results
                _("No options found")
              }
            </SelectOption>
          ) : (
            filteredOptions.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                description={option.description}
              >
                {option.label}
              </SelectOption>
            ))
          )}
        </SelectList>
      </Select>
    </FormGroup>
  );
}
