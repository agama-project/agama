# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "./examples"
require "agama/storage/config_conversions/from_json_conversions/md_raid"
require "agama/storage/configs/md_raid"
require "y2storage/md_level"
require "y2storage/md_parity"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromJSONConversions::MdRaid do
  subject do
    described_class.new(md_raid_json)
  end

  describe "#convert" do
    let(:md_raid_json) do
      {
        name:       name,
        level:      level,
        parity:     parity,
        chunkSize:  chunk_size,
        devices:    devices,
        encryption: encryption,
        filesystem: filesystem,
        ptableType: ptable_type,
        partitions: partitions
      }
    end

    let(:name) { nil }
    let(:level) { nil }
    let(:parity) { nil }
    let(:chunk_size) { nil }
    let(:devices) { nil }
    let(:encryption) { nil }
    let(:filesystem) { nil }
    let(:ptable_type) { nil }
    let(:partitions) { nil }

    it "returns a MD RAID config" do
      md_raid = subject.convert
      expect(md_raid).to be_a(Agama::Storage::Configs::MdRaid)
    end

    context "if 'name' is not specified" do
      let(:name) { nil }

      it "does not set #name" do
        md_raid = subject.convert
        expect(md_raid.name).to be_nil
      end
    end

    context "if 'level' is not specified" do
      let(:level) { nil }

      it "does not set #level" do
        md_raid = subject.convert
        expect(md_raid.level).to be_nil
      end
    end

    context "if 'parity' is not specified" do
      let(:parity) { nil }

      it "does not set #parity" do
        md_raid = subject.convert
        expect(md_raid.parity).to be_nil
      end
    end

    context "if 'chunkSize' is not specified" do
      let(:chunk_size) { nil }

      it "does not set #chunk_size" do
        md_raid = subject.convert
        expect(md_raid.chunk_size).to be_nil
      end
    end

    context "if 'devices' is not specified" do
      let(:devices) { nil }

      it "does not set #devices" do
        md_raid = subject.convert
        expect(md_raid.devices).to be_nil
      end
    end

    include_examples "without encryption"
    include_examples "without filesystem"
    include_examples "without ptableType"
    include_examples "without partitions"

    context "if 'name' is specified" do
      let(:name) { "test" }

      it "sets #name to the expected value" do
        md_raid = subject.convert
        expect(md_raid.name).to eq("test")
      end
    end

    context "if 'level' is specified" do
      let(:level) { "raid1" }

      it "sets #level to the expected value" do
        md_raid = subject.convert
        expect(md_raid.level).to eq(Y2Storage::MdLevel::RAID1)
      end
    end

    context "if 'parity' is specified" do
      let(:parity) { "left_asymmetric" }

      it "sets #parity to the expected value" do
        md_raid = subject.convert
        expect(md_raid.parity).to eq(Y2Storage::MdParity::LEFT_ASYMMETRIC)
      end
    end

    context "if 'chunkSize' is specified" do
      context "if 'chunkSize' is a string" do
        let(:chunk_size) { "4 KiB" }

        it "sets #chunk_size to the expected value" do
          md_raid = subject.convert
          expect(md_raid.chunk_size).to eq(4.KiB)
        end
      end

      context "if 'chunkSize' is a number" do
        let(:chunk_size) { 4096 }

        it "sets #chunk_size to the expected value" do
          chunk_size = subject.convert
          expect(chunk_size.chunk_size).to eq(4.KiB)
        end
      end
    end

    context "if 'devices' is specified" do
      context "with an empty list" do
        let(:devices) { [] }

        it "sets #devices to the expected value" do
          md_raid = subject.convert
          expect(md_raid.devices).to eq([])
        end
      end

      context "with a list of aliases" do
        let(:devices) { ["system", "home"] }

        it "sets #devices to the expected value" do
          md_raid = subject.convert
          expect(md_raid.devices).to contain_exactly("system", "home")
        end
      end
    end

    include_examples "with encryption"
    include_examples "with filesystem"
    include_examples "with ptableType"
    include_examples "with partitions"
  end
end
