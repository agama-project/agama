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

import React from "react";
import {
  Button,
  Flex,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  TextInputProps,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import { _ } from "~/i18n";

type TextinputFilterProps = Required<Pick<TextInputProps, "id" | "label" | "value" | "onChange">>;

/**
 * TextinputFilter Component
 *
 * A PF/TextInputGroup wrapper used for filtering lists or tables using free
 * text input. Includes a clear ("reset") button when a value is present.
 *
 * @remarks
 * This component overrides the default "Type to filter" `aria-label` set by
 * PatternFly's `TextInputGroupMain` to improve accessibility for named filters.
 *
 * @privateRemarks
 * This is a temporary solution to enable basic text filtering in list views.
 * Ideally, filtering should be triggered manually (e.g. via submit or
 * debounce), rather than reacting immediately to every keystroke, as this
 * component currently does. Consider refactoring when a more robust filtering
 * strategy is adopted.
 */
export default function TextinputFilter({ id, label, value, onChange }: TextinputFilterProps) {
  const handleClear = () => {
    // @ts-expect-error: passing an empty object as a fake event to satisfy
    // onChange signature. For a fully correct native input event, see
    // https://stackoverflow.com/a/46012210
    onChange({}, "");
  };

  return (
    <Flex direction={{ default: "column" }} columnGap={{ default: "columnGapXs" }}>
      <label htmlFor={id}>
        <Text isBold aria-hidden>
          {label}
        </Text>
      </label>

      <TextInputGroup>
        <TextInputGroupMain
          inputId={id}
          type="text"
          value={value}
          onChange={onChange}
          aria-label={label}
        />
        {value !== "" && (
          <TextInputGroupUtilities>
            <Button
              variant="plain"
              aria-label={_("Clear input")}
              onClick={handleClear}
              icon={<Icon name="backspace" />}
            />
          </TextInputGroupUtilities>
        )}
      </TextInputGroup>
    </Flex>
  );
}
