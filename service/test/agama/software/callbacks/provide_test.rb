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
require "agama/software/callbacks/provide"
require "agama/dbus/clients/questions"
require "agama/dbus/clients/question"

describe Agama::Software::Callbacks::Provide do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::DBus::Clients::Questions) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:answer) { subject.retry_label.to_sym }

  describe "#done_provide" do
    before do
      allow(questions_client).to receive(:ask).and_yield(question_client)
      allow(question_client).to receive(:answer).and_return(answer)
    end

    let(:question_client) { instance_double(Agama::DBus::Clients::Question) }

    context "when the file is not found" do
      it "does not register a question" do
        expect(questions_client).to_not receive(:ask)
        subject.done_provide(1, "Some dummy reason", "dummy-package")
      end
    end

    context "when the there is an I/O error" do
      it "registers a question informing of the error" do
        expect(questions_client).to receive(:ask) do |q|
          expect(q.text).to include("could not be downloaded")
        end
        subject.done_provide(2, "Some dummy reason", "dummy-package")
      end
    end

    context "when the there is an I/O error" do
      it "registers a question informing of the error" do
        expect(questions_client).to receive(:ask) do |q|
          expect(q.text).to include("integrity check has failed")
        end
        subject.done_provide(3, "Some dummy reason", "dummy-package")
      end
    end

    context "when the user answers :Retry" do
      let(:answer) { subject.retry_label.to_sym }

      it "returns 'R'" do
        ret = subject.done_provide(
          2, "Some dummy reason", "dummy-package"
        )
        expect(ret).to eq("R")
      end
    end

    context "when the user answers :Skip" do
      let(:answer) { subject.continue_label.to_sym }

      it "returns 'I'" do
        ret = subject.done_provide(
          2, "Some dummy reason", "dummy-package"
        )
        expect(ret).to eq("I")
      end
    end
  end
end
