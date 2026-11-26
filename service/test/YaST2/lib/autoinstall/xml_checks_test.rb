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
require "autoinstall/xml_checks"

describe Y2Autoinstallation::XmlChecks do
  subject { described_class.instance }

  describe "#valid_profile?" do
    before do
      allow(subject).to receive(:check).and_return(true)
    end

    it "checks the profile against the profile schema" do
      expect(subject).to receive(:check)
        .with("profile.xml", described_class::PROFILE_SCHEMA)

      subject.valid_profile?("profile.xml")
    end
  end

  describe "#check" do
    let(:xml) { "foo.xml" }
    let(:schema) { "bar.rng" }
    let(:valid) { true }
    let(:errors) { ["ERROR"] }
    let(:validator) do
      instance_double(Y2Autoinstallation::XmlValidator, valid?: valid, errors: errors)
    end

    before do
      allow(Y2Autoinstallation::XmlValidator).to receive(:new).with(xml, schema)
        .and_return(validator)
    end

    context "when the document is valid" do
      it "returns true" do
        expect(subject.check(xml, schema)).to eql(true)
      end
    end

    context "when the document is invalid" do
      let(:valid) { false }

      it "logs the validation errors" do
        expect(subject.log).to receive(:warn).with(/ERROR/)

        subject.check(xml, schema)
      end

      it "returns true" do
        expect(subject.check(xml, schema)).to eql(true)
      end
    end
  end
end
