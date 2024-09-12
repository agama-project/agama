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

import { LUNInfo, ZFCPController, ZFCPDisk } from "~/types/zfcp";

const inactiveLuns = (controllers: ZFCPController[], disks: ZFCPDisk[]): LUNInfo[] => {
  const result: LUNInfo[] = [];
  for (const controller of controllers) {
    for (const [wwpn, luns] of Object.entries(controller.lunsMap)) {
      for (const lun of luns) {
        if (
          !disks.some((d) => d.lun === lun && d.wwpn === wwpn && d.channel === controller.channel)
        ) {
          result.push({
            channel: controller.channel,
            wwpn,
            lun,
          });
        }
      }
    }
  }

  return result;
};

export { inactiveLuns };
