#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2022] SUSE LLC
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
require "y2storage/setup_checker"

describe Y2Storage::SetupChecker do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)

    allow(Yast::SCR).to receive(:Read)
    # Let's assume 8 GiB of RAM
    allow(Yast::SCR).to receive(:Read).with(path(".proc.meminfo"))
      .and_return("memtotal" => 8388608)
  end

  let(:scenario) { "empty_hard_disk_gpt_50GiB" }

  let(:disk) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sda") }

  def create_root
    root = disk.partition_table.create_partition("/dev/sda2",
      Y2Storage::Region.create(1050624, 33554432, 512),
      Y2Storage::PartitionType::PRIMARY)
    root.size = 15.GiB
    fs = root.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
    fs.mount_path = "/"
  end

  subject { described_class.new(fake_devicegraph) }

  before do
    allow(Y2Storage::BootRequirementsChecker).to receive(:new).and_return(boot_checker)
    allow(boot_checker).to receive(:warnings).and_return(boot_warnings)
    allow(boot_checker).to receive(:errors).and_return(boot_errors)

    allow(Y2Storage::ProposalSettings).to receive(:new_for_current_product).and_return(settings)
    allow(settings).to receive(:volumes).and_return(product_volumes)
    allow(settings).to receive(:bootloader).and_return(Y2Storage::BootloaderType::GRUB2)

    # We have to use allow_any_instance due to the nature of libstorage-ng bindings (they return
    # a different object for each query to the devicegraph)
    allow_any_instance_of(Y2Storage::Filesystems::BlkFilesystem).to receive(:missing_mount_options)
      .and_return(missing_root_opts)

    allow(subject).to receive(:security_policy).and_return(policy)
    allow(subject).to receive(:security_policy_failing_rules).and_return(policy_failing_rules)
  end

  let(:boot_checker) { instance_double(Y2Storage::BootRequirementsChecker) }

  let(:settings) { instance_double(Y2Storage::ProposalSettings) }

  let(:boot_warnings) { [] }

  let(:boot_errors) { [] }

  let(:product_volumes) { [] }

  let(:missing_root_opts) { [] }

  let(:boot_error) { instance_double(Y2Storage::SetupError) }

  let(:root_volume) do
    volume = Y2Storage::VolumeSpecification.new({})
    volume.mount_point = "/"
    volume.min_size = 10.GiB
    volume.fs_types = Y2Storage::Filesystems::Type.root_filesystems
    volume.proposed = true
    volume.proposed_configurable = false
    volume
  end

  let(:swap_volume) do
    volume = Y2Storage::VolumeSpecification.new({})
    volume.mount_point = "swap"
    volume.min_size = 4.GiB
    volume.partition_id = Y2Storage::PartitionId::SWAP
    volume.fs_types = [Y2Storage::Filesystems::Type::SWAP]
    volume.proposed = true
    volume.proposed_configurable = false
    volume
  end

  let(:home_volume) do
    volume = Y2Storage::VolumeSpecification.new({})
    volume.mount_point = "/home"
    volume.min_size = 10.GiB
    volume.partition_id = Y2Storage::PartitionId::LINUX
    volume.fs_types = Y2Storage::Filesystems::Type.home_filesystems
    volume.proposed = true
    volume.proposed_configurable = true
    volume
  end

  let(:policy) { nil }
  let(:policy_failing_rules) { [] }

  describe "#valid?" do
    context "if there is any boot error" do
      let(:boot_errors) { [boot_error] }

      it "returns false" do
        expect(subject.valid?).to eq(false)
      end
    end

    context "if there are no boot errors" do
      let(:boot_errors) { [] }

      context "but there is any boot warning" do
        let(:boot_warnings) { [boot_error] }

        it "returns false" do
          expect(subject.valid?).to eq(false)
        end
      end

      context "but there is any warning because a missing product volume" do
        let(:product_volumes) { [root_volume] }

        it "returns false" do
          expect(subject.valid?).to eq(false)
        end
      end

      context "but there is any warning because the mount options" do
        before do
          create_root
        end

        let(:missing_root_opts) { ["_netdev"] }

        it "returns false" do
          expect(subject.valid?).to eq(false)
        end
      end

      context "but there is any warning because failing security policy rules" do
        before do
          allow(Yast::Mode).to receive(:installation).and_return(true)
        end

        let(:policy) { double("Y2Security::SecurityPolicies::DisaStigPolicy", name: "STIG") }

        let(:policy_failing_rules) do
          [
            double("Y2Security::SecurityPolicies::Rule",
              id:          "Test1",
              identifiers: [],
              references:  [],
              description: "policy rule 1")
          ]
        end

        it "returns false" do
          expect(subject.valid?).to eq(false)
        end
      end

      context "and there are no warnings" do
        it "returns true" do
          expect(subject.valid?).to eq(true)
        end
      end
    end
  end

  describe "#errors" do
    before do
      create_root
    end

    let(:boot_errors) do
      [
        instance_double(Y2Storage::SetupError),
        instance_double(Y2Storage::SetupError)
      ]
    end

    let(:boot_warnings) { [instance_double(Y2Storage::SetupError)] }

    # Mandatory swap is missing
    let(:product_volumes) { [root_volume, swap_volume] }

    let(:missing_root_opts) { ["_netdev"] }

    let(:policy) { double("Y2Security::SecurityPolicies::DisaStigPolicy", name: "STIG") }

    let(:policy_failing_rules) do
      [
        double("Y2Security::SecurityPolicies::Rule",
          id:          "Test1",
          identifiers: [],
          references:  [],
          description: "policy rule 1")
      ]
    end

    it "only includes boot errors" do
      expect(subject.errors).to contain_exactly(*boot_errors)
    end
  end

  describe "#warnings" do
    let(:boot_warnings) do
      [
        instance_double(Y2Storage::SetupError),
        instance_double(Y2Storage::SetupError)
      ]
    end

    let(:boot_errors) { [instance_double(Y2Storage::SetupError)] }

    let(:product_volumes) { [root_volume, swap_volume, home_volume] }

    let(:policy_failing_rules) { [] }

    it "includes all boot warnings" do
      expect(subject.warnings).to include(*boot_warnings)
    end

    it "does not include boot errors" do
      expect(subject.warnings).to_not include(*boot_errors)
    end

    it "does not include errors for missing optional product volumes" do
      expect(subject.warnings)
        .to_not include(an_object_having_attributes(missing_volume: home_volume))
    end

    it "includes an error for each missing mandatory product volume" do
      expect(subject.warnings).to include(an_object_having_attributes(missing_volume: root_volume))
      expect(subject.warnings).to include(an_object_having_attributes(missing_volume: swap_volume))
    end

    context "when a mandatory product volume is present in the system" do
      before do
        create_root
      end

      it "does not include an error for that volume" do
        expect(subject.warnings)
          .to_not include(an_object_having_attributes(missing_volume: root_volume))
      end
    end

    context "when a mount option is missing for some mount point" do
      before { create_root }
      let(:boot_warnings) { [] }
      let(:missing_root_opts) { ["_netdev"] }

      it "includes an error mentioning the missing option" do
        expect(subject.warnings.map(&:message)).to include(an_object_matching(/_netdev/))
      end
    end

    context "when there are failing rules for the enabled security policy" do
      before do
        allow(Yast::Mode).to receive(:installation).and_return(true)
      end

      let(:boot_warnings) { [] }

      let(:policy) { double("Y2Security::SecurityPolicies::DisaStigPolicy", name: "STIG") }

      let(:policy_failing_rules) do
        [
          double("Y2Security::SecurityPolicies::Rule",
            id:          "test1",
            identifiers: [],
            references:  [],
            description: "policy rule 1"),
          double("Y2Security::SecurityPolicies::Rule",
            id:          "test2",
            identifiers: [],
            references:  [],
            description: "policy rule 2")
        ]
      end

      it "includes an error for each policy issue" do
        expect(subject.warnings.map(&:message)).to include(
          an_object_matching(/policy rule 1/),
          an_object_matching(/policy rule 2/)
        )
      end
    end

    context "when there is no warnings" do
      let(:boot_warnings) { [] }
      let(:product_volumes) { [root_volume, home_volume] }

      before do
        create_root
      end

      it "returns an empty list" do
        expect(subject.warnings).to be_empty
      end
    end
  end

  describe "#boot_warnings" do
    let(:boot_error1) { instance_double(Y2Storage::SetupError) }
    let(:boot_error2) { instance_double(Y2Storage::SetupError) }
    let(:boot_warnings) { [boot_error1, boot_error2] }

    let(:product_volumes) { [root_volume, swap_volume, home_volume] }

    it "includes all boot errors" do
      expect(subject.boot_warnings).to contain_exactly(boot_error1, boot_error2)
    end

    context "when there is no boot error" do
      let(:boot_warnings) { [] }

      it "returns an empty list" do
        expect(subject.boot_warnings).to be_empty
      end
    end
  end

  describe "#product_warnings" do
    let(:boot_error1) { instance_double(Y2Storage::SetupError) }
    let(:boot_error2) { instance_double(Y2Storage::SetupError) }
    let(:boot_warnings) { [boot_error1, boot_error2] }

    let(:product_volumes) { [root_volume, swap_volume, home_volume] }

    it "returns a list of setup errors" do
      expect(subject.product_warnings).to all(be_a(Y2Storage::SetupError))
    end

    it "does not include boot errors" do
      expect(subject.product_warnings).to_not include(boot_error1, boot_error2)
    end

    it "does not include an error for optional product volumes" do
      expect(subject.product_warnings)
        .to_not include(an_object_having_attributes(missing_volume: home_volume))
    end

    it "includes an error for each mandatory product volume not present in the system" do
      expect(subject.product_warnings).to include(
        an_object_having_attributes(missing_volume: root_volume)
      )
      expect(subject.product_warnings).to include(
        an_object_having_attributes(missing_volume: swap_volume)
      )
    end

    context "when a mandatory product volume is present in the system" do
      before do
        create_root
      end

      it "does not include an error for that volume" do
        expect(subject.product_warnings)
          .to_not include(an_object_having_attributes(missing_volume: root_volume))
      end
    end

    context "when a mandatory product volume is mounted as NFS" do
      before do
        fs = Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "server", "/path")
        fs.mount_path = "/"
      end

      it "does not include an error for that volume" do
        expect(subject.product_warnings)
          .to_not include(an_object_having_attributes(missing_volume: root_volume))
      end
    end

    context "when all mandatory product volumes are present in the system" do
      let(:product_volumes) { [root_volume, home_volume] }

      before do
        create_root
      end

      it "returns an empty list" do
        expect(subject.product_warnings).to be_empty
      end
    end

    # Regression test
    context "when old settings format is used" do
      let(:product_volumes) { nil }

      it "returns an empty list" do
        expect(subject.product_warnings).to be_empty
      end
    end
  end

  describe "#mount_warnings" do
    before { create_root }

    let(:boot_error1) { instance_double(Y2Storage::SetupError) }
    let(:boot_error2) { instance_double(Y2Storage::SetupError) }
    let(:boot_warnings) { [boot_error1, boot_error2] }

    context "if there are no missing mount options" do
      let(:missing_root_opts) { [] }

      it "returns an empty list" do
        expect(subject.mount_warnings).to be_empty
      end
    end

    context "if there is a missing mount option for a given mount point" do
      let(:missing_root_opts) { ["extra_option"] }

      it "returns a list of setup errors" do
        expect(subject.product_warnings).to all(be_a(Y2Storage::SetupError))
      end

      it "does not include boot errors" do
        expect(subject.product_warnings).to_not include(boot_error1, boot_error2)
      end

      it "includes an error for the affected mount point and missing option" do
        warning = subject.mount_warnings.first
        expect(warning.message).to include "/"
        expect(warning.message).to include "extra_option"
      end
    end

    context "if there are several missing mount options for the same mount point" do
      let(:missing_root_opts) { ["one", "two"] }

      it "returns a list of setup errors" do
        expect(subject.product_warnings).to all(be_a(Y2Storage::SetupError))
      end

      it "does not include boot errors" do
        expect(subject.product_warnings).to_not include(boot_error1, boot_error2)
      end

      it "includes an error for the affected mount point with all the missing options" do
        warning = subject.mount_warnings.first
        expect(warning.message).to include "/"
        expect(warning.message).to include "one,two"
      end
    end
  end

  describe "#security_policy_failing_rules" do
    before do
      allow(subject).to receive(:security_policy_failing_rules).and_call_original
    end

    context "when y2security cannot be required" do
      before do
        allow(subject).to receive(:require).with("y2security/security_policies")
          .and_raise(LoadError)
      end

      it "returns an empty list" do
        expect(subject.security_policy_failing_rules).to eq([])
      end
    end

    context "when y2security can be required" do
      before do
        allow(subject).to receive(:with_security_policies).and_return(policy_failing_rules)
      end

      context "and there are no failing rules for the policies" do
        let(:policy_failing_rules) { [] }

        it "returns an empty list" do
          expect(subject.security_policy_failing_rules).to eq([])
        end
      end

      context "and there are failing rules for some policy" do
        let(:policy) { double("Y2Security::SecurityPolicies::DisaStigPolicy", name: "STIG") }

        let(:policy_failing_rules) do
          [
            double("Y2Security::SecurityPolicies::Rule",
              id:          "test1",
              identifiers: [],
              references:  [],
              description: "policy rule 1"),
            double("Y2Security::SecurityPolicies::Rule",
              id:          "test2",
              identifiers: [],
              references:  [],
              description: "policy rule 2")
          ]
        end

        context "and the mode is not installation" do
          before do
            allow(Yast::Mode).to receive(:installation).and_return(false)
          end

          it "returns an empty list" do
            expect(subject.security_policy_failing_rules).to eq([])
          end
        end

        context "and the mode is installation" do
          before do
            allow(Yast::Mode).to receive(:installation).and_return(true)
          end

          it "returns a list with the failing rules of the enabled policy" do
            failing_rules = subject.security_policy_failing_rules
            expect(failing_rules.map(&:description)).to include(
              an_object_matching(/policy rule 1/),
              an_object_matching(/policy rule 2/)
            )
          end
        end
      end
    end
  end
end
