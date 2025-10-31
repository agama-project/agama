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
require "agama/software/callbacks/media"
require "agama/http/clients"
require "agama/question"
require "agama/answer"

describe Agama::Software::Callbacks::Media do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:question) { instance_double(Agama::Question, answer: answer) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#media_changed" do
    before do
      allow(questions_client).to receive(:ask).and_yield(answer)

      # mock sleep() to speed up test
      allow(subject).to receive(:sleep)
    end

    context "when the user answers :Retry" do
      let(:answer) { Agama::Answer.new(subject.retry_label) }

      it "returns ''" do
        ret = subject.media_change(
          "NOT_FOUND", "Package not found", "", "", 0, "", 0, "", true, [], 0
        )
        expect(ret).to eq("")
      end
    end

    context "when the user answers :Skip" do
      let(:answer) { Agama::Answer.new(subject.continue_label.to_sym) }

      it "returns 'S'" do
        ret = subject.media_change(
          "NOT_FOUND", "Package not found", "", "", 0, "", 0, "", true, [], 0
        )
        expect(ret).to eq("S")
      end
    end

    context "when a timeout error occurs" do
      # actually not used, just required by the global "before"
      let(:answer) { nil }

      it "returns '' without asking" do
        expect(questions_client).to_not receive(:ask)
        ret = subject.media_change(
          "IO_SOFT", "Timeout", "", "", 0, "", 0, "", true, [], 0
        )
        expect(ret).to eq("")
      end
    end
  end
end
