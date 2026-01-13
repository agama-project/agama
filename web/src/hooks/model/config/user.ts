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

import { useSuspenseQuery } from "@tanstack/react-query";
import { configQuery } from "~/hooks/model/config";
import { putConfig, Response } from "~/api";
import type { Config } from "~/model/config";

const removeUserConfig = (data: Config | null): Config =>
  data ? { ...data, user: undefined } : {};

type RemoveUserFn = () => Response;

function useRemoveUser(): RemoveUserFn {
  const { data } = useSuspenseQuery({
    ...configQuery,
    select: removeUserConfig,
  });
  return () => putConfig(data);
}

export { useRemoveUser };
export type { RemoveUserFn };
