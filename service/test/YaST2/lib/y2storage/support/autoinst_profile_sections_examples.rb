# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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

require "installation/autoinst_profile/section_with_attributes"

RSpec.shared_examples "autoinst section" do
  let(:parent) do
    ::Installation::AutoinstProfile::SectionWithAttributes.new
  end

  describe ".new_from_hashes" do
    it "sets the parent section" do
      section = described_class.new_from_hashes({}, parent)
      expect(section.parent).to eq(parent)
    end
  end
end
