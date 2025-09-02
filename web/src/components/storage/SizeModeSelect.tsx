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

import React, { useState } from "react";
import {
  Button,
  Checkbox,
  Flex,
  FlexItem,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Stack,
  StackItem,
  SelectList,
  SelectOption,
  TextInput,
} from "@patternfly/react-core";
import { NestedContent, SubtleContent, SelectWrapper as Select } from "~/components/core/";
import { deviceSize, parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

const NO_VALUE = "";

export type SizeMode = "auto" | "custom";

export type SizeRange = {
  min: string;
  max: string;
};

function approxSize(size: string): string | null {
  const minify = (size: string): string => size.replaceAll(" ", "");
  const approx = deviceSize(parseToBytes(size));

  if (minify(approx) === minify(size)) return null;
  if (parseToBytes(approx) === parseToBytes(size)) return null;

  return approx;
}

type UnsupportedSizeProps = {
  value: SizeRange;
  onClick: () => void;
};

function UnsupportedSize({ value, onClick }: UnsupportedSizeProps): React.ReactNode {
  return (
    <SubtleContent>
      <Stack hasGutter>
        <StackItem>
          {sprintf(
            _(
              "The size is configured as a range between %s and %s, but this interface cannot handle ranges with a given max size.",
            ),
            value.min,
            value.max,
          )}
        </StackItem>
        <StackItem>
          <Button variant="link" isInline onClick={onClick}>
            {_("Discard the maximum size and continue with simplified configuration")}
          </Button>
        </StackItem>
      </Stack>
    </SubtleContent>
  );
}

type CustomSizeProps = {
  value: SizeRange;
  onChange: (size: SizeRange) => void;
};

function CustomSize({ value, onChange }: CustomSizeProps) {
  const [grow, setGrow] = useState(value.min !== value.max);

  const changeSize = (min: string) => {
    const max = grow ? NO_VALUE : min;
    onChange({ min, max });
  };

  const toggleGrow = () => {
    const newGrow = !grow;
    const max = newGrow ? NO_VALUE : value.min;
    setGrow(newGrow);
    onChange({ min: value.min, max });
  };

  const regexp = /^[0-9]+(\.[0-9]+)?(\s*([KkMmGgTtPpEeZzYy][iI]?)?[Bb])$/;
  const error = value.min && !regexp.test(value.min);
  const approxMin = error ? null : approxSize(value.min);
  const help = _(
    "The size must be a number followed by a unit of the form GiB (power of 2) or GB (power of 10).",
  );

  if (value.max !== NO_VALUE && value.min !== value.max) {
    return <UnsupportedSize value={value} onClick={() => changeSize(value.min)} />;
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <FormGroup fieldId="minSizeValue" label={_("Size")}>
          <Flex>
            <FlexItem>
              <TextInput
                id="minSizeValue"
                className="w-14ch"
                value={value.min}
                onChange={(_, v) => changeSize(v)}
              />
            </FlexItem>
            {!error && approxMin && (
              <FlexItem>
                <SubtleContent>
                  {
                    // TRANSLATORS: %s is a disk size (e.g., "10 GiB").
                    sprintf(_("approx. %s"), approxMin)
                  }
                </SubtleContent>
              </FlexItem>
            )}
          </Flex>
          {!error && <SubtleContent>{help}</SubtleContent>}
          {error && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" screenReaderText="">
                  {help}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      </StackItem>
      <StackItem>
        <Checkbox id="setGrow" label={_("Allow growing")} isChecked={grow} onChange={toggleGrow} />
        <SubtleContent>
          {_("The final size can be bigger in order to fill the extra free space.")}
        </SubtleContent>
      </StackItem>
    </Stack>
  );
}

export type SizeModeSelectProps = {
  id?: string;
  value: SizeMode;
  size: SizeRange;
  automaticHelp?: React.ReactNode;
  onChange: (value: SizeMode, size: SizeRange) => void;
};

export default function SizeModeSelect({
  id,
  value,
  size,
  onChange,
  automaticHelp,
}: SizeModeSelectProps): React.ReactNode {
  const changeSize = (size: SizeRange) => onChange(value, size);

  return (
    <Stack hasGutter>
      <StackItem>
        <Select
          id={id || "sizeMode"}
          value={value}
          label={value === "auto" ? _("Automatic") : _("Manual")}
          onChange={(v: SizeMode) => onChange(v, size)}
        >
          <SelectList aria-label={_("Size modes")}>
            <SelectOption value="auto" description={_("Let the installer propose a sensible size")}>
              {_("Automatic")}
            </SelectOption>
            <SelectOption value="custom" description={_("Define a custom size")}>
              {_("Manual")}
            </SelectOption>
          </SelectList>
        </Select>
      </StackItem>
      <StackItem>
        <NestedContent margin="mxMd" aria-live="polite">
          {value === "auto" && automaticHelp}
          {value === "custom" && <CustomSize value={size} onChange={changeSize} />}
        </NestedContent>
      </StackItem>
    </Stack>
  );
}
