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


Yast.import "URLRecode"

describe Yast::URLRecode do
  subject { Yast::URLRecode }

  describe "#EscapePath" do
    let(:test_path) { "/@\#%^&/dir/\u010D\u00FD\u011B\u0161\u010D\u00FD\u00E1/file" }
    it "returns nil if the url is nil too" do
      expect(subject.EscapePath(nil)).to eq(nil)
    end

    it "returns empty string if the url is empty too" do
      expect(subject.EscapePath("")).to eq("")
    end

    it "returns escaped path" do
      expect(subject.EscapePath(test_path)).to eq(
        "/%40%23%25%5e%26/dir/%c4%8d%c3%bd%c4%9b%c5%a1%c4%8d%c3%bd%c3%a1/file"
      )
    end

    it "returns unchanged path while calling EscapePath and UnEscape" do
      expect(subject.UnEscape(subject.EscapePath(test_path))).to eq(test_path)
    end

    it "returns escaped special characters" do
      expect(subject.EscapePath(" !@\#%^&*()/?+=:")).to eq(
        "%20!%40%23%25%5e%26*()/%3f%2b%3d:"
      )
    end

    it "does not escape '$'" do
      expect(subject.EscapePath("path/to/%SUSE%/$releasever"))
        .to eq("path/to/%25SUSE%25/$releasever")
    end
  end

  describe "#EscapePassword" do
    it "returns escaped special characters" do
      expect(subject.EscapePassword(" !@\#$%^&*()/?+=<>[]|\"")).to eq(
        "%20!%40%23%24%25%5e%26*()%2f%3f%2b%3d%3c%3e%5b%5d%7c%22"
      )
    end
  end

  describe "#EscapeQuery" do
    it "returns escaped special characters" do
      expect(subject.EscapeQuery(" !@\#$%^&*()/?+=")).to eq(
        "%20!%40%23%24%25%5e&*()/%3f%2b="
      )
    end
  end
end
