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

require_relative "../test_helper"
require "agama/users"

describe Agama::Users do
  subject(:storage) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout) }

  let(:users_config) { Y2Users::Config.new }

  before do
    allow(Y2Users::ConfigManager.instance).to receive(:target)
      .and_return(users_config)
  end

  describe "#assign_root_password" do
    let(:root_user) { instance_double(Y2Users::User) }

    context "when the password is encrypted" do
      it "sets the password as encrypted" do
        subject.assign_root_password("encrypted", true)
        root_user = users_config.users.root
        expect(root_user.password).to eq(Y2Users::Password.create_encrypted("encrypted"))
      end
    end

    context "when the password is not encrypted" do
      it "sets the password in clear text" do
        subject.assign_root_password("12345", false)
        root_user = users_config.users.root
        expect(root_user.password).to eq(Y2Users::Password.create_plain("12345"))
      end
    end
  end

  describe "#remove_root_password" do
    it "removes the password" do
      subject.assign_root_password("12345", false)
      expect { subject.remove_root_password }.to change { subject.root_password? }
        .from(true).to(false)
    end
  end

  describe "#root_password?" do
    it "returns true if the root password is set" do
      subject.assign_root_password("12345", false)
      expect(subject.root_password?).to eq(true)
    end

    it "returns false if the root password is not set" do
      expect(subject.root_password?).to eq(false)
    end

    it "returns true if the root password is set to nil" do
      subject.assign_root_password("", false)
      expect(subject.root_password?).to eq(false)
    end
  end

  describe "#assign_first_user" do
    context "when the options given do not present any issue" do
      it "adds the user to the user's configuration" do
        subject.assign_first_user("Jane Doe", "jane", "12345", false, {})
        user = users_config.users.by_name("jane")
        expect(user.full_name).to eq("Jane Doe")
        expect(user.password).to eq(Y2Users::Password.create_plain("12345"))
      end

      context "when a first user exists" do
        before do
          subject.assign_first_user("Jane Doe", "jane", "12345", false, {})
        end

        it "replaces the user with the new one" do
          subject.assign_first_user("John Doe", "john", "12345", false, {})

          user = users_config.users.by_name("jane")
          expect(user).to be_nil

          user = users_config.users.by_name("john")
          expect(user.full_name).to eq("John Doe")
        end
      end

      it "returns an empty array of issues" do
        issues = subject.assign_first_user("Jane Doe", "jane", "12345", false, {})
        expect(issues).to be_empty
      end
    end

    context "when the given arguments presents some critical error" do
      it "does not add the user to the config" do
        subject.assign_first_user("Jonh Doe", "john", "", false, {})
        user = users_config.users.by_name("john")
        expect(user).to be_nil
        subject.assign_first_user("Ldap user", "ldap", "12345", false, {})
        user = users_config.users.by_name("ldap")
        expect(user).to be_nil
      end

      it "returns an array with all the issues" do
        issues = subject.assign_first_user("Root user", "root", "12345", false, {})
        expect(issues.size).to eql(1)
      end
    end
  end

  describe "#remove_first_user" do
    before do
      subject.assign_first_user("Jane Doe", "jane", "12345", false, {})
    end

    it "removes the already defined first user" do
      expect { subject.remove_first_user }
        .to change { users_config.users.by_name("jane") }
        .from(Y2Users::User).to(nil)
    end
  end

  describe "#write" do
    let(:writer) { instance_double(Y2Users::Linux::Writer, write: issues) }
    let(:issues) { [] }

    let(:system_config) do
      user = Y2Users::User.create_system("messagebus")
      config = Y2Users::Config.new
      config.attach(user)
    end

    before do
      allow(Y2Users::ConfigManager.instance).to receive(:system)
        .with(force_read: true).and_return(system_config)
      allow(Y2Users::Linux::Writer).to receive(:new).and_return(writer)
      allow(Yast::Execute).to receive(:locally!)
    end

    it "writes system and installer defined users" do
      subject.assign_first_user("Jane Doe", "jane", "12345", false, {})

      expect(Y2Users::Linux::Writer).to receive(:new) do |target_config, _old_config|
        user_names = target_config.users.map(&:name)
        expect(user_names).to include("messagebus", "jane")
        writer
      end

      expect(writer).to receive(:write).and_return([])
      subject.write
    end

    context "if some issue occurs" do
      let(:issues) { [double("issue")] }

      it "logs the issue" do
        expect(logger).to receive(:error).with(/issue/)
        subject.write
      end
    end

    it "writes without /run bind mounted" do
      expect(Yast::Execute).to receive(:locally!).with(/umount/, anything)

      subject.write
    end

    describe "#issues" do
      context "when a root password is set" do
        before do
          subject.assign_root_password("123456", true)
        end

        it "returns an empty list" do
          expect(subject.issues).to be_empty
        end
      end

      context "when a first user is defined" do
        before do
          subject.assign_first_user("Jane Doe", "jdoe", "123456", false, {})
        end

        it "returns an empty list" do
          expect(subject.issues).to be_empty
        end
      end

      context "when a root SSH key is set" do
        before do
          subject.root_ssh_key = "ssh-rsa ..."
        end

        it "returns an empty list" do
          expect(subject.issues).to be_empty
        end
      end

      context "when neither a first user is defined nor the root password/SSH key is set" do
        it "returns the problem" do
          error = subject.issues.first
          expect(error.description).to match(/Defining a user/)
        end
      end
    end
  end
end
