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
import { Icon } from "../layout";
import { FormSelect, FormSelectOption } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { useL10n } from "~/context/l10n";
import cockpit from "~/lib/cockpit";

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useL10n();
  const [selected, setSelected] = useState(null);
  const languages = cockpit.manifests.agama?.locales || [];

  const onChange = useCallback((_event, value) => {
    setSelected(value);
    changeLanguage(value);
  }, [setSelected, changeLanguage]);

  const options = Object.entries(languages).map(([id, name]) => {
    return <FormSelectOption key={id} value={id} label={name} />;
  });

  return (
    <>
      <h3>
        <Icon name="translate" size="24" />{_("Display Language")}
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
