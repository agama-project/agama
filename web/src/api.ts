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

import { get, patch, post, put } from "~/http";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Config } from "~/model/config";
import type { Issue } from "~/model/issue";
import type { Proposal } from "~/model/proposal";
import type { Question } from "~/model/question";
import type { Status } from "~/model/status";
import type { System } from "~/model/system";
import type { Action, L10nSystemConfig } from "~/model/action";
import type { AxiosResponse } from "axios";
import type { Job } from "~/types/job";

type Response = Promise<AxiosResponse>;

const getStatus = (): Promise<Status | null> => get("/api/v2/status");

const getConfig = (): Promise<Config | null> => get("/api/v2/config");

const getExtendedConfig = (): Promise<Config | null> => get("/api/v2/extended_config");

const getSystem = (): Promise<System | null> => get("/api/v2/system");

const getProposal = (): Promise<Proposal | null> => get("/api/v2/proposal");

const getIssues = (): Promise<Issue[]> => get("/api/v2/issues");

const getQuestions = (): Promise<Question[]> => get("/api/v2/questions");

const getStorageModel = (): Promise<ConfigModel.Config | null> =>
  get("/api/v2/private/storage_model");

const solveStorageModel = (model: ConfigModel.Config): Promise<ConfigModel.Config | null> => {
  const json = encodeURIComponent(JSON.stringify(model));
  return get(`/api/v2/private/solve_storage_model?model=${json}`);
};

const putConfig = (config: Config): Response => put("/api/v2/config", config);

const putStorageModel = (model: ConfigModel.Config) => put("/api/v2/private/storage_model", model);

const patchConfig = (config: Config) => patch("/api/v2/config", { update: config });

const patchQuestion = (question: Question): Response => {
  const {
    id,
    answer: { action, value },
  } = question;
  return patch(`/api/v2/questions`, { answer: { id, action, value } });
};

const postAction = (action: Action) => post("/api/v2/action", action);

const configureL10nAction = (config: L10nSystemConfig) => postAction({ configureL10n: config });

const activateStorageAction = () => postAction({ activateStorage: null });

const probeStorageAction = () => postAction({ probeStorage: null });

const finishInstallation = () => postAction({ finish: "reboot" });

/**
 * @todo Adapt jobs to the new API.
 */
const getStorageJobs = (): Promise<Job[]> => get("/api/storage/jobs");

export {
  getStatus,
  getConfig,
  getExtendedConfig,
  getSystem,
  getProposal,
  getIssues,
  getQuestions,
  getStorageModel,
  solveStorageModel,
  putConfig,
  putStorageModel,
  patchConfig,
  patchQuestion,
  configureL10nAction,
  activateStorageAction,
  probeStorageAction,
  finishInstallation,
  getStorageJobs,
};

export type { Response };
