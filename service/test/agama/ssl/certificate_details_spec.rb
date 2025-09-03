#! /usr/bin/env rspec
# frozen_string_literal: true

require_relative "../../test_helper"

require "agama/ssl/certificate"
require "agama/ssl/certificate_details"

describe "Agama::SSL::CertificateDetails" do
  subject do
    Agama::SSL::CertificateDetails.new(
      Agama::SSL::Certificate.load_file(File.join(FIXTURES_PATH, "test.pem"))
    )
  end

  let(:identity) do
    <<~IDENTITY
      Common Name (CN): linux-1hyn
      Organization (O): WebYaST
      Organization Unit (OU): WebYaST
    IDENTITY
  end

  let(:sha256sum) do
    "2A:02:DA:EC:A9:FF:4C:B4:A6:C0:57:08:F6:1C:8B:B0:94:FA:" \
      "F4:60:96:5E:18:48:CA:84:81:48:60:F3:CB:BF"
  end
  let(:sha1sum) { "A8:DE:08:B1:57:52:FE:70:DF:D5:31:EA:E3:53:BB:39:EE:01:FF:B9" }

  describe ".#subject" do
    it "returns textual summary of the certificate subject" do
      expect(subject.subject).to eq(identity)
    end
  end

  describe "#issuer" do
    it "return textual summary of the certificate issuer" do
      expect(subject.issuer).to eq(identity)
    end
  end

  describe "#summary" do
    it "returns textual summary of the whole certificate" do
      # rubocop:disable Layout/TrailingWhitespace
      expect(subject.summary).to eq(<<~CERT.chomp
        Certificate:
        Issued To
        #{identity}
        Issued By
        #{identity}
        SHA1 Fingerprint: 
           #{sha1sum}
        SHA256 Fingerprint: 
           #{sha256sum}
      CERT
                                   )
      # rubocop:enable Layout/TrailingWhitespace
    end
  end
end
