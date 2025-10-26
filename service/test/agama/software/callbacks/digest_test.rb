# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/software/callbacks/digest"
require "agama/http/clients"
require "agama/answer"
require "agama/question"

describe Agama::Software::Callbacks::Digest do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:question) { instance_double(Agama::Question, answer: answer) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(questions_client).to receive(:ask).and_yield(answer)
  end

  describe "#accept_file_without_checksum" do
    let(:answer) { Agama::Answer.new(subject.yes_label) }

    it "registers a question informing of the error" do
      expect(questions_client).to receive(:ask) do |q|
        expect(q.text).to match("No checksum for the file repomd.xml")
      end
      subject.accept_file_without_checksum("repomd.xml")
    end

    context "when the user answers :Yes" do
      let(:answer) { Agama::Answer.new(subject.yes_label) }

      it "returns true" do
        expect(subject.accept_file_without_checksum("repomd.xml")).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { Agama::Answer.new(subject.no_label) }

      it "returns false" do
        expect(subject.accept_file_without_checksum("repomd.xml")).to eq(false)
      end
    end
  end

  describe "#accept_unknown_digest" do
    let(:answer) { Agama::Answer.new(subject.yes_label) }

    it "registers a question informing of the error" do
      expect(questions_client).to receive(:ask) do |q|
        expect(q.text).to include("The checksum of the file repomd.xml is \"123456\"")
      end
      subject.accept_unknown_digest("repomd.xml", "123456")
    end

    context "when the user answers :Yes" do
      let(:answer) { Agama::Answer.new(subject.yes_label) }

      it "returns true" do
        expect(subject.accept_unknown_digest("repomd.xml", "123456")).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { Agama::Answer.new(subject.no_label) }

      it "returns false" do
        expect(subject.accept_unknown_digest("repomd.xml", "123456")).to eq(false)
      end
    end
  end

  describe "#accept_wrong_digest" do
    let(:answer) { Agama::Answer.new(subject.yes_label) }

    it "registers a question informing of the error" do
      expect(questions_client).to receive(:ask) do |q|
        expect(q.text).to match(
          /The expected checksum of file repomd.xml is "654321".*expected.*"123456"/
        )
      end
      subject.accept_wrong_digest("repomd.xml", "123456", "654321")
    end

    context "when the user answers :Yes" do
      let(:answer) { Agama::Answer.new(subject.yes_label) }

      it "returns true" do
        expect(subject.accept_wrong_digest("repomd.xml", "123456", "654321")).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { Agama::Answer.new(subject.no_label) }

      it "returns false" do
        expect(subject.accept_wrong_digest("repomd.xml", "123456", "654321")).to eq(false)
      end
    end
  end
end
