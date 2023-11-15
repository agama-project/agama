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
    allow(service).to receive(:root).and_return(root_node)

    allow(dbus_object1).to receive(:[]).with("org.opensuse.Agama1.Issues")
      .and_return(issues_interface1)

    allow(dbus_object3).to receive(:[]).with("org.opensuse.Agama1.Issues")
      .and_return(issues_interface3)

    allow(issues_interface1).to receive(:[]).with("All").and_return(issues1)
    allow(issues_interface3).to receive(:[]).with("All").and_return(issues3)
  end

  let(:root_node) do
    instance_double(::DBus::Node, descendant_objects: [dbus_object1, dbus_object2, dbus_object3])
  end

  let(:dbus_object1) do
    instance_double(::DBus::ProxyObject,
      interfaces: ["org.opensuse.Agama1.Test", "org.opensuse.Agama1.Issues"])
  end

  let(:dbus_object2) do
    instance_double(::DBus::ProxyObject, interfaces: ["org.opensuse.Agama1.Test"])
  end

  let(:dbus_object3) do
    instance_double(::DBus::ProxyObject, interfaces: ["org.opensuse.Agama1.Issues"])
  end

  let(:issues_interface1) { instance_double(::DBus::ProxyObjectInterface) }

  let(:issues_interface3) { instance_double(::DBus::ProxyObjectInterface) }

  let(:issues1) do
    [
      ["Issue 1", "Details 1", 1, 0],
      ["Issue 2", "Details 2", 2, 1]
    ]
  end

  let(:issues3) do
    [
      ["Issue 3", "Details 3", 1, 0]
    ]
  end

  describe "#issues" do
    it "returns the list of issues from all objects" do
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
        ),
        an_object_having_attributes(
          description: "Issue 3",
          details:     "Details 3",
          source:      Agama::Issue::Source::SYSTEM,
          severity:    Agama::Issue::Severity::WARN
        )
      )
    end
  end

  describe "#errors?" do
    context "if there is any error" do
      it "returns true" do
        expect(subject.errors?).to eq(true)
      end
    end

    context "if there is no error" do
      let(:issues1) { [] }

      it "returns false" do
        expect(subject.errors?).to eq(false)
      end
    end
  end
end
