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

require_relative "../config_context"
require "agama/storage/bootloader_config"
require "agama/storage/config_checkers/encryption"
require "y2storage/bootloader_type"
require "y2storage/encryption_method/pervasive_luks2"
require "y2storage/encryption_method/protected_swap"
require "y2storage/encryption_method/tpm_fde"

describe Agama::Storage::ConfigCheckers::Encryption do
  include_context "config"

  subject { described_class.new(drive_config, subject_bootloader_config) }

  let(:config_json) do
    {
      drives: [
        {
          filesystem: filesystem,
          encryption: encryption
        }
      ]
    }
  end

  let(:drive_config) { config.drives.first }

  let(:filesystem) { nil }

  let(:bootloader_config) do
    Agama::Storage::BootloaderConfig.new.tap { |c| c.type = bootloader_type }
  end

  let(:bootloader_type) { nil }

  # For some tests we need a bootloader config for FromJSON and other bootloader config for the
  # checkers.
  let(:subject_bootloader_config) { bootloader_config }

  describe "#issues" do
    context "without password" do
      let(:encryption) do
        { luks1: {} }
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::NO_ENCRYPTION_PASSPHRASE,
          description: /No passphrase/
        )
      end
    end

    context "with unavailable method" do
      let(:encryption) do
        {
          pervasiveLuks2: {
            password: "12345"
          }
        }
      end

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::PervasiveLuks2)
          .to(receive(:available?))
          .and_return(false)
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /Pervasive Volume Encryption is not available/
        )
      end
    end

    context "if TPM FDE is not possible" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::TpmFde)
          .to(receive(:possible?))
          .and_return(false)
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /TPM-Based Full Disk Encrytion is not available/
        )
      end
    end

    context "if TPM BLS is not possible" do
      let(:encryption) do
        {
          luks2: {
            password: "12345",
            tpm:      true
          }
        }
      end

      let(:bootloader_type) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::TpmBls)
          .to(receive(:possible?))
          .and_return(false)
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /BLS Compliant Encryption With TPM Unlocking is not available/
        )
      end
    end

    context "with invalid method" do
      let(:encryption) { "protected_swap" }
      let(:filesystem) { { path: "/" } }

      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::ProtectedSwap)
          .to(receive(:available?))
          .and_return(true)
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /Encryption with Volatile Protected Key is not suitable/
        )
      end
    end

    context "with a valid encryption" do
      let(:encryption) do
        {
          luks1: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "with TPM BLS encryption and systemd-boot bootloader" do
      let(:encryption) do
        {
          luks2: {
            password: "12345",
            tpm:      true
          }
        }
      end

      let(:filesystem) { { path: "/" } }

      let(:bootloader_type) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "with TPM BLS encryption and grub2-bls bootloader" do
      let(:encryption) do
        {
          luks2: {
            password: "12345",
            tpm:      true
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::GRUB2_BLS }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "with TPM BLS encryption and grub2 bootloader" do
      let(:encryption) do
        {
          luks2: {
            password: "12345",
            tpm:      true
          }
        }
      end

      let(:filesystem) { { path: "/" } }

      # This bootloader type is passed to FromJSON, so FDE BLS will be configured.
      let(:bootloader_type) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      # This bootloader is passed to the checker.
      let(:subject_bootloader_config) do
        Agama::Storage::BootloaderConfig.new.tap do |c|
          c.type = Y2Storage::BootloaderType::GRUB2
        end
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /is not suitable for the bootloader/
        )
      end
    end

    context "with TPM BLS encryption and bls-legacy bootloader" do
      let(:encryption) do
        {
          luks2: {
            password: "12345",
            tpm:      true
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::BLS_LEGACY }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "with TPM BLS encryption and NONE bootloader" do
      let(:encryption) do
        {
          luks2: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::NONE }

      it "includes the expected issue" do
        # Explicitly force TPM_BLS encryption method after Config creation
        drive_config.encryption.method = Y2Storage::EncryptionMethod::TPM_BLS

        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /is not suitable for the bootloader/
        )
      end
    end

    context "with TPM BLS encryption and nil bootloader type" do
      let(:encryption) do
        {
          luks2: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { nil }

      it "does not include an issue" do
        # Explicitly force TPM_BLS encryption method after Config creation
        drive_config.encryption.method = Y2Storage::EncryptionMethod::TPM_BLS

        # With nil bootloader, the check is skipped (returns false early)
        expect(subject.issues.size).to eq(0)
      end
    end

    context "with TPM FDE encryption and systemd-boot bootloader" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /is not suitable for the bootloader/
        )
      end
    end

    context "with TPM FDE encryption and grub2-bls bootloader" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::GRUB2_BLS }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /is not suitable for the bootloader/
        )
      end
    end

    context "with TPM FDE encryption and grub2 bootloader" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::GRUB2 }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end

    context "with TPM FDE encryption and bls-legacy bootloader" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::BLS_LEGACY }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /is not suitable for the bootloader/
        )
      end
    end

    context "with TPM FDE encryption and NONE bootloader" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { Y2Storage::BootloaderType::NONE }

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::WRONG_ENCRYPTION_METHOD,
          description: /is not suitable for the bootloader/
        )
      end
    end

    context "with TPM FDE encryption and nil bootloader type" do
      let(:encryption) do
        {
          tpmFde: {
            password: "12345"
          }
        }
      end

      let(:filesystem) { { path: "/" } }
      let(:bootloader_type) { nil }

      it "does not include an issue" do
        expect(subject.issues.size).to eq(0)
      end
    end
  end
end
