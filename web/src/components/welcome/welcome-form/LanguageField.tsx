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

import React, { useEffect } from "react";
import { FormGroup, Radio } from "@patternfly/react-core";
import { useFieldContext } from "~/hooks/form-contexts";
import supportedLanguages from "~/languages.json";
import { _ } from "~/i18n";

/** The installer languages, sorted by their own names. */
const languages = Object.entries(supportedLanguages)
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

type LanguageFieldProps = {
  /** Whether to move the focus to the selected language once rendered. */
  focusSelected?: boolean;
};

/**
 * The installer languages as radios, each name written in its own language, so
 * whoever cannot read the language in use still finds theirs. Laid out in as
 * many columns as fit, so the list stays short.
 *
 * Holds the language tag of the field it is rendered for, so it must be used
 * inside a `form.AppField` render prop.
 */
export default function LanguageField({ focusSelected = false }: LanguageFieldProps) {
  const field = useFieldContext<string>();
  const radioId = (id: string) => `${field.name}-${id}`;

  useEffect(() => {
    if (focusSelected) document.getElementById(radioId(field.state.value))?.focus();
    // Only once rendered: later changes of the value keep the focus where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormGroup
      role="radiogroup"
      fieldId={field.name}
      // TRANSLATORS: label of the list of languages for the installer
      label={_("Language")}
    >
      <div className="agm-language-list">
        {languages.map(({ id, name }) => (
          <Radio
            key={id}
            id={radioId(id)}
            name={field.name}
            isChecked={id === field.state.value}
            onChange={() => field.handleChange(id)}
            label={<span lang={id}>{name}</span>}
          />
        ))}
      </div>
    </FormGroup>
  );
}
