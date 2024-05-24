# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/autoyast/product_reader"

Yast.import "Profile"

describe Agama::AutoYaST::ProductReader do
  let(:profile) do
    {
      "software"      => software_section,
      "suse_register" => suse_register_section
    }
  end

  let(:software_section) do
    { "products" => ["SLE"], "patterns" => ["base", "gnome"] }
  end

  let(:suse_register_section) do
    { "reg_code" => "123456", "email" => "test@opensuse.org" }
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'software' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when a product ID is included" do
      it "includes the product ID as 'product.id'" do
        product_id = subject.read.dig("product", "id")
        expect(product_id).to eq("SLE")
      end
    end

    context "when there is registration information" do
      it "includes the registration code" do
        product = subject.read["product"]
        expect(product["registrationCode"]).to eq("123456")
        expect(product["registrationEmail"]).to eq("test@opensuse.org")
      end
    end
  end
end
