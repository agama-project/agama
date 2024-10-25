# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions"
require "y2storage"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  using Y2Storage::Refinements::SizeCasts
  include Agama::RSpec::StorageHelpers

  subject(:proposal) do
    described_class.new(config, issues_list: issues_list)
  end

  let(:config) { config_from_json }

  let(:config_from_json) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  let(:issues_list) { [] }

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  let(:scenario) { "disks.yaml" }

  describe "#propose" do
    context "when searching several disks at once and using them as LVM targetDevices" do
      let(:config_json) do
        {
          drives:       [
            { search: { max: 2 }, alias: "first-two" }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [
                { generate: { targetDevices: ["first-two"] } }
              ],
              logicalVolumes:  [
                {
                  name:       "root",
                  size:       "55 GiB",
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "extends the LVM over all the chosen disks if needed" do
        devicegraph = proposal.propose

        system = devicegraph.find_by_name("/dev/system")
        expect(system.lvm_pvs.map { |pv| pv.blk_device.partitionable.name })
          .to contain_exactly("/dev/vda", "/dev/vdb")
      end
    end

    context "when searching several disks at once and using them as LVM PVs" do
      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                { search: "/dev/vda1" },
                { search: "*", alias: "rest" }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: ["rest"],
              logicalVolumes:  [
                {
                  name:       "root",
                  size:       "10 GiB",
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "uses all the disks as physical volumes" do
        probed = Y2Storage::StorageManager.instance.probed
        vda2_sid = probed.find_by_name("/dev/vda2").sid
        vda3_sid = probed.find_by_name("/dev/vda3").sid

        devicegraph = proposal.propose

        system = devicegraph.find_by_name("/dev/system")
        expect(system.lvm_pvs.map(&:blk_device).map(&:sid)).to contain_exactly(vda2_sid, vda3_sid)
      end
    end

    context "when marking several partitions for resizing" do
      let(:config_json) do
        {
          boot:   { configure: false },
          drives: [
            {
              search:     disk_name,
              partitions: [
                { search: search, size: { min: 0, max: "current" } },
                { size: "25 GiB", filesystem: { path: "/" } }
              ]
            }
          ]
        }
      end

      before do
        allow_any_instance_of(Y2Storage::Partition)
          .to(receive(:detect_resize_info))
          .and_return(resize_info)
      end

      let(:resize_info) do
        instance_double(
          Y2Storage::ResizeInfo, resize_ok?: true,
          min_size: Y2Storage::DiskSize::GiB(4), max_size: Y2Storage::DiskSize::GiB(35)
        )
      end

      shared_examples "resize" do
        it "resizes several partitions if needed" do
          probed = Y2Storage::StorageManager.instance.probed
          vda2_size = probed.find_by_name("/dev/vda2").size
          vda3_size = probed.find_by_name("/dev/vda3").size

          devicegraph = proposal.propose

          expect(devicegraph.find_by_name("/dev/vda2").size).to be < vda2_size
          expect(devicegraph.find_by_name("/dev/vda3").size).to be < vda3_size
        end
      end

      context "using an empty search to match the partitions" do
        let(:search) { {} }

        context "if there are several partitions at the disk" do
          let(:disk_name) { "/dev/vda" }

          include_examples "resize"
        end

        context "if there are no partitions in the disk" do
          let(:disk_name) { "/dev/vdc" }

          it "register an error and returns nil" do
            expect(proposal.propose).to be_nil
            expect(proposal.issues_list).to include an_object_having_attributes(
              description: /mandatory partition/,
              severity:    Agama::Issue::Severity::ERROR
            )
          end
        end
      end

      context "using asterisk as the search to match the partitions" do
        let(:search) { "*" }

        context "if there are several partitions at the disk" do
          let(:disk_name) { "/dev/vda" }

          include_examples "resize"
        end

        context "if there are no partitions in the disk" do
          let(:disk_name) { "/dev/vdc" }

          it "processes the proposal" do
            devicegraph = proposal.propose
            disk = devicegraph.find_by_name(disk_name)
            expect(disk.partitions.size).to eq 1
          end

          it "does not include any issue about non-existent partitions" do
            proposal.propose
            expect(proposal.issues_list).to be_empty
          end
        end
      end
    end
  end
end
