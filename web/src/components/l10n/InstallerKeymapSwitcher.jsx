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

import React, { useState } from "react";
import {
  Flex,
  Select, SelectList, SelectOption,
  MenuToggle
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import agama from "~/agama";
import { _ } from "~/i18n";
import { useInstallerL10n } from "~/context/installerL10n";
import { useL10n } from "~/context/l10n";
import { localConnection } from "~/utils";

const sort = (keymaps) => {
  // sort the keymap names using the current locale
  const lang = agama.language || "en";
  return keymaps.sort((k1, k2) => k1.name.localeCompare(k2.name, lang));
};

export default function InstallerKeymapSwitcher() {
  const { keymap: keymapId, changeKeymap } = useInstallerL10n();
  const { keymaps } = useL10n();
  const [isOpen, setIsOpen] = useState(false);
  const selectedKeymap = keymaps.find(k => k.id === keymapId);

  const onSelect = (_, id) => {
    setIsOpen(false);
    changeKeymap(id);
  };

  const toggle = toggleRef => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
      {selectedKeymap?.name}
    </MenuToggle>
  );

  const options = sort(keymaps)
    .map((keymap, index) => (
      <SelectOption key={index} value={keymap.id}>{keymap.name}</SelectOption>
    ));

  return (
    <Flex gap={{ default: "gapMd" }} alignItems={{ default: "alignItemsCenter" }}>
      <div>
        <Icon name="keyboard" size="s" /> <b>{_("Keyboard")}</b>
      </div>
      {
        localConnection()
          ? (
            <Select
              id="keyboard"
              isScrollable
              isOpen={isOpen}
              aria-label={_("Choose a keyboard layout")}
              selected={keymapId}
              onSelect={onSelect}
              onOpenChange={(isOpen) => setIsOpen(isOpen)}
              toggle={toggle}
            >
              <SelectList>
                {options}
              </SelectList>
            </Select>
          )
          : _("Cannot be changed in remote installation")

      }
    </Flex>
  );
}
