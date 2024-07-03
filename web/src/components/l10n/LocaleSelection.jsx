/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useState } from "react";
import { Flex, Form, FormGroup, Radio } from "@patternfly/react-core";
import { useLoaderData, useNavigate } from "react-router-dom";
import { ListSearch, Page } from "~/components/core";
import { _ } from "~/i18n";
import { useConfigMutation } from "~/queries/l10n";
import textStyles from '@patternfly/react-styles/css/utilities/Text/text';

// TODO: Add documentation and typechecking
// TODO: Evaluate if worth it extracting the selector
export default function LocaleSelection() {
  const navigate = useNavigate();
  const setConfig = useConfigMutation();
  const { locales, locale: currentLocale } = useLoaderData();
  const [selected, setSelected] = useState(currentLocale.id);
  const [filteredLocales, setFilteredLocales] = useState(locales);

  const searchHelp = _("Filter by language, territory or locale code");

  const onSubmit = async (e) => {
    e.preventDefault();
    setConfig.mutate({ locales: selected });
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
            <span className={textStyles.fontSizeLg}><b>{name}</b></span>
            <span className={[textStyles.fontSizeMd, textStyles.color_100].join(" ")}>{territory}</span>
            <span className={[textStyles.fontSizeXs, textStyles.color_400].join(" ")}>{id}</span>
          </Flex>
        }
        value={id}
        isChecked={id === selected}
      />
    );
  });

  if (localesList.length === 0) {
    localesList = (
      <b>{_("None of the locales match the filter.")}</b>
    );
  }

  return (
    <>
      <Page.Header>
        <h2>{_("Locale selection")}</h2>
        <ListSearch placeholder={searchHelp} elements={locales} onChange={setFilteredLocales} />
      </Page.Header>

      <Page.MainContent>
        <Page.CardSection>
          <Form id="localeSelection" onSubmit={onSubmit}>
            <FormGroup isStack>
              {localesList}
            </FormGroup>
          </Form>
        </Page.CardSection>
      </Page.MainContent>
      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="localeSelection">
          {_("Select")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
