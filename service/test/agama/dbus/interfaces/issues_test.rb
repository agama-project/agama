# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "dbus"
require "agama/dbus/interfaces/issues"
require "agama/issue"

class DBusObjectWithIssuesInterface < DBus::Object
  include Agama::DBus::Interfaces::Issues

  def initialize
    super("org.opensuse.Agama.UnitTests")
  end

  def issues
    [
      Agama::Issue.new("Issue 1", details: "Details 1"),
      Agama::Issue.new("Issue 2", details: "Details 2", kind: :missing_product)
    ]
  end
end

describe DBusObjectWithIssuesInterface do
  let(:issues_interface) do
    Agama::DBus::Interfaces::Issues::ISSUES_INTERFACE
  end

  it "defines Issues D-Bus interface" do
    expect(subject.intfs.keys).to include(issues_interface)
  end

  describe "#dbus_issues" do
    it "returns the info of all issues" do
      result = subject.dbus_issues

      expect(result).to contain_exactly(
        ["Issue 1", "generic", "Details 1"],
        ["Issue 2", "missing_product", "Details 2"]
      )
    end
  end

  describe "#issues_properties_changed" do
    it "emits a properties changed signal for issues" do
      expect(subject).to receive(:dbus_properties_changed)
        .with(issues_interface, anything, anything)

      subject.issues_properties_changed
    end
  end
end
