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
require "agama/software/callbacks/signature"
require "agama/http/clients"
require "agama/question"
require "agama/answer"

describe Agama::Software::Callbacks::Signature do
  before do
    allow(questions_client).to receive(:ask).and_yield(answer)
  end

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:question) { instance_double(Agama::Question, answer: answer) }

  let(:answer) { nil }

  let(:logger) { Logger.new($stdout, level: :warn) }

  subject { described_class.new(questions_client, logger) }

  describe "#accept_unsigned_file" do
    context "when the user answers :Yes" do
      let(:answer) { Agama::Answer.new(:Yes) }

      it "returns true" do
        expect(subject.accept_unsigned_file("repomd.xml", -1)).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { Agama::Answer.new(:No) }

      it "returns false" do
        expect(subject.accept_unsigned_file("repomd.xml", -1)).to eq(false)
      end
    end

    context "when the repo information is available" do
      before do
        allow(Yast::Pkg).to receive(:SourceGeneralData).with(1)
          .and_return("name" => "OSS", "url" => "http://localhost/repo")
      end

      it "includes the name and the URL in the question" do
        expect(questions_client).to receive(:ask) do |question|
          expect(question.text).to include("repomd.xml from http://localhost/repo")
        end

        expect(subject.accept_unsigned_file("repomd.xml", 1))
      end
    end

    context "when the repo information is not available" do
      before do
        allow(Yast::Pkg).to receive(:SourceGeneralData).with(1).and_return(nil)
      end

      it "includes a generic message containing the filename" do
        expect(questions_client).to receive(:ask) do |question|
          expect(question.text).to include("repomd.xml")
        end

        expect(subject.accept_unsigned_file("repomd.xml", 1))
      end
    end
  end

  describe "import_gpg_key" do
    let(:answer) { Agama::Answer.new("Trust") }

    let(:key) do
      {
        "id"          => "0123456789ABCDEF",
        "fingerprint" => "2E2EA448C9DDD7A91BC28441AEE969E90F05DB9D",
        "name"        => "YaST:Head:Agama"
      }
    end

    context "when the user answers :Trust" do
      let(:answer) { Agama::Answer.new(:Trust) }

      it "returns true" do
        expect(subject.import_gpg_key(key, 1)).to eq(true)
      end
    end

    context "when the user answers :Skip" do
      let(:answer) { Agama::Answer.new(:Skip) }

      it "returns false" do
        expect(subject.import_gpg_key(key, 1)).to eq(false)
      end
    end

    it "includes a message" do
      expect(questions_client).to receive(:ask) do |question|
        expect(question.text).to include(key["id"])
        expect(question.text).to include(key["name"])
        expect(question.text).to include("2E2E A448 C9DD")
      end
      subject.import_gpg_key(key, 1)
    end
  end

  describe "#accept_unknown_gpg_key" do
    context "when the user answers :Yes" do
      let(:answer) { Agama::Answer.new(:Yes) }

      it "returns true" do
        expect(subject.accept_unknown_gpg_key("repomd.xml", "KEYID", 1)).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { Agama::Answer.new(:No) }

      it "returns false" do
        expect(subject.accept_unknown_gpg_key("repomd.xml", "KEYID", 1)).to eq(false)
      end
    end

    context "when the repo information is available" do
      before do
        allow(Yast::Pkg).to receive(:SourceGeneralData).with(1)
          .and_return("name" => "OSS", "url" => "http://localhost/repo")
      end

      it "includes the name and the URL in the question" do
        expect(questions_client).to receive(:ask) do |question|
          expect(question.text).to include("repomd.xml from http://localhost/repo")
        end

        expect(subject.accept_unknown_gpg_key("repomd.xml", "KEYID", 1))
      end
    end

    context "when the repo information is not available" do
      before do
        allow(Yast::Pkg).to receive(:SourceGeneralData).with(1).and_return(nil)
      end

      it "includes a generic message containing the filename" do
        expect(questions_client).to receive(:ask) do |question|
          expect(question.text).to include("repomd.xml")
        end

        expect(subject.accept_unknown_gpg_key("repomd.xml", "KEYID", 1))
      end
    end
  end

  describe "accept_verification_failed" do
    let(:answer) { Agama::Answer.new(:Trust) }

    let(:key) do
      {
        "id"          => "0123456789ABCDEF",
        "fingerprint" => "2E2EA448C9DDD7A91BC28441AEE969E90F05DB9D",
        "name"        => "YaST:Head:Agama"
      }
    end

    let(:filename) { "repomd.xml" }

    context "when the user answers :Yes" do
      let(:answer) { Agama::Answer.new(:Yes) }

      it "returns true" do
        expect(subject.accept_verification_failed(filename, key, 1)).to eq(true)
      end
    end

    context "when the user answers :No" do
      let(:answer) { Agama::Answer.new(:No) }

      it "returns false" do
        expect(subject.accept_verification_failed(filename, key, 1)).to eq(false)
      end
    end

    it "includes a message" do
      expect(questions_client).to receive(:ask) do |question|
        expect(question.text).to include(key["id"])
        expect(question.text).to include(key["name"])
      end
      subject.accept_verification_failed(filename, key, 1)
    end
  end
end
