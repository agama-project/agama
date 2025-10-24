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

require_relative "../../../test_helper"
require "agama/software/callbacks/script"
require "agama/dbus/clients/questions"
require "agama/dbus/clients/question"

describe Agama::Software::Callbacks::Script do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::DBus::Clients::Questions) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:answer) { subject.retry_label.to_sym }

  let(:description) { "Some description" }

  describe "#script_problem" do
    before do
      allow(questions_client).to receive(:ask).and_yield(question_client)
      allow(question_client).to receive(:answer).and_return(answer)
    end

    let(:question_client) { instance_double(Agama::DBus::Clients::Question) }

    it "registers a question with the details" do
      expect(questions_client).to receive(:ask) do |q|
        expect(q.text).to include("running a package script")
        expect(q.data).to include(
          "details" => description
        )
      end
      subject.script_problem(description)
    end

    context "when the user asks to retry" do
      let(:answer) { subject.retry_label.to_sym }

      it "returns 'R'" do
        ret = subject.script_problem(description)
        expect(ret).to eq("R")
      end
    end

    context "when the user asks to continue" do
      let(:answer) { subject.continue_label.to_sym }

      it "returns 'I'" do
        ret = subject.script_problem(description)
        expect(ret).to eq("I")
      end
    end
  end
end
