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
require "dinstaller/software/callbacks/media"
require "dinstaller/dbus/clients/questions_manager"
require "dinstaller/question"

describe DInstaller::Software::Callbacks::Media do
  subject { described_class.new(questions_manager, logger) }

  let(:questions_manager) do
    instance_double(DInstaller::DBus::Clients::QuestionsManager)
  end

  let(:logger) { Logger.new($stdout) }

  describe "#media_changed" do
    let(:asked_question) do
      instance_double(DInstaller::Question, text: "Better safe than sorry", answer: answer)
    end
    let(:answer) { :Retry }

    before do
      allow(subject).to receive(:ask).and_yield(asked_question)
    end

    context "when the user answers :Retry" do
      it "returns ''" do
        ret = subject.media_change(
          "NOT_FOUND", "Package not found", "", "", 0, "", 0, "", true, [], 0
        )
        expect(ret).to eq("")
      end
    end

    context "when the user answers :Skip" do
      let(:answer) { :Skip }

      it "returns 'S'" do
        ret = subject.media_change(
          "NOT_FOUND", "Package not found", "", "", 0, "", 0, "", true, [], 0
        )
        expect(ret).to eq("S")
      end
    end
  end
end
