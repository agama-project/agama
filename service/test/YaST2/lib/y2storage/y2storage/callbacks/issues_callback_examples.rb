# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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

RSpec.shared_examples "#issues" do
  it "returns a list of issues" do
    expect(subject.issues).to be_a(Y2Issues::List)
  end

  it "contains as many issues as errors reported by libstorage-ng" do
    # unary +"..." to get mutable copies: #error calls #force_encoding on both arguments
    subject.error(+"first", +"the first error")
    subject.error(+"second", +"the second error")

    expect(subject.issues.size).to eq(2)
    expect(subject.issues.map(&:message)).to contain_exactly("first", "second")
  end
end

RSpec.shared_examples "#error" do
  # unary +"..." to get mutable copies: #error calls #force_encoding on the given message
  let(:msg) { +"the message" }
  let(:what) { +"the what" }

  it "generates an issue with the reported message and details" do
    subject.error(msg, what)

    expect(subject.issues.size).to eq(1)

    issue = subject.issues.first

    expect(issue.message).to eq(msg)
    expect(issue.details).to eq(what)
  end

  # SWIG returns ASCII-8BIT encoded strings even if they contain UTF-8 characters
  # see https://sourceforge.net/p/swig/feature-requests/89/
  it "handles ASCII-8BIT encoded messages with UTF-8 characters" do
    subject.error(
      (+"testing UTF-8 message: 🍺").force_encoding("ASCII-8BIT"),
      (+"details: 🍻").force_encoding("ASCII-8BIT")
    )

    issue = subject.issues.first

    expect(issue.message).to match(/🍺/)
    expect(issue.details).to match(/🍻/)
  end

  it "returns true" do
    expect(subject.error(msg, what)).to eq(true)
  end
end
