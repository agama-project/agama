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

shared_examples "issues" do
  describe "#issues=" do
    let(:issues) { [Agama::Issue.new("Issue 1"), Agama::Issue.new("Issue 2")] }

    it "sets the given list of issues" do
      subject.issues = issues

      expect(subject.issues).to contain_exactly(
        an_object_having_attributes(description: /Issue 1/),
        an_object_having_attributes(description: /Issue 2/)
      )
    end

    it "executes the on_issues_change callbacks" do
      callback = proc {}
      subject.on_issues_change(&callback)

      expect(callback).to receive(:call)

      subject.issues = issues
    end
  end
end
