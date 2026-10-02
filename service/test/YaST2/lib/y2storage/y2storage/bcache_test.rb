#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2019] SUSE LLC
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

describe Y2Storage::Bcache do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  context "without any devicegraph" do
    describe ".supported?" do
      context "on x86_64" do
        let(:architecture) { :x86_64 }
        it "returns true (supported)" do
          expect(described_class.supported?).to be true
        end
      end

      context "on ppc" do
        let(:architecture) { :ppc }
        it "returns false (not supported)" do
          expect(described_class.supported?).to be false
        end
      end

      context "on aarch64" do
        let(:architecture) { :aarch64 }
        it "returns false (not supported)" do
          expect(described_class.supported?).to be false
        end
      end

      context "on s390" do
        let(:architecture) { :s390 }
        it "returns false (not supported)" do
          expect(described_class.supported?).to be false
        end
      end
    end
  end

  context "with a bcache in the probed devicegraph" do
    before do
      fake_scenario(scenario)
    end

    let(:scenario) { "bcache2.xml" }
    let(:bcache_name) { "/dev/bcache0" }

    subject(:bcache) { Y2Storage::Bcache.find_by_name(fake_devicegraph, bcache_name) }

    describe "#backing_device" do
      it "returns the backing device" do
        expect(subject.backing_device).to be_a(Y2Storage::BlkDevice)
        expect(subject.backing_device.basename).to eq("sdb2")
      end

      context "when it is a flash-only bcache" do
        let(:bcache_name) { "/dev/bcache1" }

        it "returns nil" do
          expect(subject.backing_device).to be_nil
        end
      end
    end

    describe "#bcache_cset" do
      context "when the bcache is using caching" do
        let(:bcache_name) { "/dev/bcache0" }

        it "returns the associated caching set" do
          expect(subject.bcache_cset).to be_a(Y2Storage::BcacheCset)
          expect(subject.bcache_cset.blk_devices.map(&:basename)).to contain_exactly("sdb1")
        end
      end

      context "when the bcache is not using caching" do
        before do
          sdb3 = fake_devicegraph.find_by_name("/dev/sdb3")
          sdb3.create_bcache("/dev/bcache99")
        end

        let(:bcache_name) { "/dev/bcache99" }

        it "returns nil" do
          expect(subject.bcache_cset).to be_nil
        end
      end

      context "when the bcache is flash-only" do
        let(:bcache_name) { "/dev/bcache1" }

        it "returns the caching set that holds it" do
          expect(subject.type).to eq(Y2Storage::BcacheType::FLASH_ONLY)

          expect(subject.bcache_cset).to be_a(Y2Storage::BcacheCset)
          expect(subject.bcache_cset.blk_devices.map(&:basename)).to contain_exactly("sdb1")
        end
      end
    end

    describe "#add_bcache_cset" do
      before do
        described_class.create(fake_devicegraph, bcache_name)
      end

      let(:bcache_name) { "/dev/bcache99" }

      let(:cset) { fake_devicegraph.bcache_csets.first }

      it "adds a caching set to bcache device" do
        expect(subject.bcache_cset).to be_nil

        subject.add_bcache_cset(cset)

        expect(subject.bcache_cset).to eq(cset)
      end

      context "when the bcache already has an associated caching set" do
        let(:bcache_name) { "/dev/bcache0" }

        it "raises an exception" do
          expect { subject.add_bcache_cset(cset) }.to raise_error(Storage::LogicException)
        end
      end

      context "when the bcache is flash-only" do
        let(:bcache_name) { "/dev/bcache1" }

        it "raises an exception" do
          expect { subject.add_bcache_cset(cset) }.to raise_error(Storage::LogicException)
        end
      end
    end

    describe "#remove_bcache_cset" do
      let(:bcache_name) { "/dev/bcache0" }

      it "removes the caching set" do
        expect(subject.bcache_cset).to_not be_nil

        subject.remove_bcache_cset

        expect(subject.bcache_cset).to be_nil
      end

      context "when the bcache has no caching set" do
        before do
          subject.remove_bcache_cset
        end

        it "raises an exception" do
          expect { subject.remove_bcache_cset }.to raise_error(Storage::LogicException)
        end
      end

      context "when the bcache is flash-only" do
        let(:bcache_name) { "/dev/bcache1" }

        it "raises an exception" do
          expect { subject.remove_bcache_cset }.to raise_error(Storage::LogicException)
        end
      end
    end

    describe ".find_free_name" do
      it "returns bcache name that is not used yet" do
        expect(fake_devicegraph.bcaches.map(&:name)).to_not(
          include(described_class.find_free_name(fake_devicegraph))
        )
      end
    end

    describe "#is?" do
      it "returns true for values whose symbol is :bcache" do
        expect(bcache.is?(:bcache)).to eq true
        expect(bcache.is?("bcache")).to eq true
      end

      it "returns false for a different string like \"Disk\"" do
        expect(bcache.is?("Disk")).to eq false
      end

      it "returns false for different device names like :partition or :filesystem" do
        expect(bcache.is?(:partition)).to eq false
        expect(bcache.is?(:filesystem)).to eq false
      end

      it "returns true for a list of names containing :bcache" do
        expect(bcache.is?(:bcache, :partition)).to eq true
      end

      it "returns false for a list of names not containing :bcache" do
        expect(bcache.is?(:filesystem, :partition)).to eq false
      end
    end

    describe "#flash_only?" do
      context "when the bcache is flash-only" do
        let(:bcache_name) { "/dev/bcache1" }

        it "returns true" do
          expect(subject.flash_only?).to eq(true)
        end
      end

      context "when the bcache is not flash-only" do
        let(:bcache_name) { "/dev/bcache0" }

        it "returns false" do
          expect(subject.flash_only?).to eq(false)
        end
      end
    end

    describe "#inspect" do
      context "when the bcache has an associated caching set" do
        let(:bcache_name) { "/dev/bcache0" }

        it "includes the caching set info" do
          expect(subject.inspect).to include("BcacheCset")
        end
      end

      context "when the bcache has no associated caching set" do
        before do
          sdb3 = fake_devicegraph.find_by_name("/dev/sdb3")
          sdb3.create_bcache(bcache_name)
        end

        let(:bcache_name) { "/dev/bcache99" }

        it "does not include the caching set info" do
          expect(subject.inspect).to_not include("BcacheCset")
          expect(subject.inspect).to include("without caching set")
        end
      end

      context "when the bcache is flash-only" do
        let(:bcache_name) { "/dev/bcache1" }

        it "includes the caching set info" do
          expect(subject.inspect).to include("BcacheCset")
        end

        it "includes the 'flash-only' mark" do
          expect(subject.inspect).to include("flash-only")
        end
      end
    end

    describe ".all" do
      it "returns a list of Y2Storage::Bcache objects" do
        bcaches = Y2Storage::Bcache.all(fake_devicegraph)
        expect(bcaches).to be_an Array
        expect(bcaches).to all(be_a(Y2Storage::Bcache))
      end

      it "includes all bcaches in the devicegraph and nothing else" do
        bcaches = Y2Storage::Bcache.all(fake_devicegraph)
        expect(bcaches.map(&:basename)).to contain_exactly(
          "bcache0", "bcache1", "bcache2"
        )
      end
    end
  end
end
