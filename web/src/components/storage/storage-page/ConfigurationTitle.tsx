/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import Interpolate from "~/components/core/Interpolate";
import DeviceName from "~/components/storage/shared/DeviceName";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { baseName } from "~/components/storage/utils";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import { _, n_ } from "~/i18n";

/**
 * The simplest true thing the page can say about the whole configuration.
 *
 * "Across multiple devices" is what the page said about every plan of more than
 * one entry, and it was wrong about the most common non-trivial installation
 * there is: one disk, one volume group on it. The machine holds one device, and
 * a sentence claiming several is a sentence the reader can see is false.
 *
 * Two rules decide how far it goes. A name is worth more than a count until
 * there are three of them, which is the threshold the rest of the page already
 * uses. And the sentence never lists two kinds of thing at once: the moment
 * groups sit over more than one disk, naming both halves produces a sentence
 * with two lists in it, and the list under it is a better list than any
 * sentence can be.
 *
 * Past what it can say in one line it stops trying and says what is being done
 * instead, leaving the naming to the entries below.
 */
export default function ConfigurationTitle(): React.ReactNode {
  const config = useConfigModel();
  const drives = config?.drives || [];
  const mdRaids = config?.mdRaids || [];
  const groups = config?.volumeGroups || [];
  const hosts = [...drives, ...mdRaids];
  const onlyHost = hosts.length === 1 ? hosts[0] : undefined;
  const systemDevice = useDevice(onlyHost?.name || "");

  /* Nothing to say about a configuration that was never read. The page only
     mounts this where there is one, so this is the type guard and not a state. */
  if (!config) return null;

  /* Whether the one host is a disk or a RAID stays in the sentence rather than
     becoming a placeholder of its own: an article and a noun agree in most
     languages, and a slot that takes either "disk" or "RAID" leaves a
     translator with no way to make them agree. */
  const onDisk = drives.length === 1;
  const namedHost = () =>
    onlyHost && <DeviceName name={baseName(onlyHost.name)} size={systemDevice?.block?.size} />;

  if (onlyHost && groups.length === 0) {
    const boots = configModel.boot.hasDevice(config, onlyHost.name);
    const sentence = (() => {
      if (onDisk) {
        return boots
          ? // TRANSLATORS: the whole storage configuration in one line, where it
            // is one disk that also starts the machine. %s is a disk name and
            // its size, such as "vdd (20 GiB)".
            _("Use disk %s as installation and boot device")
          : // TRANSLATORS: the whole storage configuration in one line, where it
            // is one disk. %s is a disk name and its size, such as
            // "vdd (20 GiB)".
            _("Use disk %s as installation device");
      }

      return boots
        ? // TRANSLATORS: the whole storage configuration in one line, where it
          // is one software RAID that also starts the machine. %s is the RAID
          // name and its size, such as "md0 (20 GiB)".
          _("Use RAID %s as installation and boot device")
        : // TRANSLATORS: the whole storage configuration in one line, where it
          // is one software RAID. %s is the RAID name and its size, such as
          // "md0 (20 GiB)".
          _("Use RAID %s as installation device");
    })();

    return <Interpolate sentence={sentence}>{namedHost}</Interpolate>;
  }

  /* One host with volume groups over it: the shape the page was worst at, and
     the one most readers arrive with. */
  if (onlyHost && groups.length > 0) {
    const names = groups.map((group) => group.vgName).filter(Boolean);

    const named = names.length === groups.length && groups.length <= NAMES_PER_LINE;

    if (named && groups.length === 1) {
      const sentence = onDisk
        ? // TRANSLATORS: the whole storage configuration in one line. %1$s is
          // the name of an LVM volume group and %2$s a disk name and its size,
          // such as "vdd (20 GiB)".
          _("Create LVM volume group %1$s on disk %2$s")
        : // TRANSLATORS: the whole storage configuration in one line. %1$s is
          // the name of an LVM volume group and %2$s the name of a software
          // RAID and its size, such as "md0 (20 GiB)".
          _("Create LVM volume group %1$s on RAID %2$s");

      return (
        <Interpolate sentence={sentence}>
          {[() => <DeviceName name={names[0]} />, namedHost]}
        </Interpolate>
      );
    }

    if (named && groups.length === 2) {
      const sentence = onDisk
        ? // TRANSLATORS: the whole storage configuration in one line. %1$s and
          // %2$s are the names of two LVM volume groups, %3$s a disk name and
          // its size, such as "vdd (20 GiB)".
          _("Create LVM volume groups %1$s and %2$s on disk %3$s")
        : // TRANSLATORS: the whole storage configuration in one line. %1$s and
          // %2$s are the names of two LVM volume groups, %3$s the name of a
          // software RAID and its size, such as "md0 (20 GiB)".
          _("Create LVM volume groups %1$s and %2$s on RAID %3$s");

      return (
        <Interpolate sentence={sentence}>
          {[() => <DeviceName name={names[0]} />, () => <DeviceName name={names[1]} />, namedHost]}
        </Interpolate>
      );
    }

    /* Too many to name, so they are counted and the list below names them. */
    const sentence = onDisk
      ? // TRANSLATORS: the whole storage configuration in one line. %1$d is how
        // many LVM volume groups are being created and %2$s a disk name and its
        // size, such as "vdd (20 GiB)".
        n_(
          "Create %1$d LVM volume group on disk %2$s",
          "Create %1$d LVM volume groups on disk %2$s",
          groups.length,
        )
      : // TRANSLATORS: the whole storage configuration in one line. %1$d is how
        // many LVM volume groups are being created and %2$s the name of a
        // software RAID and its size, such as "md0 (20 GiB)".
        n_(
          "Create %1$d LVM volume group on RAID %2$s",
          "Create %1$d LVM volume groups on RAID %2$s",
          groups.length,
        );

    return <Interpolate sentence={sentence}>{[() => <>{groups.length}</>, namedHost]}</Interpolate>;
  }

  /* Several disks, whatever is over them. Counting the disks is the one thing
     the sentence can add that the list below does not already say per row. */
  if (hosts.length > 1 && mdRaids.length === 0) {
    return (
      <Interpolate
        sentence={
          // TRANSLATORS: the whole storage configuration in one line, where it
          // is spread over several disks. %d is how many disks it uses.
          n_(
            "Set up the new system across %d disk",
            "Set up the new system across %d disks",
            hosts.length,
          )
        }
      >
        {() => <>{hosts.length}</>}
      </Interpolate>
    );
  }

  // TRANSLATORS: the whole storage configuration in one line, where there is no
  // shorter true way to say what it does. The entries are listed under it.
  return <>{_("Set up the new system across multiple devices")}</>;
}
