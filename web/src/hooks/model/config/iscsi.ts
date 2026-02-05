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
import { patchConfig, Response } from "~/api";
import iscsi from "~/model/config/iscsi";
import type { Config, ISCSI } from "~/model/config";

const selectConfig = (data: Config | null): ISCSI.Config => data?.iscsi;

function useConfig(): ISCSI.Config | null {
  const { data } = useSuspenseQuery({
    ...configQuery,
    select: selectConfig,
  });
  return data;
}

const setInitiator = (config: ISCSI.Config | null, name: string): ISCSI.Config =>
  config ? iscsi.setInitiator(config, name) : { initiator: name };

type setInitiatorFn = (name: string) => Response;

function useSetInitiator(): setInitiatorFn {
  const config = useConfig();
  return (name: string) => patchConfig({ iscsi: setInitiator(config, name) });
}

const addTarget = (config: ISCSI.Config | null, target: ISCSI.Target): ISCSI.Config =>
  config ? iscsi.addTarget(config, target) : { targets: [target] };

type addTargetFn = (target: ISCSI.Target) => Response;

function useAddTarget(): addTargetFn {
  const config = useConfig();
  return (target: ISCSI.Target) => patchConfig({ iscsi: addTarget(config, target) });
}

const removeTarget = (
  config: ISCSI.Config | null,
  name: string,
  addr: string,
  port: number,
): ISCSI.Config => (config ? iscsi.removeTarget(config, name, addr, port) : {});

type removeTargetFn = (name: string, addr: string, port: number) => Response;

function useRemoveTarget(): removeTargetFn {
  const config = useConfig();
  return (name: string, addr: string, port: number) =>
    patchConfig({ iscsi: removeTarget(config, name, addr, port) });
}

const addOrEditTarget = (config: ISCSI.Config | null, target: ISCSI.Target): ISCSI.Config => {
  if (config) {
    const clean = iscsi.removeTarget(config, target.name, target.address, target.port);
    return iscsi.addTarget(clean, target);
  } else {
    return { targets: [target] };
  }
};

type addOrEditTargetFn = (target: ISCSI.Target) => Response;

function useAddOrEditTarget(): addOrEditTargetFn {
  const config = useConfig();
  return (target: ISCSI.Target) => patchConfig({ iscsi: addOrEditTarget(config, target) });
}

export { useConfig, useSetInitiator, useAddTarget, useAddOrEditTarget, useRemoveTarget };
export type { setInitiatorFn as changeInitiatorFn };
