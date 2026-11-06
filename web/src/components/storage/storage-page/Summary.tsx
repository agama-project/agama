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
import { sprintf } from "sprintf-js";
import { Flex, FlexItem } from "@patternfly/react-core";
import Interpolate, { markerText } from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import Consequences, { losesData } from "~/components/storage/storage-page/Consequences";
import {
  useActionCount,
  useSummaryWording,
} from "~/components/storage/storage-page/playground-switches";
import { useAnnounce } from "~/context/announcer";
import { useActions } from "~/hooks/model/proposal/storage";
import { _, n_ } from "~/i18n";
import type { TranslatedString } from "~/i18n";

const bold = (text: string) => <Text isBold>{text}</Text>;

/** Renders a sentence, its `[marked]` parts in bold. */
function Marked({ sentence }: { sentence: string }) {
  const count = [...sentence.matchAll(/\[[^[\]]*\]/g)].length;
  if (!count) return <>{sentence}</>;
  return <Interpolate sentence={sentence}>{Array(count).fill(bold)}</Interpolate>;
}

/**
 * How many things the installer does, said with its count. PLAYGROUND: what
 * is counted, and what it is called, can be switched from the console.
 */
function countPhrase(count: number, asChanges: boolean): string {
  return asChanges
    ? sprintf(
        // TRANSLATORS: how many changes the installer makes to the disks. It
        // is shown in bold inside a longer sentence.
        n_("%d change", "%d changes", count),
        count,
      )
    : sprintf(
        // TRANSLATORS: how many actions the installer performs on the disks.
        // It is shown in bold inside a longer sentence.
        n_("%d action", "%d actions", count),
        count,
      );
}

/**
 * The sentences of the summary: an optional first one, saying that nothing
 * happens yet, and the one about what happens later.
 *
 * Whatever is in square brackets is shown in bold: the count and "with data
 * loss", never "without data loss", which needs no emphasis.
 */
function sentences(
  count: number,
  isLossy: boolean,
  wording: "when" | "until",
  asChanges: boolean,
): { first?: string; second: string } {
  const what = `[${countPhrase(count, asChanges)}]`;

  if (wording === "until") {
    // TRANSLATORS: first line of the summary of the storage setup: nothing is
    // done to the disks before the installation starts.
    const first = _("Nothing is changed until the installation starts.");

    if (!count) {
      // TRANSLATORS: second line of the summary of the storage setup, when
      // the setup needs no changes to the disks at all.
      return { first, second: _("The setup below needs no changes to the disks.") };
    }

    return {
      first,
      second: sprintf(
        isLossy
          ? // TRANSLATORS: second line of the summary of the storage setup. %s
            // is a count such as "12 actions". Text in square brackets is
            // shown in bold; keep the brackets.
            _("Then the installer will perform %s to reach the setup below, [with data loss].")
          : // TRANSLATORS: second line of the summary of the storage setup. %s
            // is a count such as "12 actions".
            _("Then the installer will perform %s to reach the setup below, without data loss."),
        what,
      ),
    };
  }

  if (!count) {
    // TRANSLATORS: summary of the storage setup, when it needs no changes to
    // the disks at all.
    return { second: _("When the installation starts, nothing will be changed on the disks.") };
  }

  return {
    second: sprintf(
      isLossy
        ? // TRANSLATORS: summary of the storage setup. %s is a count such as
          // "12 actions". Text in square brackets is shown in bold; keep the
          // brackets.
          _(
            "When the installation starts, the installer will perform %s to reach the setup below, [with data loss].",
          )
        : // TRANSLATORS: summary of the storage setup. %s is a count such as
          // "12 actions".
          _(
            "When the installation starts, the installer will perform %s to reach the setup below, without data loss.",
          ),
      what,
    ),
  };
}

/**
 * Tells screen readers that the setup has started or stopped losing data.
 *
 * Only that flip is announced, not every change of the count: the count
 * changes with almost every setting, and announcing it each time would talk
 * over whatever the reader is doing. PLAYGROUND: to be re-evaluated, see
 * PLAYGROUND.md.
 */
function useAnnounceLossFlip(isLossy: boolean, message: string) {
  const announce = useAnnounce();
  const previous = React.useRef(isLossy);

  React.useEffect(() => {
    if (previous.current === isLossy) return;

    previous.current = isLossy;
    announce(message as TranslatedString);
  }, [isLossy, message, announce]);
}

/**
 * The summary of what the installer will do to the disks, at the top of the
 * storage page, with the way to see it in full.
 *
 * Not a caution: it reports what the setup below leads to, so it reads as
 * plain text, with only the count and a data loss in bold. It changes with
 * every setting, which is what makes it worth glancing back at.
 */
export default function Summary(): React.ReactNode {
  const actions = useActions();
  const wording = useSummaryWording();
  const countMode = useActionCount();

  const counted = countMode === "all" ? actions : actions.filter((a) => !a.subvol);
  const isLossy = losesData(actions);
  const { first, second } = sentences(counted.length, isLossy, wording, countMode === "changes");

  useAnnounceLossFlip(isLossy, markerText(first ? `${first} ${second}` : second));

  return (
    <Flex
      alignItems={{ default: "alignItemsFlexStart" }}
      gap={{ default: "gapSm" }}
      flexWrap={{ default: "nowrap" }}
    >
      <FlexItem className="agm-summary__icon">
        <Icon name="list_alt" aria-hidden />
      </FlexItem>
      <FlexItem>
        {first && (
          <>
            {first}
            <br />
          </>
        )}
        <Marked sentence={second} />{" "}
        <Consequences
          // TRANSLATORS: opens a popup with the layout the disks will have and
          // the actions needed to get there.
          label={_("Details…")}
          // TRANSLATORS: full name of the "Details" button, for screen readers.
          aria-label={_("Details of the planned storage changes")}
        />
      </FlexItem>
    </Flex>
  );
}
