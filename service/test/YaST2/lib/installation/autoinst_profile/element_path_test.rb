# Copyright (c) [2020] SUSE LLC
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
require "installation/autoinst_profile/element_path"

describe Installation::AutoinstProfile::ElementPath do
  subject { described_class.new }

  describe ".from_string" do
    it "returns a path composed by the given parts" do
      expect(described_class.from_string("users,1,username"))
        .to eq(described_class.new("users", 1, "username"))
    end
  end

  describe "#join" do
    subject(:path) { described_class.new("users", 1) }

    it "returns a new profile path including all the parts" do
      expect(subject.join("username")).to eq(described_class.new("users", 1, "username"))
    end

    context "when strings and paths are given" do
      let(:path) { described_class.new("general") }

      it "returns a new profile path including all parts" do
        new_path = path.join(described_class.new("mode"), "confirm")
        expect(new_path).to eq(described_class.new("general", "mode", "confirm"))
      end
    end
  end

  describe "#to_s" do
    subject(:path) { described_class.new("users", 1, "username") }

    it "returns an string representing the path" do
      expect(path.to_s).to eq("users,1,username")
    end
  end
end
