# frozen_string_literal: true

# Copyright (c) [2022-2026] SUSE LLC
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

ENV["Y2DIR"] = [
  ENV.fetch("Y2DIR", nil),
  File.expand_path("../lib/agama/y2dir", __dir__),
  File.expand_path("../YaST2", __dir__)
].compact.join(":")

require "yast"
require "yast/rspec"

SRC_PATH = File.expand_path("../lib", __dir__)
FIXTURES_PATH = File.expand_path("fixtures", __dir__)
YAST2_LIB_PATH = File.expand_path("../YaST2/lib", __dir__)
$LOAD_PATH.unshift(SRC_PATH)
$LOAD_PATH.unshift(YAST2_LIB_PATH)

require "agama/product_reader" # to globally mock reading real products

# make sure we run the tests in English locale
# (some tests check the output which is marked for translation)
#
# Deliberately use LANG instead of LC_ALL here: POSIX locale precedence makes a non-empty LC_ALL
# win over every individual LC_* category (including LC_NUMERIC below), so setting LC_ALL would
# silently defeat the explicit "C" numeric formatting that some tests rely on.
ENV["LANG"] = "en_US.UTF-8"

# Builtins::Float.tolstring (the native yast2-ruby-bindings builtin backing
# Yast::String.FormatSize/FormatSizeWithPrecision) renders its thousands-separator according to
# the *current* process locale (unlike Encoding.default_external, which is fixed at Ruby
# interpreter startup and unaffected by ENV changes - see service/YaST2/README.md). Force plain
# "C" numeric formatting explicitly, so tests get deterministic output (e.g. "1024.091") instead
# of depending on whatever LC_NUMERIC the environment happens to default to (which may include a
# thousands separator, e.g. "1,024.091").
ENV["LC_NUMERIC"] = "C"

RSpec.configure do |c|
  c.before do
    allow(Agama::ProductReader).to receive(:new)
      .and_return(double(load_products: []))
  end
end

if ENV["COVERAGE"]
  require "simplecov"
  SimpleCov.start do
    add_filter "/test/"
  end

  # track all ruby files under src
  SimpleCov.track_files("#{SRC_PATH}/**/*.rb")

  # additionally use the LCOV format for on-line code coverage reporting at CI
  if ENV["CI"] || ENV["COVERAGE_LCOV"]
    require "simplecov-lcov"

    SimpleCov::Formatter::LcovFormatter.config do |c|
      c.report_with_single_file = true
      # this is the default Coveralls GitHub Action location
      # https://github.com/marketplace/actions/coveralls-github-action
      c.single_report_path = "coverage/lcov.info"
    end

    formatters = [
      SimpleCov::Formatter::HTMLFormatter, SimpleCov::Formatter::LcovFormatter
    ]
    SimpleCov.formatter = SimpleCov::Formatter::MultiFormatter.new(formatters)
  end
end
