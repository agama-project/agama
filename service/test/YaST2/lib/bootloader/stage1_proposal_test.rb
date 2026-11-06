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

# NOTE: this file has no upstream test at all, so this spec was written from scratch while
# vendoring, based on reading the real source (see service/YaST2/README.md). Rather than
# exercising the real devicegraph-dependent logic end to end (which largely duplicates what
# stage1_test.rb/boot_storage_test.rb already cover for the collaborators involved), these specs
# mock Yast::BootStorage and the stage1 object directly, focusing on Stage1Proposal's own
# architecture-dispatch and decision logic.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/stage1_proposal"

describe Bootloader::Stage1Proposal do
  include_context "yast2-bootloader test setup"

  describe ".propose" do
    let(:stage1) { double("Stage1", inspect: "") }

    it "delegates to the X64 proposal on i386/x86_64" do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      expect_any_instance_of(Bootloader::Stage1Proposal::X64).to receive(:propose)

      described_class.propose(stage1)
    end

    it "delegates to the S390 proposal on s390_32/s390_64" do
      allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
      expect_any_instance_of(Bootloader::Stage1Proposal::S390).to receive(:propose)

      described_class.propose(stage1)
    end

    it "delegates to the PPC proposal on ppc/ppc64" do
      allow(Yast::Arch).to receive(:architecture).and_return("ppc64")
      expect_any_instance_of(Bootloader::Stage1Proposal::PPC).to receive(:propose)

      described_class.propose(stage1)
    end

    it "raises for an unsupported architecture" do
      allow(Yast::Arch).to receive(:architecture).and_return("mips")

      expect { described_class.propose(stage1) }.to raise_error(/unsupported architecture/)
    end
  end

  describe Bootloader::Stage1Proposal::S390 do
    let(:stage1) do
      double("Stage1", clear_devices: nil, activate: nil, "activate=": nil, "generic_mbr=": nil)
    end

    subject { described_class.new(stage1) }

    it "resets the bootloader device (no stage1 location needed on s390)" do
      expect(stage1).to receive(:clear_devices)

      subject.propose
    end

    it "does not activate any partition" do
      expect(stage1).to receive(:activate=).with(false)

      subject.propose
    end

    it "does not use a generic MBR" do
      expect(stage1).to receive(:generic_mbr=).with(false)

      subject.propose
    end
  end

  describe Bootloader::Stage1Proposal::X64 do
    let(:stage1) do
      double("Stage1",
        clear_devices:        nil,
        add_udev_device:      nil,
        "activate=":          nil,
        "generic_mbr=":       nil,
        can_use_boot?:        can_use_boot,
        boot_disk_names:      ["/dev/sda"],
        boot_partition_names: ["/dev/sda1"])
    end
    let(:can_use_boot) { true }
    let(:disk) do
      instance_double(Y2Storage::Disk, gpt?: true, partitions: [], partition_table: nil)
    end

    subject { described_class.new(stage1) }

    before do
      allow(Yast::BootStorage).to receive(:boot_disks).and_return([disk])
    end

    context "when the boot partition cannot be used (no separate /boot usable)" do
      let(:can_use_boot) { false }

      it "proposes installing to the MBR" do
        expect(stage1).to receive(:add_udev_device).with("/dev/sda")

        subject.propose
      end
    end

    context "when there is a GPT disk without a bios_boot partition" do
      let(:can_use_boot) { true }

      it "proposes installing to the /boot partition instead of the MBR" do
        expect(stage1).to receive(:add_udev_device).with("/dev/sda1")

        subject.propose
      end

      it "always activates and uses a generic MBR (not installing to the real MBR)" do
        expect(stage1).to receive(:activate=).with(true)
        expect(stage1).to receive(:generic_mbr=).with(true)

        subject.propose
      end
    end
  end

  describe Bootloader::Stage1Proposal::PPC do
    let(:stage1) do
      double("Stage1", clear_devices: nil, add_udev_device: nil, "activate=": nil,
        "generic_mbr=": nil, model: model)
    end
    let(:model) { double("Model", add_device: nil) }

    subject { described_class.new(stage1) }

    context "when there is a PReP partition" do
      let(:prep_partition) do
        instance_double(Y2Storage::Partition, name: "/dev/sda1", exists_in_probed?: false,
          partitionable: disk)
      end
      let(:disk) { instance_double(Y2Storage::Disk, gpt?: false) }

      before do
        allow(Yast::BootStorage).to receive(:prep_partitions).and_return([prep_partition])
        allow(Yast::BootStorage).to receive(:boot_disks).and_return([])
        allow(::Bootloader::UdevMapping).to receive(:to_mountby_device)
          .with("/dev/sda1").and_return("/dev/sda1")
      end

      it "uses that partition as the stage1 device" do
        expect(model).to receive(:add_device).with("/dev/sda1")

        subject.propose
      end

      it "activates it when the disk is not GPT" do
        expect(stage1).to receive(:activate=).with(true)

        subject.propose
      end
    end

    context "when there is no PReP partition" do
      before do
        allow(Yast::BootStorage).to receive(:prep_partitions).and_return([])
        allow(Yast::BootStorage).to receive(:boot_disks).and_return([])
      end

      context "and /boot is on NFS" do
        before do
          allow(Yast::BootStorage).to receive(:boot_filesystem)
            .and_return(instance_double(Y2Storage::Filesystems::Nfs, is?: true))
        end

        it "does not activate anything and does not raise" do
          expect(stage1).to receive(:activate=).with(false)

          expect { subject.propose }.to_not raise_error
        end
      end

      context "and /boot is not on NFS and the board is not powernv" do
        before do
          allow(Yast::BootStorage).to receive(:boot_filesystem)
            .and_return(instance_double(Y2Storage::Filesystems::BlkFilesystem, is?: false))
          allow(Yast::Arch).to receive(:board_powernv).and_return(false)
        end

        it "raises, since there is no device to use for stage1" do
          expect { subject.propose }.to raise_error(/there is no prep partition/)
        end
      end
    end
  end
end
