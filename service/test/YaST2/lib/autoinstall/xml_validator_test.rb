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
require "autoinstall/xml_validator"

describe Y2Autoinstallation::XmlValidator do
  let(:xml_name) { "foo.xml" }
  let(:schema_name) { "bar.rng" }
  let(:xml) { Pathname.new(xml_name) }
  let(:schema) { Pathname.new(schema_name) }

  subject { Y2Autoinstallation::XmlValidator.new(xml_name, schema_name) }

  describe "#valid?" do
    it "returns true if Yast::XML.validate returns no errors" do
      expect(Yast::XML).to receive(:validate).with(xml, schema).and_return([])
      expect(subject.valid?).to be true
    end

    it "returns false if Yast::XML.validate returns some error" do
      expect(Yast::XML).to receive(:validate).with(xml, schema).and_return(["ERROR"])
      expect(subject.valid?).to be false
    end

    it "returns false if Yast::XML.validate fails with parse error" do
      expect(Yast::XML).to receive(:validate).with(xml, schema)
        .and_raise(Yast::XMLDeserializationError)
      expect(subject.valid?).to be false
    end
  end

  describe "#errors" do
    it "returns empty list if Yast::XML.validate returns no errors" do
      expect(Yast::XML).to receive(:validate).with(xml, schema).and_return([])
      expect(subject.errors).to eq([])
    end

    it "returns errors from Yast::XML.validate" do
      expect(Yast::XML).to receive(:validate).with(xml, schema).and_return(["ERROR"])
      expect(subject.errors).to eq(["ERROR"])
    end

    it "returns the parse false if Yast::XML.validate fails with parse error" do
      expect(Yast::XML).to receive(:validate).with(xml, schema)
        .and_raise(Yast::XMLDeserializationError.new("error"))
      expect(subject.errors).to eq(["error"])
    end
  end
end
