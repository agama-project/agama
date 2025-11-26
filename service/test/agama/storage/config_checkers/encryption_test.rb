# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/config_checkers/encryption"
require "y2storage/encryption_method/pervasive_luks2"
require "y2storage/encryption_method/protected_swap"
require "y2storage/encryption_method/tpm_fde"

describe Agama::Storage::ConfigCheckers::Encryption do
  include_context "config"

  subject { described_class.new(drive_config) }

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

  describe "#issues" do
    context "without password" do
      let(:encryption) do
        { luks1: {} }
      end

      it "includes the expected issue" do
        issues = subject.issues
        expect(issues).to include an_object_having_attributes(
          kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
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
          kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
          description: /'Pervasive Volume Encryption' is not available/
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
          kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
          description: /'TPM-Based Full Disk Encrytion' is not available/
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
          kind:        Agama::Storage::IssueClasses::Config::ENCRYPTION,
          description: /'Encryption with Volatile Protected Key' is not a suitable/
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
  end
end
