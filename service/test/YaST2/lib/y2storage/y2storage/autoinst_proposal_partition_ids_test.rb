#!/usr/bin/env rspec
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage"

# The AutoYaST proposal must not set the partition ids that the Agama proposal sets (ids from the
# Discoverable Partitions Specification, device mapper names of those partitions and ids of the
# partitions configured at boot mount points).
describe Y2Storage::AutoinstProposal do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:proposal) do
    described_class.new(
      partitioning: partitioning, proposal_settings: proposal_settings,
      devicegraph: fake_devicegraph, issues_list: issues_list
    )
  end

  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  let(:proposal_settings) do
    Y2Storage::ProposalSettings.new_for_current_product.tap { |s| s.bootloader = bootloader }
  end

  let(:bootloader) { Y2Storage::BootloaderType::GRUB2 }

  let(:efi) { true }

  let(:arch) do
    instance_double(Y2Storage::Arch, efiboot?: efi, x86?: true, ppc?: false, s390?: false)
  end

  let(:scenario) { "empty_hard_disk_gpt_50GiB" }

  let(:ids) { Y2Storage::PartitionId }

  # Profile partition (without id) for the given mount point
  def profile_partition(path, size = "1GiB")
    { "create" => true, "filesystem" => :ext4, "mount" => path, "size" => size }
  end

  let(:profile_paths) { ["/", "/home", "/var"] }

  let(:partitioning) do
    [
      {
        "device"     => "/dev/sda",
        "use"        => "all",
        "partitions" => profile_paths.map { |path| profile_partition(path) }
      }
    ]
  end

  # @return [Hash{String => Y2Storage::PartitionId}] id of the partitions by mount path
  def ids_by_path(devicegraph)
    devicegraph.partitions.map { |p| [p.filesystem&.mount_path, p.id] }.to_h
  end

  before do
    allow(Yast::Mode).to receive(:auto).and_return(true)
    fake_scenario(scenario)
    allow(Y2Storage::StorageManager.instance).to receive(:arch).and_return(arch)
    allow(Yast::Arch).to receive(:x86_64).and_return(true)
  end

  describe "#propose" do
    context "when the profile partitions have no id" do
      let(:profile_paths) { ["/", "/home", "/var", "/boot/efi"] }

      it "does not set the ids from the Discoverable Partitions Specification" do
        proposal.propose
        result = ids_by_path(proposal.devices)

        expect(result["/"]).to eq(ids::LINUX)
        expect(result["/home"]).to eq(ids::LINUX)
        expect(result["/var"]).to eq(ids::LINUX)
      end

      it "does not set the id of the partitions at boot mount points" do
        proposal.propose

        expect(ids_by_path(proposal.devices)["/boot/efi"]).to eq(ids::LINUX)
      end

      context "and the boot mount points are /boot and /efi" do
        let(:profile_paths) { ["/", "/boot", "/efi"] }
        let(:bootloader) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

        it "does not set the id of the partitions at boot mount points" do
          proposal.propose
          result = ids_by_path(proposal.devices)

          expect(result["/boot"]).to eq(ids::LINUX)
          expect(result["/efi"]).to eq(ids::LINUX)
        end
      end
    end

    context "when the boot partitions are not in the profile" do
      let(:profile_paths) { ["/", "/home"] }

      context "and the system boots with GRUB2 on EFI" do
        it "creates the ESP with the ESP id" do
          proposal.propose
          result = ids_by_path(proposal.devices)

          expect(result["/boot/efi"]).to eq(ids::ESP)
          expect(result["/"]).to eq(ids::LINUX)
          expect(result["/home"]).to eq(ids::LINUX)
        end
      end

      context "and the system boots with systemd-boot" do
        let(:bootloader) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

        it "creates the ESP with the ESP id" do
          proposal.propose
          result = ids_by_path(proposal.devices)

          expect(result["/boot"]).to eq(ids::ESP)
          expect(result["/"]).to eq(ids::LINUX)
        end
      end

      context "and the system boots with GRUB2 on BIOS and a GPT partition table" do
        let(:efi) { false }

        it "creates the BIOS boot partition with the BIOS boot id" do
          proposal.propose
          ids = proposal.devices.partitions.map(&:id)

          expect(ids).to include(Y2Storage::PartitionId::BIOS_BOOT)
        end
      end
    end

    # Behavior kept on purpose: the ESP is looked up by id, so a profile partition at /boot/efi without
    # id (it is a linux partition) is not recognized as the ESP by the BLS strategy.
    context "when the profile has /boot/efi without id and the bootloader is systemd-boot" do
      let(:profile_paths) { ["/", "/boot/efi"] }
      let(:bootloader) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      it "still proposes an extra ESP and keeps the id of the profile partition" do
        proposal.propose
        result = ids_by_path(proposal.devices)

        expect(result["/boot"]).to eq(ids::ESP)
        expect(result["/boot/efi"]).to eq(ids::LINUX)
      end
    end

    context "when the profile partitions are encrypted" do
      let(:profile_paths) { ["/", "/home", "swap"] }

      let(:partitioning) do
        [
          {
            "device"     => "/dev/sda",
            "use"        => "all",
            "partitions" => profile_paths.map do |path|
              profile_partition(path).merge("crypt_method" => :luks1, "crypt_key" => "12345")
            end
          }
        ]
      end

      it "does not use the device mapper names from the Discoverable Partitions Specification" do
        proposal.propose
        names = proposal.devices.encryptions.map(&:dm_table_name)

        expect(names).to contain_exactly("cr_root", "cr_home", "cr_swap")
      end
    end

    it "does not enable the assignment of the boot ids" do
      expect(Y2Storage::BootRequirementsChecker).to receive(:new).and_wrap_original do |original, *args, **kwargs|
        expect(kwargs).to_not include(:assign_boot_ids)
        original.call(*args, **kwargs)
      end

      proposal.propose
    end
  end
end
