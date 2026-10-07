# Copyright (c) [2019] SUSE LLC
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
require "cfa/login_defs"
require "tmpdir"

describe CFA::LoginDefs do
  subject(:login_defs) { described_class.new(file_path: file_path, file_handler: file_handler) }
  let(:file_path) { File.join(GENERAL_DATA_PATH, "login.defs-example") }
  let(:file_handler) { File }

  before { login_defs.load }

  describe "#load" do
    it "loads the file content" do
      file = described_class.load(file_path: file_path, file_handler: file_handler)
      expect(file.loaded?).to eq(true)
    end
  end

  describe "#save" do
    let(:file_path) { File.join(tmpdir, "login.defs.d", "70-yast.defs") }
    let(:tmpdir) { Dir.mktmpdir }

    after do
      FileUtils.remove_entry(tmpdir)
    end

    context "when the directory does not exist" do
      it "creates the directory" do
        login_defs.save
        expect(File).to be_directory(File.join(tmpdir, "login.defs.d"))
      end
    end

    context "when the directory exists" do
      before do
        FileUtils.mkdir(File.join(tmpdir, "login.defs.d"))
      end

      it "does not create the directory" do
        expect(Yast::Execute).to_not receive(:on_target).with("/usr/bin/mkdir", any_args)
        login_defs.save
      end
    end
  end

  ATTRS_VALUES = {
    character_class: "[A-Za-z_][A-Za-z0-9_.-]*",
    encrypt_method:  "SHA512",
    fail_delay:      "3",
    gid_max:         "60000",
    gid_min:         "1000",
    pass_max_days:   "99999",
    pass_min_days:   "0",
    pass_warn_age:   "7",
    sys_gid_max:     "499",
    sys_gid_min:     "100",
    sys_uid_max:     "499",
    sys_uid_min:     "100",
    uid_max:         "60000",
    uid_min:         "1000"
  }.freeze

  ATTRS_VALUES.each do |attr, value|
    describe "##{attr}" do
      it "returns the #{attr.upcase} value" do
        expect(login_defs.public_send(attr)).to eq(value)
      end
    end
  end

  describe "#present_attributes" do
    it "returns the list of present attributes" do
      expect(login_defs.present_attributes).to include(*ATTRS_VALUES.keys)
    end
  end

  describe "#conflicts" do
    subject(:other) { described_class.new(file_path: file_path, file_handler: file_handler) }

    before do
      other.encrypt_method = "SHA256"
    end

    it "returns the list of attributes with different values" do
      expect(login_defs.conflicts(other)).to eq([:encrypt_method])
    end
  end
end
