/*
 * Copyright (c) [2025] SUSE LLC
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
import UnusedMenu from "~/components/storage/UnusedMenu";
import FilesystemMenu from "~/components/storage/FilesystemMenu";
import PartitionsSection from "~/components/storage/PartitionsSection";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import { useDevice } from "~/hooks/storage/model";

type DeviceEditorContentProps = {
  collection: "drives" | "mdRaids";
  index: number;
};

export default function DeviceEditorContent({
  collection,
  index,
}: DeviceEditorContentProps): React.ReactNode {
  const deviceModel = useDevice(collection, index);
  if (!deviceModel.isUsed) return <UnusedMenu collection={collection} index={index} />;

  return (
    <>
      {deviceModel.filesystem && <FilesystemMenu collection={collection} index={index} />}
      {!deviceModel.filesystem && <PartitionsSection collection={collection} index={index} />}
      {!deviceModel.filesystem && <SpacePolicyMenu collection={collection} index={index} />}
    </>
  );
}
