#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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
require_relative "../support/shared_setup"

require "y2storage"

describe Y2Storage::Region do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:region) { Y2Storage::Region.create(100, length, 1.KiB) }

  let(:length) { 1000 }

  describe "#==" do
    context "if both regions has a different block size" do
      let(:other) { Y2Storage::Region.create(100, 1000, 2.KiB) }

      # To ensure the exception is propagated by the bindings
      it "raises Storage::DifferentBlockSizes" do
        expect { region <=> other }.to raise_error Storage::DifferentBlockSizes
      end
    end

    context "if the right operand is not a region" do
      let(:other) { 2048 }

      it "raises TypeError" do
        expect { region <=> other }.to raise_error TypeError
      end
    end

    context "if both regions are equivalent" do
      let(:other) { Y2Storage::Region.create(100, 1000, 1.KiB) }

      it "returns true" do
        expect(region == other).to eq true
      end
    end

    context "if the start sector is different" do
      let(:other) { Y2Storage::Region.create(101, 1000, 1.KiB) }

      it "returns false" do
        expect(region == other).to eq false
      end
    end

    context "if the length is different" do
      let(:other) { Y2Storage::Region.create(100, 1001, 1.KiB) }

      it "returns false" do
        expect(region == other).to eq false
      end
    end
  end

  describe "#inside?" do
    context "if both regions have a different block size" do
      let(:other) { Y2Storage::Region.create(100, 1000, 2.KiB) }

      # Pending on exception binding in libstorage-ng.
      it "raises Storage::DifferentBlockSizes" do
        expect { region.inside?(other) }.to raise_error Storage::DifferentBlockSizes
      end
    end

    context "if the region is fully contained in the another one" do
      let(:other) { Y2Storage::Region.create(100, 1001, 1.KiB) }

      it "returns true" do
        expect(region.inside?(other)).to eq true
      end
    end

    context "if the region is not fully contained in the another one" do
      let(:other) { Y2Storage::Region.create(101, 1001, 1.KiB) }

      it "returns false" do
        expect(region.inside?(other)).to eq false
      end
    end
  end

  describe "#inspect" do
    it "produces an informative String" do
      expect(subject.inspect)
        .to eq "<Region range: 100 - 1099, block_size: 1 KiB>"
    end

    context "when the region is empty" do
      let(:length) { 0 }

      it "does not fail" do
        expect { subject.inspect }.to_not raise_error
      end

      it "produces an informative String with unknown end" do
        expect(subject.inspect)
          .to eq("<Region range: 100 - unknown, block_size: 1 KiB>")
      end
    end
  end

  describe "#size" do
    it "calculates the DiskSize of the region" do
      expect(subject.size).to be_a Y2Storage::DiskSize
      expect(subject.size.to_i).to eq 1_024_000
    end
  end

  describe "#cover?" do
    it "returns false for the last sector outside" do
      expect(subject.cover?(99)).to eq false
    end
    it "returns true for the first sector inside" do
      expect(subject.cover?(100)).to eq true
    end
    it "returns true for a sector inside" do
      expect(subject.cover?(500)).to eq true
    end
    it "returns true for the last sector inside" do
      expect(subject.cover?(1099)).to eq true
    end
    it "returns false for the first sector outside" do
      expect(subject.cover?(1100)).to eq false
    end
  end
end
