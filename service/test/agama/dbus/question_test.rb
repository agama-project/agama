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
require "agama/dbus/question"
require "agama/question"
require "agama/luks_activation_question"
require "dbus"

describe Agama::DBus::Question do
  subject { described_class.new(path, backend, logger) }

  before do
    # ruby-dbus.0.23.0.beta2 but avoid the writer to work with beta1
    subject.instance_variable_set(:@object_server, service)
    # ruby-dbus.0.23.0.beta1
    subject.instance_variable_set(:@connection, connection)
  end

  let(:path) { "/org/test" }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:service) { instance_double(DBus::ObjectServer, connection: connection) }

  let(:connection) { instance_double(DBus::Connection, emit: nil) }

  describe ".new" do
    shared_examples "Generic interface" do
      it "defines #id, #text, #options, #default_option, #answer" do
        expect(subject).to respond_to(:id, :text, :options, :default_option, :answer)
      end

      describe "#id" do
        it "returns the question id" do
          expect(subject.id).to eq(backend.id)
        end
      end

      describe "#text" do
        it "returns the question text" do
          expect(subject.text).to eq(backend.text)
        end
      end

      describe "#answer" do
        context "if the question has no answer" do
          it "returns an empty string" do
            expect(subject.answer).to eq("")
          end
        end

        context "if the question has an answer" do
          before do
            backend.answer = answer
          end

          let(:answer) { backend.options.first }

          it "returns the answer as string" do
            expect(subject.answer).to eq(answer.to_s)
          end
        end
      end

      describe "#answer=" do
        let(:answer) { backend.options.first.to_s }

        it "sets the given option as answer" do
          subject.answer = answer

          expect(backend.answer).to eq(answer.to_sym)
        end
      end
    end

    shared_examples "LuksActivation interface" do
      it "defines #luks_password" do
        expect(subject).to respond_to(:luks_password)
      end

      describe "#luks_password" do
        context "if the question has no password" do
          it "returns an empty string" do
            expect(subject.luks_password).to eq("")
          end
        end

        context "if the question has a password" do
          before do
            backend.password = "n0ts3cr3t"
          end

          it "returns the password" do
            expect(subject.luks_password).to eq("n0ts3cr3t")
          end
        end
      end

      describe "#luks_password=" do
        it "sets the given password" do
          subject.luks_password = "n0ts3cr3t"

          expect(backend.password).to eq("n0ts3cr3t")
        end
      end

      describe "#activation_attempt" do
        before do
          allow(backend).to receive(:attempt).and_return(2)
        end

        it "returns the current attempt" do
          expect(subject.activation_attempt).to eq(2)
        end
      end
    end

    let(:backend) { Agama::Question.new("test") }

    context "for a generic question" do
      let(:backend) do
        Agama::Question.new("test", options: options, default_option: default_option)
      end

      let(:options) { [:yes, :no] }

      let(:default_option) { nil }

      include_examples "Generic interface"

      describe "#options" do
        it "returns the question options as strings" do
          expect(subject.options).to contain_exactly("yes", "no")
        end
      end

      describe "#default_option" do
        context "if the question has no default option" do
          let(:default_option) { nil }

          it "returns an empty string" do
            expect(subject.default_option).to eq("")
          end
        end

        context "if the question has a default option" do
          let(:default_option) { :yes }

          it "returns the default option as string" do
            expect(subject.default_option).to eq("yes")
          end
        end
      end
    end

    context "for a question to activate a LUKS device" do
      let(:backend) { Agama::LuksActivationQuestion.new("/dev/sda1") }

      include_examples "Generic interface"
      include_examples "LuksActivation interface"

      describe "#options" do
        it "returns 'skip' and 'decrypt'" do
          expect(subject.options).to contain_exactly("skip", "decrypt")
        end
      end

      describe "#default_option" do
        it "returns an empty string" do
          expect(subject.default_option).to eq("")
        end
      end
    end
  end
end
