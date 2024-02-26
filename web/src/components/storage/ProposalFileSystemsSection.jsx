/*
 * Copyright (c) [2024] SUSE LLC
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
import { _ } from "~/i18n";
import { Section } from "~/components/core";
import { ProposalVolumes } from "~/components/storage";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalManager.ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").ProposalManager.Volume} Volume
 */

/**
 * Section for editing the proposal file systems
 * @component
 *
 * @callback onChangeFn
 * @param {object} settings
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings
 * @param {Volume[]} [props.volumeTemplates=[]]
 * @param {boolean} [props.isLoading=false]
 * @param {onChangeFn} [props.onChange=noop]
 *
 */
export default function ProposalFileSystemsSection({
  settings,
  volumeTemplates = [],
  isLoading = false,
  onChange = noop
}) {
  const { volumes = [] } = settings;

  const changeVolumes = (volumes) => {
    onChange({ volumes });
  };

  // Templates for already existing mount points are filtered out
  const usefulTemplates = () => {
    const mountPaths = volumes.map(v => v.mountPath);
    return volumeTemplates.filter(t => (
      t.mountPath.length > 0 && !mountPaths.includes(t.mountPath)
    ));
  };

  const encryption = settings.encryptionPassword !== undefined && settings.encryptionPassword.length > 0;

  return (
    <Section title={_("File systems")}>
      <ProposalVolumes
        volumes={volumes}
        templates={usefulTemplates()}
        options={{ lvm: settings.lvm, encryption }}
        isLoading={isLoading && settings.volumes === undefined}
        onChange={changeVolumes}
      />
    </Section>
  );
}
