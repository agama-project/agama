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

require_relative "../../test_helper"
require "yast"
require "agama/autoyast/security_reader"

Yast.import "Profile"

describe Agama::AutoYaST::SecurityReader do
  let(:profile) { {} }

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no scripts sections" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when the profile only specifies a certificate URL" do
      let(:profile) do
        {
          "suse_register" => {
            "reg_server_cert" => "http://smt.example.com/smt.crt"
          }
        }
      end

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when the profile specifies fingerprint without type" do
      let(:profile) do
        {
          "suse_register" => {
            "reg_server_cert_fingerprint" => "01:12:23:34:45"
          }
        }
      end

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when the profile specifies a type with no corresponding fingerprint" do
      let(:profile) do
        {
          "suse_register" => {
            "reg_server_cert_fingerprint_type" => "SHA256"
          }
        }
      end

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when the profile specifies a fingerprint and its type" do
      let(:profile) do
        {
          "suse_register" => {
            "reg_server_cert_fingerprint"      => "01:12:23:34:45",
            "reg_server_cert_fingerprint_type" => "SHA256"
          }
        }
      end

      it "creates a security section with one certificate" do
        certificates = subject.read["security"]["sslCertificates"]
        expect(certificates.size).to eq 1
        expect(certificates.first).to include(
          "fingerprint" => "01:12:23:34:45", "algorithm" => "SHA256"
        )
      end
    end
  end
end
