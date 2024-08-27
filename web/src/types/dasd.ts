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

type DASDDevice = {
  id: string;
  enabled: boolean;
  deviceName: string;
  formatted: boolean;
  diag: boolean;
  status: string; // TODO: sync with rust when it switch to enum
  deviceType: string; // TODO: sync with rust when it switch to enum
  accessType: string; // TODO: sync with rust when it switch to enum
  partitionInfo: string;
  hexId: number;
};

type FormatSummary = {
  total: number,
  step: number,
  done: boolean
}

type FormatJob = {
  job_id: string,
  summary: { [key: string]: FormatSummary }
}

export type { DASDDevice, FormatJob };
