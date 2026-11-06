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

require "yast2/popup"
require "yast2/popup_rspec"

describe "expect_to_show_popup_which_return" do
  it "returns parameter from popup" do
    expect_to_show_popup_which_return(:test)
    expect(Yast2::Popup.show("test")).to eq :test
  end

  it "let popup raise argument error if wrong arguments are passed" do
    expect_to_show_popup_which_return(:test)
    expect { Yast2::Popup.show("test", buttons: nil) }.to raise_error(ArgumentError)
  end
end
