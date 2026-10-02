# frozen_string_literal: true

# Vendored from yast2-bootloader's test/grub2pwd_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/grub2pwd"

ENCRYPTED_PASSWORD = "grub.pbkdf2.sha512.10000.774E325959D6D7BCFB7384A0245674D83D0D540A89C02FEA81" \
                     "E35489F8DE7ADFD93988190AD9857A0FFF363825DDF97C8F4E658D8CC49FC4A22C053B08AB3" \
                     "EFE.6FB19FF26FD03D85C40A33D8BA7C04E72EDE3DD5D7080C177553A4FED370F71C579AF0B" \
                     "15B3B93ECECEA355469A4B6D0560BFB53ED35DDA0B80F5363BFBD54E4"

FILE_CONTENT_RESTRICTED = "#! /bin/sh\n" \
                          "exec tail -n +3 $0\n" \
                          "# File created by YaST and next YaST run probably overwrite it\n" \
                          "set superusers=\"root\"\n" \
                          "password_pbkdf2 root #{ENCRYPTED_PASSWORD}\n" \
                          "export superusers\n"

FILE_CONTENT_UNRESTRICTED = FILE_CONTENT_RESTRICTED +
  "set unrestricted_menu=\"y\"\n" \
  "export unrestricted_menu\n"

FILE_CONTENT_WRONG = "#! /bin/sh\n" \
                     "exec tail -n +3 $0\n" \
                     "# File created by YaST and next YaST run probably overwrite it\n" \

