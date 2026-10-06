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

require "y2storage/tpm"
require "yast2/execute"

describe Y2Storage::Tpm do
  include_context "yast2-storage-ng test setup"

  subject(:tpm) { described_class.instance }

  before do
    allow(Yast::SCR).to receive(:Read)
    allow(Yast::Execute).to receive(:locally!)
    # Reset singleton state before each test
    described_class.instance.instance_variable_set(:@version_checked, nil)
    described_class.instance.instance_variable_set(:@version, nil)
    described_class.instance.instance_variable_set(:@capabilities_checked, nil)
    described_class.instance.instance_variable_set(:@capabilities, nil)
  end

  describe "#version2?" do
    before do
      allow(Yast::SCR).to receive(:Read)
        .with(path(".target.string"), "/sys/class/tpm/tpm0/tpm_version_major")
        .and_return(version)
    end

    context "when TPM version is 2" do
      let(:version) { "2\n" }

      it "returns true" do
        expect(tpm.version2?).to eq(true)
      end
    end

    context "when TPM version is 1" do
      let(:version) { "1\n" }

      it "returns false" do
        expect(tpm.version2?).to eq(false)
      end
    end

    context "when TPM version cannot be read" do
      let(:version) { nil }

      it "returns false" do
        expect(tpm.version2?).to eq(false)
      end
    end

    context "when TPM version is empty" do
      let(:version) { "" }

      it "returns false" do
        expect(tpm.version2?).to eq(false)
      end
    end

    context "when version is read multiple times" do
      let(:version) { "2\n" }

      it "caches the version check" do
        tpm.version2?
        tpm.version2?

        expect(Yast::SCR).to have_received(:Read).once
      end
    end
  end

  describe "#policy_authorize_nv?" do
    before do
      allow(Yast::SCR).to receive(:Read)
        .with(path(".target.string"), "/sys/class/tpm/tpm0/tpm_version_major")
        .and_return(version)
      allow(Yast::Execute).to receive(:locally!)
        .with("tpm2_getcap", "commands", stdout: :capture)
        .and_return(capabilities)
    end

    context "when TPM version is not 2" do
      let(:version) { "1\n" }
      let(:capabilities) { nil }

      it "returns false" do
        expect(tpm.policy_authorize_nv?).to eq(false)
      end

      it "does not check capabilities" do
        tpm.policy_authorize_nv?
        expect(Yast::Execute).not_to have_received(:locally!)
      end
    end

    context "when TPM version is 2" do
      let(:version) { "2\n" }

      context "and capabilities include TPM2_CC_PolicyAuthorizeNV" do
        let(:capabilities) do
          <<~OUTPUT
            TPM2_CC_CreateLoaded
            TPM2_CC_PolicyAuthorizeNV
            TPM2_CC_EncryptDecrypt2
          OUTPUT
        end

        it "returns true" do
          expect(tpm.policy_authorize_nv?).to eq(true)
        end
      end

      context "and capabilities do not include TPM2_CC_PolicyAuthorizeNV" do
        let(:capabilities) do
          <<~OUTPUT
            TPM2_CC_NV_UndefineSpaceSpecial
            TPM2_CC_CreateLoaded
            TPM2_CC_EncryptDecrypt2
          OUTPUT
        end

        it "returns false" do
          expect(tpm.policy_authorize_nv?).to eq(false)
        end
      end

      context "and capabilities cannot be read due to command failure" do
        let(:capabilities) { nil }

        before do
          allow(Yast::Execute).to receive(:locally!)
            .with("tpm2_getcap", "commands", stdout: :capture)
            .and_raise(Cheetah::ExecutionFailed.new(nil, nil, nil, nil))
        end

        it "returns false" do
          expect(tpm.policy_authorize_nv?).to eq(false)
        end
      end

      context "when capabilities are read multiple times" do
        let(:capabilities) { "TPM2_CC_PolicyAuthorizeNV\n" }

        it "caches the capabilities check" do
          tpm.policy_authorize_nv?
          tpm.policy_authorize_nv?

          expect(Yast::Execute).to have_received(:locally!).once
        end
      end
    end

    context "when version is nil" do
      let(:version) { nil }
      let(:capabilities) { nil }

      it "returns false" do
        expect(tpm.policy_authorize_nv?).to eq(false)
      end
    end
  end
end
