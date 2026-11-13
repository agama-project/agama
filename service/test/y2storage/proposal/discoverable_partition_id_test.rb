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

require_relative "../../test_helper"
require_relative "../../YaST2/lib/y2storage/support/shared_setup"
require "y2storage"
require "y2storage/proposal/discoverable_partition_id"

describe Y2Storage::Proposal::DiscoverablePartitionId do
  subject { described_class.new(arch) }

  let(:arch) { double("Yast::Arch", **arch_methods) }

  # All the architectures are false, except the given one
  def arch_methods(current = :x86_64)
    [:x86_64, :i386, :aarch64, :arm, :ppc32, :ppc64, :riscv64, :s390_32, :s390_64]
      .map { |name| [name, name == current] }.to_h
  end

  let(:ptable) { double("PartitionTable", type: ptable_type) }
  let(:ptable_type) { double("PartitionTables::Type") }

  before do
    allow(ptable_type).to receive(:is?) { |type| type == ptable_type_name }
  end

  let(:ptable_type_name) { :gpt }

  let(:ids) { Y2Storage::PartitionId }

  describe "#for" do
    context "for a mount point that does not depend on the architecture" do
      it "returns the expected id" do
        expect(subject.for("/home", ptable)).to eq(ids::LINUX_HOME)
        expect(subject.for("/srv", ptable)).to eq(ids::LINUX_SERVER_DATA)
        expect(subject.for("/var", ptable)).to eq(ids::LINUX_VAR)
        expect(subject.for("/var/tmp", ptable)).to eq(ids::LINUX_VAR_TMP)
        expect(subject.for("swap", ptable)).to eq(ids::SWAP)
      end
    end

    context "for the root and /usr mount points" do
      {
        x86_64:  [:LINUX_ROOT_X86_64, :LINUX_USR_X86_64],
        i386:    [:LINUX_ROOT_X86, :LINUX_USR_X86],
        aarch64: [:LINUX_ROOT_AARCH64, :LINUX_USR_AARCH64],
        arm:     [:LINUX_ROOT_ARM, :LINUX_USR_ARM],
        ppc32:   [:LINUX_ROOT_PPC32, :LINUX_USR_PPC32],
        ppc64:   [:LINUX_ROOT_PPC64LE, :LINUX_USR_PPC64LE],
        riscv64: [:LINUX_ROOT_RISCV64, :LINUX_USR_RISCV64],
        s390_32: [:LINUX_ROOT_S390, :LINUX_USR_S390],
        s390_64: [:LINUX_ROOT_S390X, :LINUX_USR_S390X]
      }.each do |name, (root, usr)|
        context "on #{name}" do
          let(:arch) { double("Yast::Arch", **arch_methods(name)) }

          it "returns the id for the architecture" do
            expect(subject.for("/", ptable)).to eq(ids.const_get(root))
            expect(subject.for("/usr", ptable)).to eq(ids.const_get(usr))
          end
        end
      end

      context "on an architecture without DPS ids" do
        let(:arch) { double("Yast::Arch", **arch_methods(nil)) }

        it "returns nil" do
          expect(subject.for("/", ptable)).to be_nil
          expect(subject.for("/usr", ptable)).to be_nil
        end

        it "still returns the ids that do not depend on the architecture" do
          expect(subject.for("/home", ptable)).to eq(ids::LINUX_HOME)
        end
      end
    end

    context "for a mount point without DPS id" do
      it "returns nil" do
        ["/boot", "/boot/efi", "/efi", "/opt", "/data", "", nil].each do |path|
          expect(subject.for(path, ptable)).to be_nil
        end
      end
    end

    context "if the partition table is not GPT" do
      let(:ptable_type_name) { :msdos }

      it "returns nil" do
        expect(subject.for("/", ptable)).to be_nil
        expect(subject.for("/home", ptable)).to be_nil
        expect(subject.for("swap", ptable)).to be_nil
      end
    end

    context "with the real partition tables" do
      include_context "yast2-storage-ng test setup"

      before { fake_scenario("empty_hard_disk_50GiB") }

      let(:disk) { fake_devicegraph.find_by_name("/dev/sda") }

      context "on a GPT partition table" do
        let(:ptable) { disk.create_partition_table(Y2Storage::PartitionTables::Type::GPT) }

        it "returns the id" do
          expect(subject.for("/", ptable)).to eq(ids::LINUX_ROOT_X86_64)
          expect(subject.for("/var", ptable)).to eq(ids::LINUX_VAR)
          expect(subject.for("swap", ptable)).to eq(ids::SWAP)
        end
      end

      context "on a MSDOS partition table" do
        let(:ptable) { disk.create_partition_table(Y2Storage::PartitionTables::Type::MSDOS) }

        it "returns nil" do
          expect(subject.for("/", ptable)).to be_nil
          expect(subject.for("/var", ptable)).to be_nil
          expect(subject.for("swap", ptable)).to be_nil
        end
      end
    end

    context "if no architecture is given" do
      subject { described_class.new }

      it "uses Yast::Arch" do
        allow(Yast::Arch).to receive(:x86_64).and_return(true)

        expect(subject.for("/", ptable)).to eq(ids::LINUX_ROOT_X86_64)
      end
    end
  end
end
