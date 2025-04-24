# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require_relative "../../../test_helper"
require "agama/storage/config"
require "agama/storage/config_conversions/from_json"
require "y2storage/encryption_method"

describe Agama::Storage::ConfigConversions::FromJSON do
  subject do
    described_class.new(config_json, default_paths: default_paths, mandatory_paths: mandatory_paths)
  end

  let(:default_paths) { [] }

  let(:mandatory_paths) { [] }

  describe "#convert" do
    let(:config_json) { {} }

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)
    end

    shared_examples "with generate" do |configs_proc|
      context "with 'default' value" do
        let(:generate) { "default" }

        let(:default_paths) { ["/default1", "/default2"] }

        it "adds volumes for the default paths" do
          configs = configs_proc.call(subject.convert)

          default1 = configs.find { |c| c.filesystem.path == "/default1" }
          expect(default1).to_not be_nil
          expect(default1.encryption).to be_nil

          default2 = configs.find { |c| c.filesystem.path == "/default2" }
          expect(default2).to_not be_nil
          expect(default2.encryption).to be_nil
        end
      end

      context "with 'mandatory' value" do
        let(:generate) { "mandatory" }

        let(:mandatory_paths) { ["/mandatory1"] }

        it "adds volumes for the mandatory paths" do
          configs = configs_proc.call(subject.convert)

          mandatory1 = configs.find { |c| c.filesystem.path == "/mandatory1" }
          expect(mandatory1).to_not be_nil
          expect(mandatory1.encryption).to be_nil
        end
      end
    end

    context "generating partitions" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }

      let(:volume_groups) { [] }

      let(:default_paths) { ["/", "swap", "/home"] }

      let(:mandatory_paths) { ["/", "swap"] }

      context "if a partition specifies 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: generate }
              ]
            }
          ]
        end

        partitions_proc = proc { |c| c.drives.first.partitions }
        include_examples "with generate", partitions_proc

        context "with a generate section" do
          let(:generate) do
            {
              partitions: "default",
              encryption: {
                luks2: { password: "12345" }
              }
            }
          end

          let(:default_paths) { ["/", "swap"] }

          it "adds the expected partitions" do
            partitions = partitions_proc.call(subject.convert)
            expect(partitions.size).to eq(2)

            root_part = partitions.find { |p| p.filesystem.path == "/" }
            swap_part = partitions.find { |p| p.filesystem.path == "swap" }

            expect(root_part).to_not be_nil
            expect(root_part.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(root_part.encryption.password).to eq("12345")

            expect(swap_part).to_not be_nil
            expect(swap_part.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(swap_part.encryption.password).to eq("12345")
          end
        end
      end

      context "if the device already specifies any of the partitions" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(3)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          home_part = partitions.find { |p| p.filesystem.path == "/home" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
          expect(home_part).to_not be_nil
        end
      end

      context "if other device already specifies any of the partitions" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "default" }
              ]
            },
            {
              partitions: [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(2)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
        end
      end

      context "if a volume group already specifies any of the paths" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(1)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          expect(root_part).to_not be_nil
        end
      end

      context "if the device specifies several partitions with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds partitions for the first 'generate'" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(2)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
        end
      end

      context "if several devices specify partitions with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            },
            {
              partitions: [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds partitions to the first device with a 'generate'" do
          config = subject.convert
          drive1, drive2 = config.drives
          expect(drive1.partitions.size).to eq(2)
          expect(drive2.partitions.size).to eq(0)
        end
      end
    end

    context "generating logical volumes" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }

      let(:volume_groups) { [] }

      let(:default_paths) { ["/", "swap", "/home"] }

      let(:mandatory_paths) { ["/", "swap"] }

      context "if a logical volume specifies 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: generate }
              ]
            }
          ]
        end

        logical_volumes_proc = proc { |c| c.volume_groups.first.logical_volumes }
        include_examples "with generate", logical_volumes_proc

        context "with a generate section" do
          let(:generate) do
            {
              logicalVolumes: "default",
              encryption:     {
                luks2: { password: "12345" }
              },
              stripes:        8,
              stripeSize:     "16 KiB"
            }
          end

          let(:default_paths) { ["/", "swap"] }

          it "adds the expected logical volumes" do
            lvs = logical_volumes_proc.call(subject.convert)
            expect(lvs.size).to eq(2)

            root_lv = lvs.find { |v| v.filesystem.path == "/" }
            swap_lv = lvs.find { |v| v.filesystem.path == "swap" }

            expect(root_lv).to_not be_nil
            expect(root_lv.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(root_lv.encryption.password).to eq("12345")

            expect(swap_lv).to_not be_nil
            expect(swap_lv.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
            expect(swap_lv.encryption.password).to eq("12345")
          end
        end
      end

      context "if the volume group already specifies any of the logical volumes" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(3)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          home_lv = lvs.find { |v| v.filesystem.path == "/home" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
          expect(home_lv).to_not be_nil
        end
      end

      context "if other volume group already specifies any of the logical volumes" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            },
            {
              logicalVolumes: [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(2)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
        end
      end

      context "if a device already specifies a partition for any of the paths" do
        let(:drives) do
          [
            {
              partitions: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(1)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          expect(root_lv).to_not be_nil
        end
      end

      context "if the volume group specifies several logical volumes with 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds logical volumes for the first 'generate'" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(2)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
        end
      end

      context "if several volume groups specify logical volumes with 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            },
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds logical volumes to the first volume group with a 'generate'" do
          config = subject.convert
          vg1, vg2 = config.volume_groups
          expect(vg1.logical_volumes.size).to eq(2)
          expect(vg2.logical_volumes.size).to eq(0)
        end
      end

      context "if a drive specifies a partition with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        it "does not add logical volumes to the volume group" do
          config = subject.convert
          vg = config.volume_groups.first
          expect(vg.logical_volumes.size).to eq(0)
        end
      end
    end
  end
end
