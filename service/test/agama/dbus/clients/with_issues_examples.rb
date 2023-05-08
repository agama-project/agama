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

require_relative "../../../test_helper"
require "agama/issue"

shared_examples "issues" do
  before do
    allow(dbus_object).to receive(:path).and_return("/org/opensuse/Agama/Test")
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama1.Issues")
      .and_return(issues_properties)
  end

  let(:issues_properties) { { "All" => issues } }

  let(:issues) { [issue1, issue2] }
  let(:issue1) { ["Issue 1", "Details 1", 1, 0] }
  let(:issue2) { ["Issue 2", "Details 2", 2, 1] }

  describe "#issues" do
    it "returns the list of issues" do
      expect(subject.issues).to all(be_a(Agama::Issue))

      expect(subject.issues).to contain_exactly(
        an_object_having_attributes(
          description: "Issue 1",
          details:     "Details 1",
          source:      Agama::Issue::Source::SYSTEM,
          severity:    Agama::Issue::Severity::WARN
        ),
        an_object_having_attributes(
          description: "Issue 2",
          details:     "Details 2",
          source:      Agama::Issue::Source::CONFIG,
          severity:    Agama::Issue::Severity::ERROR
        )
      )
    end
  end

  describe "#errors?" do
    context "if there is any error" do
      let(:issues) { [issue2] }

      it "returns true" do
        expect(subject.errors?).to eq(true)
      end
    end

    context "if there is no error" do
      let(:issues) { [issue1] }

      it "returns false" do
        expect(subject.errors?).to eq(false)
      end
    end
  end
end
