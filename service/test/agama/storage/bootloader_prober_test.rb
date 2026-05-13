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
require "agama/storage/bootloader_prober"

describe Agama::Storage::BootloaderProber do
  subject { described_class.new }

  let(:storage_manager) { instance_double(Y2Storage::StorageManager) }
  let(:storage_arch) { instance_double(Y2Storage::Arch) }

  before do
    allow(Y2Storage::StorageManager).to receive(:instance).and_return(storage_manager)
    allow(storage_manager).to receive(:arch).and_return(storage_arch)
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(false)
    allow(Y2Storage::EncryptionMethod::TPM_BLS).to receive(:possible?).and_return(false)
    allow(Yast::Arch).to receive(:has_tpm2).and_return(false)
  end

  describe "#probe" do
    context "on Raspberry Pi" do
      before do
        allow(Yast::Arch).to receive(:aarch64).and_return(true)
        allow(File).to receive(:exist?).with("/proc/device-tree/model").and_return(true)
        allow(File).to receive(:read).with("/proc/device-tree/model")
          .and_return("Raspberry Pi 4 Model B")
        allow(storage_arch).to receive(:efiboot?).and_return(false)
        allow(storage_arch).to receive(:x86?).and_return(false)
      end

      it "returns only grub2" do
        bootloaders = subject.probe
        expect(bootloaders.size).to eq(1)
        expect(bootloaders.first).to be_a(Agama::Storage::Bootloader)
        expect(bootloaders.first.type).to eq(Y2Storage::BootloaderType::GRUB2)
      end
    end

    context "on s390 architecture" do
      before do
        allow(storage_arch).to receive(:s390?).and_return(true)
        allow(storage_arch).to receive(:ppc?).and_return(false)
        allow(storage_arch).to receive(:x86?).and_return(false)
        allow(storage_arch).to receive(:efiboot?).and_return(false)
        allow(Yast::Arch).to receive(:aarch64).and_return(false)
      end

      it "returns only grub2" do
        bootloaders = subject.probe
        expect(bootloaders.size).to eq(1)
        expect(bootloaders.first).to be_a(Agama::Storage::Bootloader)
        expect(bootloaders.first.type).to eq(Y2Storage::BootloaderType::GRUB2)
      end
    end

    context "on ppc architecture" do
      before do
        allow(storage_arch).to receive(:s390?).and_return(false)
        allow(storage_arch).to receive(:ppc?).and_return(true)
        allow(storage_arch).to receive(:x86?).and_return(false)
        allow(storage_arch).to receive(:efiboot?).and_return(false)
        allow(Yast::Arch).to receive(:aarch64).and_return(false)
      end

      it "returns only grub2" do
        bootloaders = subject.probe
        expect(bootloaders.size).to eq(1)
        expect(bootloaders.first).to be_a(Agama::Storage::Bootloader)
        expect(bootloaders.first.type).to eq(Y2Storage::BootloaderType::GRUB2)
      end
    end

    shared_examples "BLS bootloaders" do
      context "with EFI boot" do
        before do
          allow(storage_arch).to receive(:efiboot?).and_return(true)
        end

        context "with TPM2 support" do
          before do
            allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
            allow(Y2Storage::EncryptionMethod::TPM_BLS).to receive(:possible?).and_return(true)
            allow(Yast::Arch).to receive(:has_tpm2).and_return(true)
          end

          it "returns grub2, grub2_bls, and systemd_boot with TPM" do
            bootloaders = subject.probe
            expect(bootloaders.size).to eq(3)
            expect(bootloaders[0]).to be_a(Agama::Storage::Bootloader)
            expect(bootloaders[0].type).to eq(Y2Storage::BootloaderType::GRUB2)
            expect(bootloaders[0].tpm_encryption_auth?).to eq(true)
            expect(bootloaders[1]).to be_a(Agama::Storage::Bootloader)
            expect(bootloaders[1].type).to eq(Y2Storage::BootloaderType::GRUB2_BLS)
            expect(bootloaders[1].tpm_encryption_auth?).to eq(true)
            expect(bootloaders[2]).to be_a(Agama::Storage::Bootloader)
            expect(bootloaders[2].type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
            expect(bootloaders[2].tpm_encryption_auth?).to eq(true)
          end
        end

        context "without TPM2 support" do
          before do
            allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(false)
            allow(Y2Storage::EncryptionMethod::TPM_BLS).to receive(:possible?).and_return(false)
            allow(Yast::Arch).to receive(:has_tpm2).and_return(false)
          end

          it "returns grub2, grub2_bls, and systemd_boot without TPM" do
            bootloaders = subject.probe
            expect(bootloaders.size).to eq(3)
            expect(bootloaders[0]).to be_a(Agama::Storage::Bootloader)
            expect(bootloaders[0].type).to eq(Y2Storage::BootloaderType::GRUB2)
            expect(bootloaders[0].tpm_encryption_auth?).to eq(false)
            expect(bootloaders[1]).to be_a(Agama::Storage::Bootloader)
            expect(bootloaders[1].type).to eq(Y2Storage::BootloaderType::GRUB2_BLS)
            expect(bootloaders[1].tpm_encryption_auth?).to eq(false)
            expect(bootloaders[2]).to be_a(Agama::Storage::Bootloader)
            expect(bootloaders[2].type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
            expect(bootloaders[2].tpm_encryption_auth?).to eq(false)
          end
        end
      end

      context "without EFI boot" do
        before do
          allow(storage_arch).to receive(:efiboot?).and_return(false)
        end

        it "returns grub2, grub2_bls, and systemd_boot without TPM" do
          bootloaders = subject.probe
          expect(bootloaders.size).to eq(3)
          expect(bootloaders[0]).to be_a(Agama::Storage::Bootloader)
          expect(bootloaders[0].type).to eq(Y2Storage::BootloaderType::GRUB2)
          expect(bootloaders[0].tpm_encryption_auth?).to eq(false)
          expect(bootloaders[1]).to be_a(Agama::Storage::Bootloader)
          expect(bootloaders[1].type).to eq(Y2Storage::BootloaderType::GRUB2_BLS)
          expect(bootloaders[1].tpm_encryption_auth?).to eq(false)
          expect(bootloaders[2]).to be_a(Agama::Storage::Bootloader)
          expect(bootloaders[2].type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
          expect(bootloaders[2].tpm_encryption_auth?).to eq(false)
        end
      end
    end

    context "on x86_64 architecture" do
      before do
        allow(storage_arch).to receive(:s390?).and_return(false)
        allow(storage_arch).to receive(:ppc?).and_return(false)
        allow(storage_arch).to receive(:x86?).and_return(true)
        allow(Yast::Arch).to receive(:aarch64).and_return(false)
      end

      include_examples "BLS bootloaders"
    end

    context "on aarch64 architecture" do
      before do
        allow(storage_arch).to receive(:s390?).and_return(false)
        allow(storage_arch).to receive(:ppc?).and_return(false)
        allow(storage_arch).to receive(:x86?).and_return(false)
        allow(Yast::Arch).to receive(:aarch64).and_return(true)
      end

      include_examples "BLS bootloaders"
    end

    context "on unsupported architecture" do
      before do
        allow(storage_arch).to receive(:s390?).and_return(false)
        allow(storage_arch).to receive(:ppc?).and_return(false)
        allow(storage_arch).to receive(:x86?).and_return(false)
        allow(storage_arch).to receive(:efiboot?).and_return(false)
        allow(Yast::Arch).to receive(:aarch64).and_return(false)
      end

      it "returns only grub2" do
        bootloaders = subject.probe
        expect(bootloaders.size).to eq(1)
        expect(bootloaders.first).to be_a(Agama::Storage::Bootloader)
        expect(bootloaders.first.type).to eq(Y2Storage::BootloaderType::GRUB2)
      end
    end
  end
end
