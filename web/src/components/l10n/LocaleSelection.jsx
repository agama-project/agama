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

import React, { useEffect, useState } from "react";
import {
  Flex,
  Form, FormGroup,
  Radio,
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { _ } from "~/i18n";
import { useL10n } from "~/context/l10n";
import { useInstallerClient } from "~/context/installer";
import { ListSearch, Page } from "~/components/core";
import textStyles from '@patternfly/react-styles/css/utilities/Text/text';

// TODO: Add documentation and typechecking
// TODO: Evaluate if worth it extracting the selector
export default function LocaleSelection() {
  const { l10n } = useInstallerClient();
  const { locales, selectedLocales } = useL10n();
  const [selected, setSelected] = useState(selectedLocales[0]);
  const [filteredLocales, setFilteredLocales] = useState(locales);
  const navigate = useNavigate();

  const searchHelp = _("Filter by language, territory or locale code");

  useEffect(() => {
    setFilteredLocales(locales);
  }, [locales, setFilteredLocales]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const dataForm = new FormData(e.target);
    const nextLocaleId = JSON.parse(dataForm.get("locale"))?.id;

    if (nextLocaleId !== selectedLocales[0]?.id) {
      await l10n.setLocales([nextLocaleId]);
    }

    navigate("..");
  };

  let localesList = filteredLocales.map((locale) => {
    return (
      <Radio
        key={locale.id}
        name="locale"
        id={locale.id}
        onChange={() => setSelected(locale)}
        label={
          <Flex gap={{ default: "gapSm" }}>
            <span className={textStyles.fontSizeLg}><b>{locale.name}</b></span>
            <span className={[textStyles.fontSizeMd, textStyles.color_100].join(" ")}>{locale.territory}</span>
            <span className={[textStyles.fontSizeXs, textStyles.color_400].join(" ")}>{locale.id}</span>
          </Flex>
        }
        value={JSON.stringify(locale)}
        checked={locale === selected}
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