describe Bootloader::GRUB2Pwd do
  include_context "yast2-bootloader test setup"

  before do
    # by default use initial stage to get proposed values
    Yast.import "Stage"
    allow(Yast::Stage).to receive(:initial).and_return(true)
  end

  def mock_file_presence(exists)
    Yast.import "FileUtils"
    expect(Yast::FileUtils).to receive(:Exists).with("/etc/grub.d/42_password")
      .and_return(exists)
  end

  describe ".new" do
    context "in first stage" do
      before do
        allow(Yast::Stage).to receive(:initial).and_return(true)
      end

      it "propose to not use password" do
        expect(subject.used?).to eq false
      end

      it "propose to use unrestricted mode" do
        expect(subject.unrestricted?).to eq true
      end

      it "do not have any password used" do
        expect(subject.password?).to eq false
      end
    end

    context "outside of first stage" do
      before do
        allow(Yast::Stage).to receive(:initial).and_return(false)
      end

      context "Grub password generator file do not exists" do
        before do
          Yast.import "FileUtils"
          allow(Yast::FileUtils).to receive(:Exists)
            .with(described_class::PWD_ENCRYPTION_FILE)
            .and_return(false)
        end

        it "sets that password protection is not used" do
          expect(subject.used?).to eq false
        end

        it "propose to use unrestricted mode" do
          expect(subject.unrestricted?).to eq true
        end

        it "do not have any password used" do
          expect(subject.password?).to eq false
        end
      end

      context "Grub password generator file exists" do
        before do
          Yast.import "FileUtils"
          allow(Yast::FileUtils).to receive(:Exists)
            .with(described_class::PWD_ENCRYPTION_FILE)
            .and_return(true)

          allow(Yast::SCR).to receive(:Read)
            .with(path(".target.string"), described_class::PWD_ENCRYPTION_FILE)
            .and_return(FILE_CONTENT_RESTRICTED)
        end

        it "sets that password protection is used" do
          expect(subject.used?).to eq true
        end

        it "sets that password is specified" do
          expect(subject.password?).to eq true
        end

        it "sets unencrypted password value" do
          expect(subject.encrypted_password).to eq ENCRYPTED_PASSWORD
        end

        it "sets restricted mode as is specified in file" do
          allow(Yast::SCR).to receive(:Read)
            .with(path(".target.string"), described_class::PWD_ENCRYPTION_FILE)
            .and_return(FILE_CONTENT_RESTRICTED)

          expect(described_class.new.unrestricted?).to eq false

          allow(Yast::SCR).to receive(:Read)
            .with(path(".target.string"), described_class::PWD_ENCRYPTION_FILE)
            .and_return(FILE_CONTENT_UNRESTRICTED)

          expect(described_class.new.unrestricted?).to eq true
        end

        it "raises exception if file content is not correct" do
          allow(Yast::SCR).to receive(:Read)
            .with(path(".target.string"), described_class::PWD_ENCRYPTION_FILE)
            .and_return(FILE_CONTENT_WRONG)

          expect { described_class.new }.to raise_error(RuntimeError)
        end
      end
    end
  end

  describe "#write" do
    context "password protection disabled" do
      before do
        subject.used = false
      end

      it "deletes Grub password generator file" do
        Yast.import "FileUtils"
        allow(Yast::FileUtils).to receive(:Exists)
          .with(described_class::PWD_ENCRYPTION_FILE)
          .and_return(true)

        expect(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash"), "rm '#{described_class::PWD_ENCRYPTION_FILE}'")

        subject.write
      end

      it "does nothing if Grub password generator file does not exist" do
        Yast.import "FileUtils"
        expect(Yast::FileUtils).to receive(:Exists)
          .with(described_class::PWD_ENCRYPTION_FILE)
          .and_return(false)

        subject.write
      end
    end

    context "password protection enabled" do
      before do
        subject.used = true
        subject.unrestricted = false
        # set directly encrypted password
        subject.instance_variable_set(:@encrypted_password, ENCRYPTED_PASSWORD)
      end

      it "writes Grub password generator file" do
        expect(Yast::SCR).to receive(:Write)
          .with(
            path(".target.string"),
            [described_class::PWD_ENCRYPTION_FILE, 0o700],
            FILE_CONTENT_RESTRICTED
          )

        subject.write
      end

      it "writes unrestricted generator if unrestricted variable set on" do
        subject.unrestricted = true
        expect(Yast::SCR).to receive(:Write)
          .with(
            path(".target.string"),
            [described_class::PWD_ENCRYPTION_FILE, 0o700],
            FILE_CONTENT_UNRESTRICTED
          )

        subject.write
      end

      it "writes restricted generator if unrestricted variable set off" do
        subject.unrestricted = false
        expect(Yast::SCR).to receive(:Write)
          .with(
            path(".target.string"),
            [described_class::PWD_ENCRYPTION_FILE, 0o700],
            FILE_CONTENT_RESTRICTED
          )

        subject.write
      end

      it "raises exception if password configuration is proposed and password not set" do
        config = described_class.new
        config.used = true

        expect { config.write }.to raise_error(RuntimeError)
      end
    end
  end

  describe "#password=" do
    it "sets encrypted version of given password" do
      success_stdout = <<OUTPUT
      Enter password:

      Reenter password:
      PBKDF2 hash of your password is #{ENCRYPTED_PASSWORD}
OUTPUT

      expect(Yast::Execute).to receive(:on_target)
        .with(/grub2-mkpasswd/, anything)
        .and_return(success_stdout)
      subject.password = "really strong password"

      expect(subject.instance_variable_get(:@encrypted_password)).to eq ENCRYPTED_PASSWORD
    end
  end

  describe "#password?" do
    it "returns false if password configuration is proposed from scratch" do
      expect(subject.password?).to eq false
    end

    it "returns false if password is not enabled on disk" do
      allow(Yast::Stage).to receive(:initial).and_return(false)

      Yast.import "FileUtils"
      allow(Yast::FileUtils).to receive(:Exists)
        .with(described_class::PWD_ENCRYPTION_FILE)
        .and_return(false)

      expect(subject.password?).to eq false
    end

    it "returns true if password configuration exists on disk" do
      allow(Yast::Stage).to receive(:initial).and_return(false)

      Yast.import "FileUtils"
      allow(Yast::FileUtils).to receive(:Exists)
        .with(described_class::PWD_ENCRYPTION_FILE)
        .and_return(true)

      allow(Yast::SCR).to receive(:Read)
        .with(path(".target.string"), described_class::PWD_ENCRYPTION_FILE)
        .and_return(FILE_CONTENT_RESTRICTED)

      expect(subject.password?).to eq true
    end

    it "returns true if password explicitly set" do
      subject.instance_variable_set(:@encrypted_password, ENCRYPTED_PASSWORD)

      expect(subject.password?).to eq true
    end
  end
end
