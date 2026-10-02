#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2020] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require "y2storage"

Yast.import "Encoding"

describe Y2Storage::Filesystems::Type do
  include_context "yast2-storage-ng test setup"

  describe "#to_human_string" do
    it "returns the description of the type" do
      expect(Y2Storage::Filesystems::Type::HFSPLUS.to_human_string).to eq "MacHFS+"
    end

    it "returns the internal name (#to_s) for types with no description" do
      expect(Y2Storage::Filesystems::Type::MINIX.to_human_string).to eq "minix"
    end
  end

  describe "#supported_fstab_options" do
    it "returns Array of supported options" do
      Y2Storage::Filesystems::Type.constants.each do |const|
        type = Y2Storage::Filesystems::Type.const_get(const)
        next unless type.is_a?(Y2Storage::Filesystems::Type)

        expect(type.supported_fstab_options).to be_a(::Array)
      end
    end
  end

  describe "#default_partition_id" do
    it "returns PartitionId object that is suggested to use with filesystem" do
      Y2Storage::Filesystems::Type.constants.each do |const|
        type = Y2Storage::Filesystems::Type.const_get(const)
        next unless type.is_a?(Y2Storage::Filesystems::Type)

        expect(type.default_partition_id).to be_a(::Y2Storage::PartitionId)
      end
    end
  end

  describe "#legacy_root_filesystems" do
    let(:reiserfs) { Y2Storage::Filesystems::Type::REISERFS }

    it "returns an array of filesystems that were valid for '/' mountpoint" do
      expect(Y2Storage::Filesystems::Type.legacy_root_filesystems).to include(reiserfs)
    end
  end

  describe "#legacy_home_filesystems" do
    let(:reiserfs) { Y2Storage::Filesystems::Type::REISERFS }

    it "returns an array of filesystems that were valid for '/home' mountpoint" do
      expect(Y2Storage::Filesystems::Type.legacy_home_filesystems).to include(reiserfs)
    end
  end

  describe "#legacy_root?" do
    context "for a filesystem that is not legacy" do
      it "returns false" do
        Y2Storage::Filesystems::Type.root_filesystems.each do |filesystem|
          expect(filesystem.legacy_root?).to eq(false)
        end
      end
    end

    context "for a legacy filesystem that was valid for '/' mountpoint" do
      it "returns true" do
        Y2Storage::Filesystems::Type.legacy_root_filesystems.each do |filesystem|
          expect(filesystem.legacy_root?).to eq(true)
        end
      end
    end
  end

  describe "#legacy_home?" do
    context "for a filesystem that is not legacy" do
      it "returns false" do
        Y2Storage::Filesystems::Type.home_filesystems.each do |filesystem|
          expect(filesystem.legacy_home?).to eq(false)
        end
      end
    end

    context "for a legacy filesystem that was valid for '/home' mount point" do
      it "returns true" do
        Y2Storage::Filesystems::Type.legacy_home_filesystems.each do |filesystem|
          expect(filesystem.legacy_home?).to eq(true)
        end
      end
    end
  end

  describe "#iocharset and #codepage" do
    it "return the correct values in a utf8 locale" do
      Yast::Encoding.SetUtf8Lang(true)
      Yast::Encoding.SetEncLang("cs_CZ")
      expect(described_class::VFAT.iocharset).to eq "utf8"
      expect(described_class::VFAT.codepage).to eq "437"
    end

    it "return the correct values in a legacy cs_CZ locale" do
      Yast::Encoding.SetUtf8Lang(false)
      Yast::Encoding.SetEncLang("cs_CZ")

      expect(described_class::VFAT.iocharset).to eq "iso8859-2"
      expect(described_class::VFAT.codepage).to eq "852"
    end

    it "return the correct values in a legacy de_DE locale" do
      Yast::Encoding.SetUtf8Lang(false)
      Yast::Encoding.SetEncLang("de_DE")
      expect(described_class::VFAT.iocharset).to eq "iso8859-15"
      expect(described_class::VFAT.codepage).to eq "437"
    end

    it "return the correct values in a utf8 ja_JP locale" do
      Yast::Encoding.SetUtf8Lang(true)
      Yast::Encoding.SetEncLang("ja_JP")
      expect(described_class::VFAT.iocharset).to eq "utf8"
      expect(described_class::VFAT.codepage).to eq "932"
    end
  end

  describe "#default_fstab_options" do
    context "for locale-independent filesystem types" do
      it "ext2 has the correct fstab options" do
        expect(described_class::EXT2.default_fstab_options).to eq []
      end

      it "ext3 has the correct fstab options" do
        expect(described_class::EXT3.default_fstab_options).to eq ["data=ordered"]
      end

      it "ext4 has the correct fstab options" do
        expect(described_class::EXT4.default_fstab_options).to eq ["data=ordered"]
      end

      it "xfs has the correct fstab options" do
        expect(described_class::XFS.default_fstab_options).to eq []
      end

      it "ntfs has the correct fstab options" do
        expect(described_class::NTFS.default_fstab_options).to eq ["fmask=133", "dmask=022"]
      end
    end

    context "for locale-dependent filesystem types" do
      it "vfat has the correct fstab options for a utf8 locale" do
        Yast::Encoding.SetUtf8Lang(true)
        Yast::Encoding.SetEncLang("de_DE")
        expect(described_class::VFAT.default_fstab_options).to eq ["utf8"]
      end

      it "vfat has the correct fstab options for a non-utf8 cs_CZ locale" do
        Yast::Encoding.SetUtf8Lang(false)
        Yast::Encoding.SetEncLang("cs_CZ")
        expect(described_class::VFAT.default_fstab_options).to eq ["iocharset=iso8859-2",
                                                                   "codepage=852"]
      end

      it "vfat has the correct fstab options for a non-utf8 de_DE locale" do
        Yast::Encoding.SetUtf8Lang(false)
        Yast::Encoding.SetEncLang("de_DE")
        # "codepage=437" is default and thus omitted
        expect(described_class::VFAT.default_fstab_options).to eq ["iocharset=iso8859-15"]
      end
    end

    context "for special paths" do
      context "for root filesystems" do
        it "ext2 has the correct fstab options" do
          expect(described_class::EXT2.default_fstab_options("/")).to eq []
        end

        it "ext3 has the correct fstab options" do
          expect(described_class::EXT3.default_fstab_options("/")).to eq []
        end

        it "ext4 has the correct fstab options" do
          expect(described_class::EXT4.default_fstab_options("/")).to eq []
        end
      end

      context "for /boot or /boot/**" do
        it "vfat has the correct fstab options for a utf8 locale" do
          Yast::Encoding.SetUtf8Lang(true)
          Yast::Encoding.SetEncLang("de_DE")
          expect(described_class::VFAT.default_fstab_options("/boot")).to eq ["utf8", "dmask=0077"]
          expect(described_class::VFAT.default_fstab_options("/boot/efi")).to eq ["utf8",
                                                                                  "dmask=0077"]
          expect(described_class::VFAT.default_fstab_options("/boot/whatever")).to eq ["utf8",
                                                                                       "dmask=0077"]
        end

        it "vfat has the correct fstab options for a non-utf8 de_DE locale" do
          Yast::Encoding.SetUtf8Lang(false)
          Yast::Encoding.SetEncLang("de_DE")
          # "codepage=437" is default and thus omitted
          expect(described_class::VFAT.default_fstab_options("/boot/efi"))
            .to include("iocharset=iso8859-15")
        end
      end

      context "for /bootme" do
        it "vfat has the correct fstab options for a utf8 locale" do
          Yast::Encoding.SetUtf8Lang(true)
          Yast::Encoding.SetEncLang("de_DE")
          expect(described_class::VFAT.default_fstab_options("/bootme")).to eq ["utf8"]
        end

        it "vfat has the correct fstab options for a non-utf8 de_DE locale" do
          Yast::Encoding.SetUtf8Lang(false)
          Yast::Encoding.SetEncLang("de_DE")
          # "codepage=437" is default and thus omitted
          expect(described_class::VFAT.default_fstab_options("/bootme"))
            .to eq ["iocharset=iso8859-15"]
        end
      end
    end
  end

  describe "#label_valid_chars" do
    it "contains alphanumeric characters" do
      chars = Y2Storage::Filesystems::Type::EXT2.label_valid_chars
      expect(chars).to match(/ABCDEFG/)
      expect(chars).to match(/xyz/)
      expect(chars).to match(/789/)
    end

    it "contains some non-alphanumeric characters" do
      chars = Y2Storage::Filesystems::Type::EXT2.label_valid_chars
      expect(chars).to include("-")
      expect(chars).to include("_")
      expect(chars).to include(".")
    end

    it "does not contain any whitespace" do
      chars = Y2Storage::Filesystems::Type::EXT2.label_valid_chars
      expect(chars).not_to include(" ")
      expect(chars).not_to include("\t")
      expect(chars).not_to include("\n")
    end
  end

  describe ".windows_filesystems" do
    it "returns a list" do
      expect(described_class.windows_filesystems).to be_a(Array)
    end

    it "only includes ntfs, vfat and bitlocker" do
      expect(described_class.windows_filesystems.map(&:to_sym)).to contain_exactly(:ntfs, :vfat,
        :bitlocker)
    end
  end

  describe "#windows_ok?" do
    it "returns true for ntfs" do
      expect(described_class::NTFS.windows_ok?).to eq(true)
    end

    it "returns true for vfat" do
      expect(described_class::VFAT.windows_ok?).to eq(true)
    end

    it "returns true for bitlocker" do
      expect(described_class::BITLOCKER.windows_ok?).to eq(true)
    end

    it "returns false otherwise" do
      types = described_class.all.reject { |t| t.is?(:ntfs, :vfat, :bitlocker) }

      expect(types.map(&:windows_ok?)).to all(be(false))
    end
  end
end
