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
import { Content, Flex, Form, FormGroup, Radio } from "@patternfly/react-core";
import { useNavigate } from "react-router";
import { ListSearch, Page } from "~/components/core";
import { updateConfig } from "~/api/api";
import { useSystem } from "~/queries/system";
import { useProposal } from "~/queries/proposal";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { _ } from "~/i18n";

// TODO: Add documentation
// TODO: Evaluate if worth it extracting the selector
export default function LocaleSelection() {
  const navigate = useNavigate();
  const {
    l10n: { locales },
  } = useSystem();
  const {
    l10n: { locale: currentLocale },
  } = useProposal();
  const [selected, setSelected] = useState(currentLocale);
  const [filteredLocales, setFilteredLocales] = useState(locales);

  const searchHelp = _("Filter by language, territory or locale code");

  const onSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    updateConfig({ l10n: { locale: selected } });
    navigate(-1);
  };

  let localesList = filteredLocales.map(({ id, name, territory }) => {
    return (
      <Radio
        id={id}
        key={id}
        name="locale"
        onChange={() => setSelected(id)}
        label={
          <Flex gap={{ default: "gapSm" }}>
            <Content isEditorial>{name}</Content>
            <Content className={`${textStyles.textColorPlaceholder}`}>{territory}</Content>
            <Content className={`${textStyles.textColorSubtle}`}>{id}</Content>
          </Flex>
        }
        value={id}
        isChecked={id === selected}
      />
    );
  });

  if (localesList.length === 0) {
    localesList = [<b key="notfound">{_("None of the locales match the filter.")}</b>];
  }

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Locale selection")}</Content>
        <ListSearch placeholder={searchHelp} elements={locales} onChange={setFilteredLocales} />
      </Page.Header>

      <Page.Content>
        <Form id="localeSelection" onSubmit={onSubmit}>
          <FormGroup isStack>{localesList}</FormGroup>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Submit form="localeSelection">{_("Select")}</Page.Submit>
        <Page.Cancel />
      </Page.Actions>
    </Page>
  );
}
