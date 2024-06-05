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
  Card, CardBody, CardFooter, CardHeader, CardTitle,
  Form, FormGroup,
  Gallery, GalleryItem,
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
  const [selected, setSelected] = useState(selectedLocales[0].id);
  const [filteredLocales, setFilteredLocales] = useState(locales);
  const navigate = useNavigate();

  const searchHelp = _("Filter by language, territory or locale code");

  useEffect(() => {
    setFilteredLocales(locales);
  }, [locales, setFilteredLocales]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const dataForm = new FormData(e.target);
    // FIXME: Card does not set the `value` attribute to the hidden input radio
    // Thus, is not possible to get the selected value here, it returns "on"
    // instead
    // See https://github.com/patternfly/patternfly-react/blob/ee4a3f28526995396892ef364d483da9c846c160/packages/react-core/src/components/Card/Card.tsx#L188-L197
    const nextLocaleId = dataForm.get("locale");

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
              {/* <Gallery hasGutter minWidths={{ default: "180px" }}> */}
              <Gallery hasGutter>
                {filteredLocales.map((locale) => (
                  <GalleryItem key={locale.id}>
                    <Card isRounded isCompact isFullHeight id={`option-${locale.id}`} isSelectable isSelected={locale.id === selected}>
                      <CardHeader
                        selectableActions={{
                          name: "locale",
                          variant: "single",
                          selectableActionId: locale.id,
                          onChange: (event) => setSelected(event.currentTarget.id)
                        }}
                      >
                        <CardTitle>
                          <span className={textStyles.fontSizeLg}>
                            <b>{locale.name}</b>
                          </span> <span className={[textStyles.fontSizeMd, textStyles.color_300].join(" ")}>{locale.territory}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardBody>
                        <div className={[textStyles.fontSizeXs, textStyles.color_400].join(" ")}>{locale.id}</div>
                      </CardBody>
                    </Card>
                  </GalleryItem>
                ))}
              </Gallery>
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
