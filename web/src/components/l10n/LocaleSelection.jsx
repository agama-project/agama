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
  Form, FormGroup,
  Radio,
  Stack,
  Text
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

  return (
    <>
      <Page.MainContent>
        <Stack hasGutter>
          <ListSearch placeholder={searchHelp} elements={locales} onChange={setFilteredLocales} />
          <Form id="localeSelection" onSubmit={onSubmit}>
            <FormGroup isStack>
              {filteredLocales.map((locale) => (
                <Radio
                  key={locale.id}
                  name="locale"
                  id={locale.id}
                  onChange={() => setSelected(locale)}
                  label={
                    <>
                      <span className={`${textStyles.fontSizeLg}`}>
                        <b>{locale.name}</b>
                      </span> <Text component="small">{locale.id}</Text>
                    </>
                  }
                  description={
                    <>
                      <span className={textStyles.fontSizeMd}>{locale.territory}</span>
                    </>
                  }
                  value={JSON.stringify(locale)}
                  checked={locale === selected}
                />
              ))}
            </FormGroup>
          </Form>
        </Stack>
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
