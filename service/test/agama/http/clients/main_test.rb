# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/http/clients/main"

describe Agama::HTTP::Clients::Main do
  subject(:main) { described_class.new(Logger.new($stdout)) }
  let(:response) { instance_double(Net::HTTPResponse, body: "") }

  before do
    allow(File).to receive(:read).with("/run/agama/token")
      .and_return("123456")
  end

  describe "#set_resolvables" do
    it "calls the end-point to set resolvables" do
      url = URI("http://localhost/api/v2/private/resolvables/storage")
      data = [{ "name" => "btrfsprogs", "type" => "package" }].to_json
      expect(Net::HTTP).to receive(:put).with(url, data, {
        "Content-Type": "application/json",
        Authorization:  "Bearer 123456"
      }).and_return(response)
      main.set_resolvables("storage", "package", ["btrfsprogs"])
    end
  end
end
