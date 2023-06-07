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
require "agama/dbus/storage/zfcp_controllers_tree"
require "agama/storage/zfcp/manager"
require "agama/storage/zfcp/controller"
require "dbus"

describe Agama::DBus::Storage::ZFCPControllersTree do
  subject { described_class.new(service, manager, logger: logger) }

  let(:service) { instance_double(::DBus::ObjectServer) }

  let(:manager) { Agama::Storage::ZFCP::Manager.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(service).to receive(:get_node).with(described_class::ROOT_PATH, anything)
      .and_return(root_node)

    allow(root_node).to receive(:descendant_objects).and_return(dbus_objects)
  end

  let(:root_node) { instance_double(::DBus::Node) }

  let(:dbus_objects) { [] }

  describe "#objects=" do
    let(:dbus_objects) { [dbus_object1, dbus_object2] }

    let(:dbus_object1) do
      Agama::DBus::Storage::ZFCPController.new(manager, controller1, "", logger: logger)
    end

    let(:dbus_object2) do
      Agama::DBus::Storage::ZFCPController.new(manager, controller2, "", logger: logger)
    end

    let(:controller1) { Agama::Storage::ZFCP::Controller.new("0.0.fa00") }

    let(:controller2) { Agama::Storage::ZFCP::Controller.new("0.0.fb00") }

    before do
      allow(service).to receive(:export)
      allow(service).to receive(:unexport)

      allow_any_instance_of(::DBus::Object).to receive(:interfaces_and_properties).and_return({})
      allow_any_instance_of(::DBus::Object).to receive(:dbus_properties_changed)
    end

    context "if a given zFCP controller is not exported yet" do
      let(:controllers) { [controller3] }

      let(:controller3) { Agama::Storage::ZFCP::Controller.new("0.0.fc00") }

      it "exports a new controller D-Bus object" do
        expect(service).to receive(:export) do |dbus_object|
          expect(dbus_object.path).to match(/#{described_class::ROOT_PATH}\/[0-9]+/)
        end

        subject.objects = controllers
      end
    end

    context "if a given zFCP controller is already exported" do
      # controller2 is equal to controller3 (same channel)
      let(:controllers) { [controller3] }

      let(:controller3) { Agama::Storage::ZFCP::Controller.new("0.0.fb00") }

      it "updates the D-Bus object" do
        expect(dbus_object2.controller).to_not eq(controller3)

        subject.objects = controllers

        expect(dbus_object2.controller).to eq(controller3)
      end
    end

    context "if an exported D-Bus object does not represent any of the given zFCP controllers" do
      # There is a D-Bus object for controller2 but controller2 is missing in the givem list of
      # controllers.
      let(:controllers) { [controller1] }

      it "unexports the D-Bus object" do
        expect(service).to receive(:unexport).with(dbus_object2)

        subject.objects = controllers
      end
    end
  end
end
