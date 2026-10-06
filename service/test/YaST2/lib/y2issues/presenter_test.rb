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

require "y2issues"

describe Y2Issues::Presenter do
  subject(:presenter) { described_class.new(list) }
  let(:list) { Y2Issues::List.new }

  describe "#to_html" do
    context "when an error was found" do
      before do
        list << Y2Issues::Issue.new("Something is invalid", severity: :error)
      end

      it "includes issues messages" do
        issue = list.first
        expect(presenter.to_html.to_s).to include "<li>#{issue.message}</li>"
      end

      it "includes an introduction to the errors list" do
        expect(presenter.to_html.to_s).to include "Important issues"
      end
    end

    context "when a warning was found" do
      before do
        list << Y2Issues::Issue.new("Something is missing", severity: :warn)
      end

      it "includes issues messages" do
        issue = list.first
        expect(presenter.to_html.to_s).to include "<li>#{issue.message}</li>"
      end

      it "includes an introduction to the warnings list" do
        expect(presenter.to_html.to_s).to include "<p>Minor issues"
      end
    end

    it "groups elements from the same location"
  end
end
