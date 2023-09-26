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

import React, { useEffect, useState } from "react";
import { useInstallerClient } from "~/context/installer";
import { Page } from "~/components/core";
import { _ } from "~/i18n";

function patternList(patterns) {
  return Object.keys(patterns).map(pattern => <p key={pattern}>{patterns[pattern][3]}</p>);
}

function SoftwareSelectionPage() {
  const [patterns, setPatterns] = useState();

  const client = useInstallerClient();

  useEffect(() => {
    // patterns already loaded
    if (patterns) return;

    client.software.patterns(true)
      .then((pats) => {
        setPatterns(pats);
      });
  }, [patterns, client.software]);

  console.log(patterns);

  const content = (patterns)
    ? <><h2>{_("Available Software")}</h2>{patternList(patterns)}</>
    : <></>;

  return (
    // TRANSLATORS: page title
    <Page title={_("Software")} icon="apps" actionLabel={_("Back")} actionVariant="secondary">
      { content }
    </Page>
  );
}

export default SoftwareSelectionPage;
