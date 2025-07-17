# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
require "agama/config"
require "agama/storage/callbacks/activate_multipath"
require "agama/dbus/clients/questions"
require "agama/dbus/clients/question"

describe Agama::Storage::Callbacks::ActivateMultipath do
  subject { described_class.new(config, questions_client, logger) }

  let(:config) { Agama::Config.new(config_data) }
  let(:questions_client) { instance_double(Agama::DBus::Clients::Questions) }
  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#call" do
    before do
      allow(questions_client).to receive(:ask).and_yield(question_client)
    end

    let(:question_client) { instance_double(Agama::DBus::Clients::Question) }

    shared_examples "false without asking" do
      it "does not ask a question" do
        expect(questions_client).to_not receive(:ask)

        subject.call(real_multipath)
      end

      it "returns false" do
        expect(subject.call(real_multipath)).to eq(false)
      end
    end

    shared_examples "true without asking" do
      it "does not ask a question" do
        expect(questions_client).to_not receive(:ask)

        subject.call(real_multipath)
      end

      it "returns true" do
        expect(subject.call(real_multipath)).to eq(true)
      end
    end

    shared_examples "ask if multipath found" do
      context "if the devices do not look like real multipath" do
        let(:real_multipath) { false }

        include_examples "false without asking"
      end

      context "if the devices look like real multipath" do
        let(:real_multipath) { true }

        it "asks a question to activate multipath" do
          expect(questions_client).to receive(:ask) do |question|
            expect(question.text).to match(/activate multipath\?/)
          end

          subject.call(real_multipath)
        end

        context "and the question is answered as :yes" do
          before do
            allow(question_client).to receive(:answer).and_return(:yes)
          end

          it "returns true" do
            expect(subject.call(real_multipath)).to eq(true)
          end
        end

        context "and the question is answered as :no" do
          before do
            allow(question_client).to receive(:answer).and_return(:no)
          end

          it "returns false" do
            expect(subject.call(real_multipath)).to eq(false)
          end
        end
      end
    end

    context "when the config does not contain a multipath section" do
      let(:config_data) { {} }

      include_examples "ask if multipath found"
    end

    context "when the config contains an empty multipath section" do
      let(:config_data) { { "multipath" => {} } }

      include_examples "ask if multipath found"
    end

    context "when multipath->start is set to 'askIfFound'" do
      let(:config_data) { { "multipath" => { "start" => "askIfFound" } } }

      include_examples "ask if multipath found"
    end

    context "when multipath->start is set to 'yes'" do
      let(:config_data) { { "multipath" => { "start" => "yes" } } }

      context "if the devices look like real multipath" do
        let(:real_multipath) { true }

        include_examples "true without asking"
      end

      context "if the devices do not look like real multipath" do
        let(:real_multipath) { false }

        include_examples "true without asking"
      end
    end

    context "when multipath->start is set to 'no'" do
      let(:config_data) { { "multipath" => { "start" => "no" } } }

      context "if the devices look like real multipath" do
        let(:real_multipath) { true }

        include_examples "false without asking"
      end

      context "if the devices do not look like real multipath" do
        let(:real_multipath) { false }

        include_examples "false without asking"
      end
    end
  end
end
