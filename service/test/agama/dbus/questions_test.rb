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
require "agama/dbus/questions"
require "agama/question"
require "agama/luks_activation_question"
require "dbus"

describe Agama::DBus::Questions do
  before do
    subject.instance_variable_set(:@service, service)
  end

  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:service) { instance_double(DBus::Service, export: nil, unexport: nil, bus: system_bus) }

  let(:system_bus) { instance_double(DBus::SystemBus) }

  describe "Questions interface" do
    let(:interface) { "org.opensuse.DInstaller.Questions1" }
    let(:full_method_name) { described_class.make_method_name(interface, method_name) }

    describe "#New" do
      let(:method_name) { "New" }

      it "exports a question and returns its path" do
        expect(service).to receive(:export) do |question|
          expect(question).is_a?(Agama::DBus::Question)
          expect(question.backend).is_a?(Agama::Question)
          expect(question.text).to match(/How you doin/)
        end

        result = subject.public_send(full_method_name, "How you doin?", ["fine", "great"], [])

        expect(result).to start_with("/org/opensuse/DInstaller/Questions1/")
      end
    end

    describe "#NewLuksActivation" do
      let(:method_name) { "NewLuksActivation" }

      it "exports a question and returns its path" do
        expect(service).to receive(:export) do |question|
          expect(question).is_a?(Agama::DBus::Question)
          expect(question).is_a?(Agama::LuksActivationQuestion)
        end

        result = subject.public_send(full_method_name, "/dev/tape1", "New games", "90 minutes", 1)

        expect(result).to start_with("/org/opensuse/DInstaller/Questions1/")
      end
    end

    describe "#Delete" do
      let(:method_name) { "Delete" }

      before do
        allow(service).to receive(:get_node).with(path).and_return(node)
      end

      context "when the given object path does not exist" do
        let(:path) { "/org/opensuse/DInstaller/Questions1/666" }
        let(:node) { nil }

        it "raises an error" do
          expect { subject.public_send(full_method_name, path) }.to raise_error(/not found/)
        end
      end

      context "when the given object path is not a question" do
        let(:path) { "/org/opensuse/DInstaller/Foo/1" }
        let(:node) { instance_double(DBus::Node, object: dbus_object) }
        let(:dbus_object) { "test" }

        it "raises an error" do
          expect { subject.public_send(full_method_name, path) }.to raise_error(/not a Question/)
        end
      end

      context "when the given object path is a question" do
        let(:path) { "/org/opensuse/DInstaller/Questions1/1" }
        let(:node) { instance_double(DBus::Node, object: dbus_object) }
        let(:dbus_object) { Agama::DBus::Question.new(path, question, logger) }
        let(:question) { Agama::Question.new("Do you want to test?", options: [:yes, :no]) }

        it "unexports the question" do
          expect(service).to receive(:unexport).with(dbus_object)

          subject.public_send(full_method_name, path)
        end
      end
    end
  end
end
