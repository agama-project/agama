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

require_relative "../../../test_helper"
require "agama/storage/bootloader_config"
require "agama/storage/config_checkers/bootloader"
require "agama/storage/issue_classes"
require "y2storage/bootloader_type"

describe Agama::Storage::ConfigCheckers::Bootloader do
  subject { described_class.new(bootloader_config) }

  let(:bootloader_config) do
    Agama::Storage::BootloaderConfig.new.tap do |bc|
      bc.type = bootloader_type
    end
  end

  let(:bootloader_type) { nil }
  let(:efi) { true }
  let(:x86_64) { true }

  before do
    allow(Bootloader::Systeminfo).to receive(:efi?).and_return(efi)
    allow(Yast::Arch).to receive(:x86_64).and_return(x86_64)
    allow(Yast::Arch).to receive(:i386).and_return(false)
    allow(Yast::Arch).to receive(:aarch64).and_return(false)
    allow(Yast::Arch).to receive(:arm).and_return(false)
    allow(Yast::Arch).to receive(:riscv64).and_return(false)
  end

  describe "#issues" do
    context "when bootloader type is not set" do
      let(:bootloader_type) { nil }

      it "returns no issues" do
        expect(subject.issues).to be_empty
      end
    end

    context "when bootloader type is grub2" do
      let(:bootloader_type) { Y2Storage::BootloaderType::GRUB2 }

      context "on an EFI system" do
        let(:efi) { true }

        it "returns no issues" do
          expect(subject.issues).to be_empty
        end
      end

      context "on a non-EFI system" do
        let(:efi) { false }

        it "returns no issues" do
          expect(subject.issues).to be_empty
        end
      end
    end

    context "when bootloader type is none" do
      let(:bootloader_type) { Y2Storage::BootloaderType::NONE }

      context "on a non-EFI system" do
        let(:efi) { false }

        it "returns no issues" do
          expect(subject.issues).to be_empty
        end
      end
    end

    context "when bootloader type is systemd-boot" do
      let(:bootloader_type) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      context "on an EFI system" do
        let(:efi) { true }

        context "with supported architecture" do
          it "returns no issues" do
            expect(subject.issues).to be_empty
          end
        end

        context "with unsupported architecture" do
          let(:x86_64) { false }

          it "returns an issue indicating architecture is not supported" do
            expect(subject.issues).to include an_object_having_attributes(
              kind:        Agama::Storage::IssueClasses::Config::WRONG_BOOTLOADER,
              description: "The bootloader 'systemd-boot' is not supported on this architecture."
            )
          end
        end
      end

      context "on a non-EFI system" do
        let(:efi) { false }

        it "returns an issue indicating EFI is required" do
          expect(subject.issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::WRONG_BOOTLOADER,
            description: "The bootloader 'systemd-boot' cannot be installed on a non-EFI system."
          )
        end
      end
    end

    context "when bootloader type is grub2-bls" do
      let(:bootloader_type) { Y2Storage::BootloaderType::GRUB2_BLS }

      context "on a non-EFI system" do
        let(:efi) { false }

        it "returns an issue indicating EFI is required" do
          expect(subject.issues).to include an_object_having_attributes(
            kind:        Agama::Storage::IssueClasses::Config::WRONG_BOOTLOADER,
            description: "The bootloader 'grub2-bls' cannot be installed on a non-EFI system."
          )
        end
      end
    end
  end
end
