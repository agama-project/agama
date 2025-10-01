/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { ActionGroup, Content, Form, FormGroup } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { _ } from "~/i18n";
import { useL10n } from "~/queries/l10n";
import TypeaheadSelector from "../core/TypeaheadSelector";
import { Keymap, Locale } from "~/types/l10n";

// TODO: Add documentation
// TODO: Evaluate if worth it extracting the selector
export default function L10nFormPage() {
  const {
    keymaps,
    selectedKeymap: currentKeymap,
    locales,
    selectedLocale: currentLocale,
  } = useL10n();
  const [selected, setSelected] = useState(currentLocale);
  const [selectedKeymap, setSelectedKeymap] = useState(currentKeymap);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Localization")}</Content>
      </Page.Header>

      <Page.Content>
        <Form id="localeSelection">
          <FormGroup isStack>
            <TypeaheadSelector
              label={_("Language")}
              placeholder={"Language or country"}
              options={locales}
              selected={selected}
              optionRender={({ option }: { option: Locale }) => (
                <>
                  {option.name} {option.territory}
                </>
              )}
              onChange={setSelected}
              inputValue={selected.name}
            />
          </FormGroup>
          <FormGroup isStack>
            <TypeaheadSelector
              label={_("Keyboard")}
              placeholder={"Name or code"}
              options={keymaps}
              selected={currentKeymap}
              optionRender={({ option }: { option: Keymap }) => <>{option.name}</>}
              onChange={setSelectedKeymap}
              inputValue={selectedKeymap.name}
            />
          </FormGroup>
          <ActionGroup>
            <Page.Submit form="localeSelection">{_("Accept")}</Page.Submit>
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
