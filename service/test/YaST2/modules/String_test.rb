# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../test_helper"

Yast.import "String"

describe Yast::String do
  before do
    # ensure proper default locale
    ENV["LANG"] = "C"
  end

  describe ".Quote" do
    it "returns empty string if nil passed" do
      expect(subject.Quote(nil)).to eq ""
    end

    it "returns all single quotes escaped" do
      expect(subject.Quote("")).to eq ""
      expect(subject.Quote("a")).to eq "a"
      expect(subject.Quote("a'b")).to eq "a'\\''b"
      expect(subject.Quote("a'b'c")).to eq "a'\\''b'\\''c"
    end
  end

  describe ".FormatSize" do
    it "returns empty string if nil passed" do
      expect(subject.FormatSize(nil)).to eq ""
    end

    FORMAT_SIZE_DATA = {
      0                     => "0 B",
      1                     => "1 B",
      1025                  => "1 KiB",
      1125                  => "1.1 KiB",
      743 * 1024            => "743 KiB",
      1_049_000             => "1.00 MiB",
      -1_049_000            => "-1 MiB", # FIXME: why?
      1_074_000_000         => "1.000 GiB",
      1_100_000_000_000     => "1.000 TiB",
      1_126_000_000_000_000 => "1024.091 TiB",
      1 << 10               => "1 KiB",
      1 << 20               => "1.00 MiB",
      1 << 30               => "1.000 GiB",
      1 << 40               => "1.000 TiB"
    }.freeze

    it "returns size formatted with proper bytes units" do
      FORMAT_SIZE_DATA.each do |arg, res|
        expect(subject.FormatSize(arg)).to eq res
      end
    end
  end

  describe ".FormatSizeWithPrecision" do
    it "returns empty string if nil passed" do
      expect(subject.FormatSizeWithPrecision(nil, nil, nil)).to eq ""
    end

    it "returns bytes in proper unit with passed precision forcing trailing zeroes " \
       "if omit_zeroes not passed" do
      expect(subject.FormatSizeWithPrecision(1025 << 30, 2, false)).to eq "1.00 TiB"
      expect(subject.FormatSizeWithPrecision(1025 << 30, 3, false)).to eq "1.001 TiB"
    end

    it "returns bytes with zero precision if nil precision passed" do
      expect(subject.FormatSizeWithPrecision(1025 << 30, nil, false)).to eq "1 TiB"
    end

    it "omit trailing zeros if omit_zeroes is passed as true" do
      expect(subject.FormatSizeWithPrecision(4097, 2, true)).to eq "4 KiB"
      expect(subject.FormatSizeWithPrecision(1 << 20, 2, true)).to eq "1 MiB"
      expect(subject.FormatSizeWithPrecision(1025, 2, true)).to eq "1 KiB"
      expect(subject.FormatSizeWithPrecision(8 << 30, 2, true)).to eq "8 GiB"
    end
  end

  describe ".CutBlanks" do
    it "return empty string for nil" do
      expect(subject.CutBlanks(nil)).to eq ""
    end

    CUT_BLANKS_DATA = {
      ""              => "",
      "abc"           => "abc",
      " abc"          => "abc",
      "abc "          => "abc",
      " abc "         => "abc",
      "\tabc "        => "abc",
      "\tabc\t "      => "abc",
      " \tabc\t "     => "abc",
      "\t a b c \t"   => "a b c",
      "\t a b c \t\n" => "a b c \t\n"
    }.freeze
    it "remove trailing and prepending whitespace" do
      CUT_BLANKS_DATA.each do |arg, res|
        expect(subject.CutBlanks(arg)).to eq res
      end
    end
  end

  describe ".Repeat" do
    it "returns empty string is nil passed as text" do
      expect(subject.Repeat(nil, 5)).to eq ""
    end

    it "returns empty string if nil passed as number" do
      expect(subject.Repeat("a", nil)).to eq ""
    end

    it "returns empty string if number is zero or negative" do
      expect(subject.Repeat("a", 0)).to eq ""
      expect(subject.Repeat("a", -1)).to eq ""
    end

    it "returns string text repeated number times" do
      expect(subject.Repeat("a", 5)).to eq "aaaaa"
    end
  end

  describe ".CutRegexMatch" do
    it "returns string with first match of given regexp removed when glob is set to false" do
      expect(subject.CutRegexMatch("ab123cd56", "[0-9]+", false)).to eq "abcd56"
    end

    it "returns string with all matches of given regexp removed when glob is set to true" do
      expect(subject.CutRegexMatch("ab123cd56", "[0-9]+", true)).to eq "abcd"
    end

    it "returns input when no match of regex found" do
      expect(subject.CutRegexMatch("ab123cd56", "[A-Z]+", false)).to eq "ab123cd56"
    end

    it "returns empty string if input is nil" do
      expect(subject.CutRegexMatch(nil, "[A-Z]+", false)).to eq ""
    end

    it "returns input if regex is nil" do
      expect(subject.CutRegexMatch("ab123cd56", nil, false)).to eq "ab123cd56"
    end
  end

  describe ".FirstChunk" do
    it "returns first part s splitted by any of separators" do
      expect(subject.FirstChunk("a b", " ")).to eq "a"
      expect(subject.FirstChunk("a b", "\n\t ")).to eq "a"
      expect(subject.FirstChunk("abc def", "\n\t ")).to eq "abc"
    end

    it "returns s string if there is no match of separators" do
      expect(subject.FirstChunk("a b", "\t")).to eq "a b"
    end

    it "returns empty string if s is nil" do
      expect(subject.FirstChunk(nil, "\t")).to eq ""
    end

    it "returns empty string if separators is nil" do
      expect(subject.FirstChunk("a b", nil)).to eq ""
    end
  end

  describe ".Replace" do
    it "returns string with all source substring replaced by target" do
      arg = "abcdabcdab"
      expected_output = "12cd12cd12"

      expect(subject.Replace(arg, "ab", "12")).to eq expected_output
    end

    it "recursive replace parts if replacement create again source matching" do
      arg = "abbaabbaa"
      expected_output = "bbbbaaaaa"

      expect(subject.Replace(arg, "ab", "ba")).to eq expected_output
    end

    it "return nil if text is nil" do
      expect(subject.Replace(nil, "ab", "12")).to eq nil
    end

    it "returns unmodified text if source is nil" do
      expect(subject.Replace("abc", nil, "12")).to eq "abc"
    end

    it "returns unmodified text if target is nil" do
      expect(subject.Replace("abc", "ab", nil)).to eq "abc"
    end

    it "raises exception if target include source" do
      expect { subject.Replace("abc", "ab", "abcde") }.to raise_exception
      expect { subject.Replace("abc", "ab", "ab") }.to raise_exception
    end
  end

  describe ".FormatFilename" do
    it "returns truncated middle part of directory to fit len" do
      expect(subject.FormatFilename("/really/long/file/name", 15)).to eq "/.../file/name"
      expect(subject.FormatFilename("/really/long/file/name/", 15)).to eq "/.../file/name/"
      expect(subject.FormatFilename("/really/long/file/name", 10)).to eq "/.../name"
    end

    it "returns whole file_path if it fits len" do
      expect(subject.FormatFilename("/really/long/file/name", 50)).to eq "/really/long/file/name"
    end

    it "never removes the last part of name" do
      expect(subject.FormatFilename("/really/long/file/name", 3)).to eq ".../name"
    end

    it "can remove first part of path" do
      expect(subject.FormatFilename("/really/long/file/name", 5)).to eq ".../name"
    end

    it "returns nil if file_path is nil" do
      expect(subject.FormatFilename(nil, 5)).to eq nil
    end

    it "returns file_len truncated by second path element if len is nil" do
      expect(subject.FormatFilename("/really/long/file/name", nil)).to eq "/really/.../file/name"
    end
  end

end
