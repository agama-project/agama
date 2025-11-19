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

require_relative "./storage_helpers"
require_relative "./product_config_context"
require "agama/storage/configurator"
require "agama/storage/proposal"
require "y2storage"

describe Agama::Storage::Configurator do
  include Agama::RSpec::StorageHelpers

  include_context "product config"

  subject { described_class.new(proposal) }

  let(:proposal) { Agama::Storage::Proposal.new(product_config) }

  let(:volume_templates) do
    [
      {
        "mount_path" => "/",
        "filesystem" => "btrfs",
        "size"       => {
          "min" => min,
          "max" => max
        },
        "outline"    => {
          "filesystems" => ["btrfs", "xfs"]
        }
      }
    ]
  end

  let(:space_policy) { "delete" }
  let(:min) { "500 GiB" }
  let(:max) { "500 GiB" }

  let(:scenario) { "sizes.yaml" }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::BootRequirementsStrategies::Analyzer)
      .to receive(:bls_bootloader_proposed?).and_return(false)
  end

  describe "#configure" do
    context "if a config is given" do
      let(:storage_json) do
        {
          storage: {
            drives: [
              {
                search:     "/dev/vda",
                partitions: [
                  { generate: "default" }
                ]
              }
            ]
          }
        }
      end

      it "calculates a proposal with the given config" do
        expect(proposal).to receive(:calculate_from_json).once.with(storage_json).and_call_original
        subject.configure(storage_json)
      end
    end

    context "if no config is given" do
      let(:vda) { devicegraph.find_by_name("/dev/vda") }
      let(:vdb) { devicegraph.find_by_name("/dev/vdb") }
      let(:md0) { devicegraph.find_by_name("/dev/md0") }
      let(:md1) { devicegraph.find_by_name("/dev/md1") }
      let(:md2) { devicegraph.find_by_name("/dev/md2") }

      let(:analyzer) { Y2Storage::StorageManager.instance.probed_disk_analyzer }

      before do
        allow(devicegraph).to receive(:disk_devices).and_return([vda, vdb])
        allow(devicegraph).to receive(:software_raids).and_return([md0, md1, md2])
        allow(analyzer).to receive(:supports_boot_partitions?) { |d| d.name != "/dev/md1" }
      end

      def expect_calculated(device)
        storage_json = proposal.default_storage_json(device)
        expect(proposal)
          .to receive(:calculate_from_json).with(storage_json).ordered.and_call_original
      end

      def expect_not_calculated(device)
        storage_json = proposal.default_storage_json(device)
        expect(proposal).to_not receive(:calculate_from_json).with(storage_json)
      end

      it "calculates a proposal using drives and not considering software RAIDs" do
        expect_calculated(vda)
        expect_calculated(vdb)
        # Repeats the first config if everything fails.
        expect_calculated(vda)
        expect_not_calculated(md0)
        expect_not_calculated(md1)
        expect_not_calculated(md2)
        subject.configure
      end

      context "if there are removable devices" do
        before do
          allow(vda).to receive(:usb?).and_return(true)
        end

        it "calculates a proposal using the removable devices as last resort" do
          expect_calculated(vdb)
          expect_calculated(vda)
          # Repeats the first config if everything fails.
          expect_calculated(vdb)
          expect_not_calculated(md0)
          expect_not_calculated(md1)
          expect_not_calculated(md2)
          subject.configure
        end
      end

      context "if there are BOSS devices" do
        before do
          allow(vdb).to receive(:boss?).and_return(true)
        end

        it "calculates a proposal only for the BOSS devices" do
          expect_calculated(vdb)
          expect_not_calculated(vda)
          expect_not_calculated(md0)
          expect_not_calculated(md1)
          expect_not_calculated(md2)
          subject.configure
        end
      end

      context "if there is a successful config" do
        let(:min) { "50 GiB" }
        let(:max) { "50 GiB" }

        it "does not calculate a proposal for the rest of configs" do
          expect_calculated(vda)
          expect_not_calculated(vdb)
          expect_not_calculated(md0)
          expect_not_calculated(md1)
          expect_not_calculated(md2)
          subject.configure
        end
      end
    end
  end
end
