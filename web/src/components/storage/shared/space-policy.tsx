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

/**
 * The space policy an entry follows, and the one answer the model cannot carry.
 *
 * Three of the four answers survive a round trip to the service. "custom" does
 * not. It is not a value the model stores: the service works the policy out
 * again from the parts every time it builds a model, in
 * `service/lib/agama/storage/config_conversions/to_model_conversions/space_policy.rb`:
 *
 * ```ruby
 * return "delete" if delete_all_volumes?
 * return "resize" if shrink_all_volumes?
 * return "custom" if delete_volume? || resize_volume?
 *
 * "keep"
 * ```
 *
 * An entry told to decide part by part, before any part has decided anything,
 * deletes nothing and shrinks nothing. It is, written down, an entry keeping
 * everything, and that is what comes back. The answer is lost on the way, the
 * control springs back to "keep", and the per-part controls the answer was
 * asked for never appear. Nothing the client sends can prevent this: the value
 * it writes is discarded and recomputed.
 *
 * So the client remembers the asking itself. That is all this module is.
 *
 * @fixme Ask the storage service to let the model hold this. The policy is a
 *  decision the reader made, not a fact about the parts, and deriving it throws
 *  away the difference between "keep everything" and "I will say, one at a
 *  time". Either the model keeps `spacePolicy` as it was given, or it gains a
 *  way to say that the parts govern themselves.
 *
 *  Until then the memory here is the whole workaround, and it has the limit a
 *  workaround has: it lives in the page, so a reload loses the asking and the
 *  control reads "keep" again. Nothing decided is lost, only the asking, and
 *  only while nothing has been decided.
 *
 *  Once the service holds the value, this module goes: `useSpacePolicy` becomes
 *  a read of `spacePolicy`, `SpacePolicyMemory` comes out of `StoragePage`, and
 *  its callers read the entry they already hold.
 */

import React from "react";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";

/** What was last asked for, by entry, under "drives.0" and the like. */
type Asked = Record<string, ConfigModel.SpacePolicy>;

const AskedPolicies = React.createContext<{
  asked: Asked;
  remember: (key: string, policy: ConfigModel.SpacePolicy) => void;
}>({ asked: {}, remember: () => undefined });

/**
 * Remembers which entries were told to decide one part at a time.
 *
 * Above every control that offers the decision rather than inside each one. The
 * page offers it on a one-device plan and the sheet offers it again on the
 * entry, and two memories of the same answer disagree the moment one of them is
 * used: choosing custom on the page would open a sheet that had never heard of
 * it.
 */
export function SpacePolicyMemory({ children }: React.PropsWithChildren): React.ReactNode {
  const [asked, setAsked] = React.useState<Asked>({});
  const remember = React.useCallback(
    (key: string, policy: ConfigModel.SpacePolicy) =>
      setAsked((current) => ({ ...current, [key]: policy })),
    [],
  );
  const value = React.useMemo(() => ({ asked, remember }), [asked, remember]);

  return <AskedPolicies.Provider value={value}>{children}</AskedPolicies.Provider>;
}

export type SpacePolicyChoice = {
  /** What the entry is doing with what is already on it. */
  policy: ConfigModel.SpacePolicy;
  /** Answers for the entry, and remembers the answer the configuration drops. */
  choose: (policy: ConfigModel.SpacePolicy) => void;
};

/**
 * The rule an entry follows for what is already on it, and the way to change it.
 *
 * Read the policy through this rather than off `spacePolicy`, or an entry told
 * to decide part by part will not appear to have been: what is remembered beats
 * the configuration in the one case where the configuration is reporting what
 * custom collapses to, and the note at the top of this file says why there is
 * such a case at all. Every other answer follows the configuration, which is
 * where it is written.
 *
 * What the configuration says is passed in rather than read again: each caller
 * already holds the entry it is about, and a second reading of the same thing
 * is a second thing that can disagree.
 */
export function useSpacePolicy(
  collection: DeviceCollection,
  index: number,
  stored: ConfigModel.SpacePolicy = "keep",
): SpacePolicyChoice {
  const setSpacePolicy = useSetSpacePolicy();
  const { asked, remember } = React.useContext(AskedPolicies);

  const key = `${collection}.${index}`;
  const policy = asked[key] === "custom" && stored === "keep" ? "custom" : stored;

  const choose = (next: ConfigModel.SpacePolicy) => {
    remember(key, next);

    /* Already the answer. Written again it changes nothing for three of the
       four, but custom clears every decision made under it, which is the
       opposite of what pressing the answer you are on can mean. */
    if (next !== policy) setSpacePolicy(collection, index, { type: next });
  };

  return { policy, choose };
}
