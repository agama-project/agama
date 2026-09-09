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
import SummaryLayout from "~/components/storage/storage-page/SummaryLayout";
import ConfigurationTitle from "~/components/storage/storage-page/ConfigurationTitle";
import Consequences from "~/components/storage/storage-page/Consequences";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import { useSingleDevice, useHasExistingContent } from "~/components/storage/storage-page/queries";
import { _ } from "~/i18n";

/**
 * What the storage page reports: the configuration, as one block.
 *
 * There is one summary, not two. A configuration of a single device is the same
 * summary in the case where the configuration is one device, so the shape is
 * read once here and the parts that differ are filled differently. Making the
 * two cases siblings would have each of them work out that fact again and
 * rewrite everything they share.
 *
 * What differs is what the reader can do about it. Where the whole
 * configuration is one device, the page can offer decisions about that device,
 * because there is no doubt which one they are about. Where it is several, the
 * list under the summary is where each of them is acted on, and the summary
 * says so instead.
 */
export default function ConfigurationSummary(): React.ReactNode {
  const singleDevice = useSingleDevice();
  const hasExistingContent = useHasExistingContent(singleDevice?.device.name);
  /* Offered only where there is one subject for it. On several entries each row
     carries its own, since one answer cannot speak for three disks. */
  const spaceDecision = singleDevice && hasExistingContent;

  return (
    <SummaryLayout
      title={<ConfigurationTitle />}
      control={
        spaceDecision && (
          <SpaceDecision collection={singleDevice.collection} index={singleDevice.index} />
        )
      }
      /* The same report either way. A page that names what it destroys on a
         full disk and stays quiet about a plan of eight is a page with two
         shapes, and the reader learns which one they got by guessing. */
      count={<Consequences />}
      /* Closed against the list it introduces, which a single device has
         nothing of. */
      isTight={!singleDevice}
      body={
        singleDevice
          ? undefined
          : // TRANSLATORS: said under the summary of a configuration made of
            // several entries, about the list of those entries below it.
            _(
              "Review and configure the entries below. You can change, remove, or add entries as needed.",
            )
      }
    />
  );
}
