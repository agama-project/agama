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

require_relative "test_helper"

Yast.import "Desktop"

describe Yast::Desktop do
  describe "#Modules" do
    around { |e| change_scr_root(DESKTOP_DATA_PATH, &e) }

    before do
      Yast::Desktop.Read(["Name"])
    end

    it "returns modules information using the short name as key" do
      expect(Yast::Desktop.Modules).to eq(
        "add-on"           => { "Name" => "YaST Add-On Products" },
        "lan"              => { "Name" => "YaST Network" },
        "services-manager" => { "Name" => "YaST Services Manager" },
        "sw-single"        => { "Name" => "YaST Software Management" },
        "s390-extra"       => { "Name" => "YaST S390 Extra" },
        "dns-server"       => { "Name" => "YaST DNS Server" }
      )
    end
  end

  describe ".ModuleList" do
    around { |e| change_scr_root(DESKTOP_DATA_PATH, &e) }

    let(:read_values) do
      # TODO: really MEH API, copy of menu.rb list
      [
        "GenericName",
        # not required: "Comment",
        "X-SuSE-YaST-Argument",
        "X-SuSE-YaST-Call",
        "X-SuSE-YaST-Group",
        "X-SuSE-YaST-SortKey",
        "X-SuSE-YaST-RootOnly",
        "X-SuSE-YaST-WSL",
        "Hidden"
      ]
    end

    before do
      Yast::Desktop.Read(read_values)
      # as changed scr does not have groups desktop, define it manually here
      Yast::Desktop.Groups = { "Software" => { "modules" => ["add-on", "sw-single"] } }
    end

    context "on WSL" do
      before do
        allow(Yast::Arch).to receive(:is_wsl).and_return(true)
      end

      it "returns only whitelisted modules" do
        expect(Yast::Desktop.ModuleList("Software")).to eq [Yast::Term.new(:item, Yast::Term.new(:id, "sw-single"), "Software Management")]
      end
    end

    context "outside of WSL" do
      before do
        allow(Yast::Arch).to receive(:is_wsl).and_return(false)
      end

      it "ignores WSL whitelisting" do
        expect(Yast::Desktop.ModuleList("Software")).to eq [
          Yast::Term.new(:item, Yast::Term.new(:id, "sw-single"), "Software Management"),
          Yast::Term.new(:item, Yast::Term.new(:id, "add-on"), "Add-On Products")
        ]
      end
    end
  end
end
