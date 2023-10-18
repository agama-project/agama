#!/usr/bin/env python3

# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

from argparse import ArgumentParser
from langtable import language_name
from pathlib import Path
import json
import re
import subprocess


class Locale:
    language: str
    territory: str

    def __init__(self, language: str, territory: str = None):
        self.language = language
        self.territory = territory

    def code(self):
        return f"{self.language}-{self.territory}"

    def name(self, include_territory: bool = False):
        if include_territory:
            return language_name(languageId=self.language,
                                 territoryId=self.territory.upper())
        else:
            return language_name(languageId=self.language)


class PoFile:
    path: str
    locale: Locale
    stats_re = re.compile(r"(\d+) .+, (\d+) .+, (\d+) .+")

    def __init__(self, path: Path):
        self.path = path
        parts = self.path.stem.split("_")
        self.locale = Locale(*parts)
        self.__coverage = None

    def coverage(self):
        if self.__coverage is not None:
            return self.__coverage

        cmd = subprocess.run(["msgfmt", "--statistics", self.path],
                             capture_output=True)
        m = PoFile.stats_re.match(cmd.stderr.decode('UTF-8'))
        if m is None:
            return 0

        total = int(m[1]) + int(m[2]) + int(m[3])
        self.__coverage = round(int(m[1]) / total * 100)
        return self.__coverage

    def language(self):
        return self.path.stem


class Manifest:
    """ This class takes care of updating the manifest file"""

    def __init__(self, path: Path):
        self.path = path
        self.__read__()

    def __read__(self):
        with open(self.path) as file:
            self.content = json.load(file)

    def update(self, po_files, lang2territory: str, threshold: int):
        """
        Updates the list of locales in the manifest file

        It does not write the changes to file system. Use the write() function
        for that.

        :param po_directory   Directory where there are the po files
        :param lang2territory Map of languages to default territories
        :param threshold      Percentage of the strings that must be covered to
                              include the locale in the manifest
        """
        supported = [Locale("en", "us")]

        for path in po_files:
            po_file = PoFile(path)
            locale = po_file.locale
            if locale.territory is None:
                locale.territory = lang2territory.get(
                    locale.language, None)

            if locale.territory is None:
                print(
                    "could not find a territory for '{language}'"
                    .format(language=locale.language)
                )
            elif po_file.coverage() < threshold:
                print(
                    "not enough coverage for '{language}' ({coverage}%)"
                    .format(
                        language=locale.code(),
                        coverage=po_file.coverage())
                )
            else:
                supported.append(locale)

        languages = [loc.language for loc in supported]
        self.content["locales"] = dict()
        for locale in supported:
            include_territory = languages.count(locale.language) > 1
            self.content["locales"][locale.code()] = locale.name(
                include_territory)

    def write(self):
        with open(self.path, "w+") as file:
            json.dump(self.content, file, indent=4, ensure_ascii=False)


def update_manifest(args):
    """Command to update the manifest.json file"""
    manifest = Manifest(Path(args.manifest))
    paths = [path for path in Path(args.po_directory).glob("*.po")]
    with open(args.territories) as file:
        lang2territory = json.load(file)
    manifest.update(paths, lang2territory, args.threshold)
    manifest.write()


if __name__ == "__main__":
    parser = ArgumentParser(prog="locales.py")
    parser.set_defaults(func=update_manifest)
    parser.add_argument(
        "manifest", type=str, help="Path to the manifest file",
    )
    parser.add_argument(
        "--po-directory", type=str, help="Directory containing the po files",
        default="web/po"
    )
    parser.add_argument(
        "--territories", type=str, help="Path to language-territories map",
        default="web/share/locales.json"
    )
    parser.add_argument(
        "--threshold", type=int, help="threshold", default=70
    )

    parsed = parser.parse_args()
    parsed.func(parsed)
