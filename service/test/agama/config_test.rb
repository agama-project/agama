# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require_relative "../test_helper"
require "yast"
require "agama/config"
require "agama/product_reader"

Yast.import "Arch"

describe Agama::Config do
  let(:config) { described_class.new("web" => { "ssl" => "SOMETHING" }) }

  describe "#data" do
    it "returns memoized configuration data" do
      expect(config.data).to eql("web" => { "ssl" => "SOMETHING" })
    end
  end
end
