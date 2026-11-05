#!/usr/bin/env rspec
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage/encryption_authentication"

describe Y2Storage::EncryptionAuthentication do
  include_context "yast2-storage-ng test setup"

  subject { Y2Storage::EncryptionAuthentication::FIDO2 }

  describe "#is?" do
    it "returns true for an equivalent function object" do
      expect(subject.is?(Y2Storage::EncryptionAuthentication.find("fido2"))).to eq true
    end

    it "returns false for a non-equivalent function object" do
      expect(subject.is?(Y2Storage::EncryptionAuthentication.find("tpm2"))).to eq false
    end

    it "returns true for a list of symbols including the equivalent one" do
      expect(subject.is?(:fido2, :authentication)).to eq true
    end

    it "returns false for list of symbols not including the equivalent one" do
      expect(subject.is?(:tpm2, :authentication)).to eq false
    end
  end

  describe "#all" do
    before do
      allow(Y2Storage::Tpm).to receive(:instance).and_return(tpm)
    end

    let(:tpm) { instance_double(Y2Storage::Tpm, policy_authorize_nv?: policy_authorize_nv) }

    context "tpm2 is available" do
      let(:policy_authorize_nv) { true }

      it "includes tpm2 and tpm2+pin" do
        expect(Y2Storage::EncryptionAuthentication.all)
          .to eq [Y2Storage::EncryptionAuthentication::PASSWORD,
                  Y2Storage::EncryptionAuthentication::TPM2,
                  Y2Storage::EncryptionAuthentication::TPM2PIN,
                  Y2Storage::EncryptionAuthentication::FIDO2]
      end
    end

    context "tpm2 is not available" do
      let(:policy_authorize_nv) { false }

      it "includes not tpm2 and tpm2+pin" do
        expect(Y2Storage::EncryptionAuthentication.all)
          .to eq [Y2Storage::EncryptionAuthentication::PASSWORD,
                  Y2Storage::EncryptionAuthentication::FIDO2]
      end
    end
  end

  describe "#===" do
    it "returns true for the equivalent object" do
      value =
        case subject
        when Y2Storage::EncryptionAuthentication.find("fido2")
          true
        else
          false
        end
      expect(value).to eq true
    end

    it "returns false for the equivalent symbol" do
      value =
        case subject
        when :fido2
          true
        else
          false
        end
      expect(value).to eq false
    end
  end
end
