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
require "agama/autoyast/profile_description"

describe Agama::AutoYaST::ProfileDescription do
  let(:subject) { described_class.load }

  describe "#find_element" do
    context "when the element exists" do
      it "returns the element data" do
        element = subject.find_element("networking.backend")
        expect(element.key).to eq("networking.backend")
        expect(element.support).to eq(:no)
      end
    end

    context "when the element is unknown" do
      it "returns nil" do
        expect(subject.find_element("iscsi-client.dummy")).to be_nil
      end
    end
  end
end
