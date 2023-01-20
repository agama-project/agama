# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "dinstaller/dbus/questions"
require "dinstaller/questions_manager"
require "dinstaller/question"
require "dinstaller/luks_activation_question"
require "dbus"

describe DInstaller::DBus::Questions do
  subject { described_class.new(backend, logger) }

  before do
    subject.instance_variable_set(:@service, service)
  end

  let(:backend) { DInstaller::QuestionsManager.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:service) { instance_double(DBus::Service, export: nil, unexport: nil, bus: system_bus) }

  let(:system_bus) { instance_double(DBus::SystemBus) }

  it "configures callbacks for exporting a D-Bus question when a new question is added" do
    question1 = DInstaller::Question.new("test1")
    question2 = DInstaller::Question.new("test2")

    expect(service).to receive(:export) do |dbus_object|
      id = dbus_object.path.split("/").last.to_i
      expect(id).to eq(question1.id)
    end

    expect(service).to receive(:export) do |dbus_object|
      id = dbus_object.path.split("/").last.to_i
      expect(id).to eq(question2.id)
    end

    backend.add(question1)
    backend.add(question2)
  end

  it "configures callbacks for unexporting a D-Bus question when a question is deleted" do
    dbus_objects = []
    question1 = DInstaller::Question.new("test1")
    question2 = DInstaller::Question.new("test2")

    expect(service).to receive(:export).twice do |dbus_object|
      dbus_objects << dbus_object
    end

    backend.add(question1)
    backend.add(question2)

    expect(service)
      .to receive(:descendants_for)
      .with("/org/opensuse/DInstaller/Questions1")
      .and_return(dbus_objects)

    expect(service).to receive(:unexport) do |dbus_object|
      id = dbus_object.path.split("/").last.to_i
      expect(id).to eq(question1.id)
    end

    backend.delete(question1)
  end

  describe "#managed_objects" do
    before do
      allow(subject).to receive(:InterfacesAdded)

      backend.add(question1)
      backend.add(question2)
    end

    let(:question1) { DInstaller::Question.new("test1") }
    let(:question2) { DInstaller::LuksActivationQuestion.new("/dev/sda1") }

    it "returns interfaces and properties for each exported question" do
      result = subject.managed_objects

      path1 = "/org/opensuse/DInstaller/Questions1/#{question1.id}"
      path2 = "/org/opensuse/DInstaller/Questions1/#{question2.id}"

      expect(result.keys).to contain_exactly(path1, path2)

      expect(result[path1].keys).to contain_exactly(
        "org.freedesktop.DBus.Properties",
        "org.opensuse.DInstaller.Question1"
      )

      expect(result[path2].keys).to contain_exactly(
        "org.freedesktop.DBus.Properties",
        "org.opensuse.DInstaller.Question1",
        "org.opensuse.DInstaller.Question.LuksActivation1"
      )

      expect(result[path1]["org.freedesktop.DBus.Properties"].keys).to be_empty
      expect(result[path1]["org.opensuse.DInstaller.Question1"].keys).to contain_exactly(
        "Id", "Text", "Options", "DefaultOption", "Answer"
      )
      expect(result[path2]["org.opensuse.DInstaller.Question.LuksActivation1"].keys)
        .to contain_exactly("Attempt", "Password")
    end
  end

  describe "Questions interface" do
    let(:interface) { "org.opensuse.DInstaller.Questions1" }
    let(:full_method_name) { described_class.make_method_name(interface, method_name) }

    describe "#New" do
      let(:method_name) { "New" }

      it "adds a question and returns its path" do
        expect(backend).to receive(:add)
        expect(subject.public_send(full_method_name, "How you doin?", ["fine", "great"], []))
          .to start_with "/org/opensuse/DInstaller/Questions1/"
      end
    end

    describe "#NewLuksActivation" do
      let(:method_name) { "NewLuksActivation" }

      it "adds a question and returns its path" do
        expect(backend).to receive(:add)
        expect(subject.public_send(full_method_name, "/dev/tape1", "New games", "90 minutes", 1))
          .to start_with "/org/opensuse/DInstaller/Questions1/"
      end
    end

    describe "#Delete" do
      let(:method_name) { "Delete" }

      it "deletes the question" do
        q = DInstaller::Question.new("Huh?", options: [])
        path = "/org/opensuse/DInstaller/Questions1/666"
        dbus_q = DInstaller::DBus::Question.new(path, q, logger)
        node = instance_double(DBus::Node, object: dbus_q)

        expect(service).to receive(:get_node).with(path).and_return(node)
        expect(backend).to receive(:delete).with(q)
        expect { subject.public_send(full_method_name, path) }.to_not raise_error
      end
    end
  end
end
