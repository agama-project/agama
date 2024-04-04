/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { FormSelect, FormSelectOption, Popover } from "@patternfly/react-core";

import { Icon } from "../layout";
import { _ } from "~/i18n";
import { useInstallerL10n } from "~/context/installerL10n";
import supportedLanguages from "~/languages.json";

export default function InstallerLocaleSwitcher() {
  const { language, changeLanguage } = useInstallerL10n();
  const [selected, setSelected] = useState(null);

  const onChange = useCallback((_event, value) => {
    setSelected(value);
    changeLanguage(value);
  }, [setSelected, changeLanguage]);

  // sort by the language code to maintain consistent order
  const options = Object.keys(supportedLanguages).sort()
    .map(id => <FormSelectOption key={id} value={id} label={supportedLanguages[id]} />);

  // TRANSLATORS: help text for the language selector in the sidebar,
  // %s will be replaced by the "Localization" page link
  const [msg1, msg2] = _("The language used by the installer. The language \
for the installed system can be set in the %s page.").split("%s");

  // "hide" is a function which closes the popover
  const description = (hide) => (
    <>
      {msg1}
      {/* close the popover after clicking the link */}
      <Link to="/l10n" onClick={hide}>
        {_("Localization")}
      </Link>
      {msg2}
    </>
  );

  return (
    <>
      <h3>
        <Icon name="translate" size="s" />
        {_("Language")}&nbsp;
        {/* smaller width of the popover so it does not overflow outside the sidebar */}
        <Popover showClose={false} bodyContent={description} maxWidth="15em">
          <Icon name="info" size="xxs" />
        </Popover>
      </h3>
      <FormSelect
        id="language"
        aria-label={_("language")}
        value={selected || language}
        onChange={onChange}
      >
        {options}
      </FormSelect>
    </>
  );
}
