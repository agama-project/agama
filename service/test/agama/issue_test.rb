# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "agama/issue"

describe Agama::Issue do
  subject { described_class.new("Issue test", severity: severity) }

  describe "#error?" do
    context "if the issue has warn severity" do
      let(:severity) { Agama::Issue::Severity::WARN }

      it "returns false" do
        expect(subject.error?).to eq(false)
      end
    end

    context "if the issue has error severity" do
      let(:severity) { Agama::Issue::Severity::ERROR }

      it "returns true" do
        expect(subject.error?).to eq(true)
      end
    end
  end
end
