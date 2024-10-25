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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/device_settings"
require "agama/storage/config_reader"
require "y2storage"

describe Agama::Storage::ConfigReader do
  let(:agama_config) { Agama::Config.new(config_data) }

  subject { described_class.new(agama_config) }

  describe "#read" do
    let(:lvm) { false }
    let(:space_policy) { "delete" }
    let(:config_data) do
      {
        "storage" => {
          "lvm"              => lvm,
          "space_policy"     => space_policy,
          "encryption"       => {
            "method"        => "luks2",
            "pbkd_function" => "argon2id"
          },
          "volumes"          => ["/", "swap"],
          "volume_templates" => [
            {
              "mount_path" => "/",
              "outline"    => { "required" => true }
            },
            {
              "mount_path" => "/home",
              "outline"    => { "required" => false }
            },
            {
              "mount_path" => "swap",
              "outline"    => { "required" => false }
            }
          ]
        }
      }
    end

    it "generates the corresponding storage configuration" do
      config = subject.read
      expect(config).to be_a(Agama::Storage::Config)
      expect(config.drives.size).to eq 1
    end

    context "if lvm is disabled" do
      let(:lvm) { false }

      it "applies the space policy to the first drive and places the default volumes there" do
        config = subject.read
        expect(config.drives.size).to eq 1

        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            search: an_instance_of(Agama::Storage::Configs::Search), filesystem: nil
          ),
          an_object_having_attributes(
            search: nil, filesystem: an_object_having_attributes(path: "/")
          ),
          an_object_having_attributes(
            search: nil, filesystem: an_object_having_attributes(path: "swap")
          )
        )
      end
    end

    context "if lvm is enabled" do
      let(:lvm) { true }

      it "applies the space policy to the first drive" do
        config = subject.read
        expect(config.drives.size).to eq 1

        partitions = config.drives.first.partitions
        expect(partitions.size).to eq 1
        partition = partitions.first
        expect(partition.search).to be_a Agama::Storage::Configs::Search
      end

      it "places the default volumes at a new LVM over the first disk" do
        config = subject.read
        expect(config.volume_groups.size).to eq 1
        vg = config.volume_groups.first
        disk_alias = config.drives.first.alias
        expect(vg.physical_volumes_devices).to contain_exactly disk_alias

        expect(vg.logical_volumes).to contain_exactly(
          an_object_having_attributes(filesystem: an_object_having_attributes(path: "/")),
          an_object_having_attributes(filesystem: an_object_having_attributes(path: "swap"))
        )
      end
    end

    context "if the space policy is unknown" do
      let(:space_policy) { nil }

      it "generates no partitition config to match existing partitions" do
        config = subject.read
        partitions = config.drives.first.partitions
        expect(partitions).to_not include(
          an_object_having_attributes(search: an_instance_of(Agama::Storage::Configs::Search))
        )
      end
    end

    context "if the space policy is 'keep'" do
      let(:space_policy) { "keep" }

      it "generates no partitition config to match existing partitions" do
        config = subject.read
        partitions = config.drives.first.partitions
        expect(partitions).to_not include(
          an_object_having_attributes(search: an_instance_of(Agama::Storage::Configs::Search))
        )
      end
    end

    context "if the space policy is 'delete'" do
      let(:space_policy) { "delete" }

      it "generates a partitition config to delete existing partitions" do
        config = subject.read
        partitions = config.drives.first.partitions
        expect(partitions).to include(
          an_object_having_attributes(search: an_instance_of(Agama::Storage::Configs::Search))
        )

        search_part = partitions.find(&:search)
        expect(search_part.delete).to eq true
        expect(search_part.search.name).to be_nil
        expect(search_part.search.if_not_found).to eq :skip
      end
    end

    context "if the space policy is 'resize'" do
      let(:space_policy) { "resize" }

      it "generates a partitition config to shrink existing partitions" do
        config = subject.read
        partitions = config.drives.first.partitions
        expect(partitions).to include(
          an_object_having_attributes(search: an_instance_of(Agama::Storage::Configs::Search))
        )

        search_part = partitions.find(&:search)
        expect(search_part.delete).to eq false
        expect(search_part.size).to have_attributes(
          default: false, min: Y2Storage::DiskSize.zero, max: nil
        )
        expect(search_part.search.name).to be_nil
        expect(search_part.search.if_not_found).to eq :skip
      end
    end
  end
end
