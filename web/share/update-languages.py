#!/usr/bin/env python3

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

#
# This script generates the list of supported languages in JSON format.
#

from argparse import ArgumentParser
from langtable import language_name
from pathlib import Path
import json
import subprocess
import sys

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
        parts = cmd.stderr.decode("UTF-8").split(",")
        numbers = []
        for part in parts:
            number, _rest = part.strip().split(" ", 1)
            numbers.append(int(number))

        total = sum(numbers)
        self.__coverage = round(int(numbers[0]) / total * 100)
        return self.__coverage

    def language(self):
        return self.path.stem


class Languages:
    """ This class takes care of generating the supported languages file"""

    def __init__(self):
        self.content = dict()

    def update(self, po_files, lang2territory: str, threshold: int):
        """
        Generate the list of supported locales

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
                    .format(language=locale.language),
                    file=sys.stderr
                )
            elif po_file.coverage() < threshold:
                print(
                    "not enough coverage for '{language}' ({coverage}%)"
                    .format(
                        language=locale.code(),
                        coverage=po_file.coverage()),
                    file=sys.stderr
                )
            else:
                supported.append(locale)

        languages = [loc.language for loc in supported]
        for locale in supported:
            include_territory = languages.count(locale.language) > 1
            self.content[locale.code()] = locale.name(include_territory)

    def dump(self):
        json.dump(self.content, sys.stdout, indent=2, ensure_ascii=False,
                  sort_keys=True)


def update_languages(args):
    """Print the supported languages in JSON format"""
    languages = Languages()
    paths = [path for path in Path(args.po_directory).glob("*.po")]
    with open(args.territories) as file:
        lang2territory = json.load(file)
    languages.update(paths, lang2territory, args.threshold)
    languages.dump()


if __name__ == "__main__":
    parser = ArgumentParser(prog="update-languages.py")
    parser.set_defaults(func=update_languages)
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
