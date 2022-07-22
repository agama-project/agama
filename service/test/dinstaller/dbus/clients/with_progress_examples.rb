# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

shared_examples "progress" do
  describe "#on_progress_change" do
    before do
      allow(dbus_object).to receive(:path).and_return("/org/opensuse/DInstaller/Test")
      allow(dbus_object).to receive(:[]).with("org.freedesktop.DBus.Properties")
        .and_return(properties_iface)
      allow(properties_iface).to receive(:on_signal)
    end

    let(:properties_iface) { instance_double(::DBus::ProxyObjectInterface) }

    context "if there are no callbacks for changes in properties" do
      it "subscribes to properties change signal" do
        expect(properties_iface).to receive(:on_signal)
        subject.on_progress_change { "test" }
      end
    end

    context "if there already are callbacks for changes in properties" do
      before do
        subject.on_progress_change { "test" }
      end

      it "does not subscribe to properties change signal again" do
        expect(properties_iface).to_not receive(:on_signal)
        subject.on_progress_change { "test" }
      end
    end
  end
end
