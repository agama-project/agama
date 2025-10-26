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

require_relative "../test_helper"
require "agama/question"

describe Agama::Question do
  describe ".from_api" do
    let(:api_question) do
      {
        "text"          => "Do you want to decrypt the file system?",
        "class"         => "storage.luks",
        "actions"       => [
          { "id" => "decrypt", "label" => "Decrypt" },
          { "id" => "skip", "label" => "Skip" }
        ],
        "defaultAction" => "skip",
        "data"          => { "unsupported" => "general" }
      }
    end

    it "builds an instance from an API hash" do
      question = described_class.from_api(api_question)
      expect(question.text).to eq(api_question["text"])
      expect(question.qclass).to eq(api_question["class"])
      expect(question.options).to eq([:decrypt, :skip])
      expect(question.default_option).to eq(:skip)
      expect(question.data).to eq(api_question["data"])
      expect(question.id).to be_nil
    end

    context "if the question has an ID" do
      it "sets the ID" do
        question = described_class.from_api(api_question.merge("id" => 1))
        expect(question.id).to eq(1)
      end
    end

    context "if the question has an answer" do
      it "sets the answer" do
        with_answer = api_question.merge("answer" => { "action" => "yes", "value" => "secret" })
        question = described_class.from_api(with_answer)
        answer = question.answer
        expect(answer.action).to eq(:yes)
        expect(answer.value).to eq("secret")
      end
    end
  end
end
