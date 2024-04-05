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

import React from "react";
import { FormSelect, FormSelectOption } from "@patternfly/react-core";

import agama from "~/agama";

import { Icon } from "~/components/layout";
import { _ } from "~/i18n";
import { useInstallerL10n } from "~/context/installerL10n";
import { useL10n } from "~/context/l10n";
import { localConnection } from "~/utils";
import { If } from "~/components/core";

const sort = (keymaps) => {
  // sort the keymap names using the current locale
  const lang = agama.language || "en";
  return keymaps.sort((k1, k2) => k1.name.localeCompare(k2.name, lang));
};

export default function InstallerKeymapSwitcher() {
  const { keymap, changeKeymap } = useInstallerL10n();
  const { keymaps } = useL10n();

  const onChange = (_, id) => changeKeymap(id);

  const options = sort(keymaps)
    .map((keymap, index) => <FormSelectOption key={index} value={keymap.id} label={keymap.name} />);

  return (
    <>
      <h3>
        {/* TRANSLATORS: label for keyboard layout selection */}
        <Icon name="keyboard" size="24" />{_("Keyboard")}
      </h3>
      <If
        condition={localConnection()}
        then={
          <FormSelect
            id="keyboard"
            // TRANSLATORS: label for keyboard layout selection
            aria-label={_("keyboard")}
            value={keymap}
            onChange={onChange}
          >
            {options}
          </FormSelect>
        }
        else={
          // TRANSLATORS:
          _("Keyboard layout cannot be changed in remote installation")
        }
      />
    </>
  );
}
