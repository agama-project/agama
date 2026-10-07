#!/usr/bin/env rspec

require_relative "test_helper"

Yast.import "String"

describe Yast::String do
  before do
    # ensure proper default locale
    ENV["LANG"] = "C"
  end

  describe ".Quote" do
    it "returns empty string if nil passed" do
      expect(subject.Quote(nil)).to eq ""
    end

    it "returns all single quotes escaped" do
      expect(subject.Quote("")).to eq ""
      expect(subject.Quote("a")).to eq "a"
      expect(subject.Quote("a'b")).to eq "a'\\''b"
      expect(subject.Quote("a'b'c")).to eq "a'\\''b'\\''c"
    end
  end

  describe ".UnQuote" do
    it "returns empty string if nil passed" do
      expect(subject.UnQuote(nil)).to eq ""
    end

    it "returns unescaped single quotes" do
      expect(subject.UnQuote("")).to eq ""
      expect(subject.UnQuote("a")).to eq "a"
      expect(subject.UnQuote("a'\\''b")).to eq "a'b"
      expect(subject.UnQuote("a'\\''b'\\''c")).to eq "a'b'c"
      expect(subject.UnQuote("a'\\'''\\''b'\\''c")).to eq "a''b'c"
    end
  end

  describe ".FormatSize" do
    it "returns empty string if nil passed" do
      expect(subject.FormatSize(nil)).to eq ""
    end

    FORMAT_SIZE_DATA = {
      0                     => "0 B",
      1                     => "1 B",
      1025                  => "1 KiB",
      1125                  => "1.1 KiB",
      743 * 1024            => "743 KiB",
      1_049_000             => "1.00 MiB",
      -1_049_000            => "-1 MiB", # FIXME: why?
      1_074_000_000         => "1.000 GiB",
      1_100_000_000_000     => "1.000 TiB",
      1_126_000_000_000_000 => "1024.091 TiB",
      1 << 10               => "1 KiB",
      1 << 20               => "1.00 MiB",
      1 << 30               => "1.000 GiB",
      1 << 40               => "1.000 TiB"
    }.freeze

    it "returns size formatted with proper bytes units" do
      FORMAT_SIZE_DATA.each do |arg, res|
        expect(subject.FormatSize(arg)).to eq res
      end
    end
  end

  describe ".FormatSizeWithPrecision" do
    it "returns empty string if nil passed" do
      expect(subject.FormatSizeWithPrecision(nil, nil, nil)).to eq ""
    end

    it "returns bytes in proper unit with passed precision forcing trailing zeroes if omit_zeroes not passed" do
      expect(subject.FormatSizeWithPrecision(1025 << 30, 2, false)).to eq "1.00 TiB"
      expect(subject.FormatSizeWithPrecision(1025 << 30, 3, false)).to eq "1.001 TiB"
    end

    it "returns bytes with zero precision if nil precision passed" do
      expect(subject.FormatSizeWithPrecision(1025 << 30, nil, false)).to eq "1 TiB"
    end

    it "omit trailing zeros if omit_zeroes is passed as true" do
      expect(subject.FormatSizeWithPrecision(4097, 2, true)).to eq "4 KiB"
      expect(subject.FormatSizeWithPrecision(1 << 20, 2, true)).to eq "1 MiB"
      expect(subject.FormatSizeWithPrecision(1025, 2, true)).to eq "1 KiB"
      expect(subject.FormatSizeWithPrecision(8 << 30, 2, true)).to eq "8 GiB"
    end
  end

  describe ".CutBlanks" do
    it "return empty string for nil" do
      expect(subject.CutBlanks(nil)).to eq ""
    end

    CUT_BLANKS_DATA = {
      ""              => "",
      "abc"           => "abc",
      " abc"          => "abc",
      "abc "          => "abc",
      " abc "         => "abc",
      "\tabc "        => "abc",
      "\tabc\t "      => "abc",
      " \tabc\t "     => "abc",
      "\t a b c \t"   => "a b c",
      "\t a b c \t\n" => "a b c \t\n"
    }.freeze
    it "remove trailing and prepending whitespace" do
      CUT_BLANKS_DATA.each do |arg, res|
        expect(subject.CutBlanks(arg)).to eq res
      end
    end
  end

  describe ".CutZeros" do
    it "return empty string for nil" do
      expect(subject.CutZeros(nil)).to eq ""
    end

    CUT_ZEROS_DATA = {
      ""    => "",
      "1"   => "1",
      "01"  => "1",
      "001" => "1",
      "0"   => "0",
      "00"  => "0"
    }.freeze
    it "removes prepended zeros" do
      CUT_ZEROS_DATA.each do |arg, res|
        expect(subject.CutZeros(arg)).to eq res
      end
    end
  end

  describe ".Repeat" do
    it "returns empty string is nil passed as text" do
      expect(subject.Repeat(nil, 5)).to eq ""
    end

    it "returns empty string if nil passed as number" do
      expect(subject.Repeat("a", nil)).to eq ""
    end

    it "returns empty string if number is zero or negative" do
      expect(subject.Repeat("a", 0)).to eq ""
      expect(subject.Repeat("a", -1)).to eq ""
    end

    it "returns string text repeated number times" do
      expect(subject.Repeat("a", 5)).to eq "aaaaa"
    end
  end

  describe ".SuperPad" do
    it "returns length times repeated padding if nil is passed as text" do
      expect(subject.SuperPad(nil, 5, ".", :right)).to eq "....."
    end

    it "returns text if is nil passed as padding" do
      expect(subject.SuperPad("test", 5, nil, :right)).to eq "test"
    end

    it "returns text if is nil is passed as lenght" do
      expect(subject.SuperPad("test", nil, ".", :right)).to eq "test"
    end

    it "returns text prefixed by padding to make lenght requested if alignment is :right" do
      expect(subject.SuperPad("test", 5, ".", :right)).to eq ".test"
    end

    it "returns text suffixed by padding to make lenght requested if alignment is not :right" do
      expect(subject.SuperPad("test", 5, ".", :left)).to eq "test."
    end

    # FIXME: looks like bug
    it "creates a longer string if padding is more than one character long" do
      expect(subject.SuperPad("test", 6, "abc", :left)).to eq "testabcabc"
    end
  end

  describe ".Pad" do
    it "Adds spaces after text to have it long as length" do
      expect(subject.Pad("test", 5)).to eq "test "
      expect(subject.Pad("test", 4)).to eq "test"
      expect(subject.Pad("test ", 7)).to eq "test   "
    end

    it "Returns text if length is negative or zero" do
      expect(subject.Pad("test", -1)).to eq "test"
      expect(subject.Pad("test", 0)).to eq "test"
    end

    it "Returns string full of spaces length long if text is nil or empty" do
      expect(subject.Pad("", 5)).to eq "     "
      expect(subject.Pad(nil, 5)).to eq "     "
    end
  end

  describe ".PadZeros" do
    it "Adds zeros before text to have it long as length" do
      expect(subject.PadZeros("1", 5)).to eq "00001"
      expect(subject.PadZeros("12", 5)).to eq "00012"
      expect(subject.PadZeros("12345", 5)).to eq "12345"
    end

    it "Returns text if length is negative or zero" do
      expect(subject.PadZeros("12", -1)).to eq "12"
      expect(subject.PadZeros("12", 0)).to eq "12"
    end

    it "Returns string full of zeros length long if text is nil or empty" do
      expect(subject.PadZeros("", 5)).to eq "00000"
      expect(subject.PadZeros(nil, 5)).to eq "00000"
    end
  end

  describe ".ParseOptions" do
    it "parse key=value map separated by space or tab by default" do
      expect(subject.ParseOptions("a=3\tb=2", {})).to eq ["a=3", "b=2"]
      expect(subject.ParseOptions("a=3 b=2", {})).to eq ["a=3", "b=2"]
      expect(subject.ParseOptions("a=", {})).to eq ["a="]
    end

    it "allows to specify as separator different value" do
      expect(subject.ParseOptions("a=3,b=2", "separator" => ",")).to eq ["a=3", "b=2"]
    end

    it "respects quoted strings" do
      expect(subject.ParseOptions("\"a=3 b=2\" c=3", {})).to eq ["a=3 b=2", "c=3"]
      expect(subject.ParseOptions("\"a=3 \\\"b=2\" c=3", {})).to eq ["a=3 \"b=2", "c=3"]
      expect(subject.ParseOptions("\"a=3 \"b=2 c=3", {})).to eq ["a=3 b=2", "c=3"]
    end

    it "returns as if there is quote at the end if there is unfinished quoted string" do
      expect(subject.ParseOptions("\"a=3 b=2 c=3", {})).to eq ["a=3 b=2 c=3"]
    end

    it "allows to specify if values should be unique" do
      expect(subject.ParseOptions("1 1 2", "unique" => false)).to eq ["1", "1", "2"]
      expect(subject.ParseOptions("1 1 2", "unique" => true)).to eq ["1", "2"]
    end

    it "allows to specify if additional whitespaces should be removed" do
      expect(subject.ParseOptions(" 1 ,  2", "remove_whitespace" => true, "separator" => ",")).to eq ["1", "2"]
      expect(subject.ParseOptions(" 1 ,  2", "remove_whitespace" => false, "separator" => ",")).to eq [" 1 ", "  2"]
    end

    it "allows to specify if backslash should be interpreted" do
      expect(subject.ParseOptions("a=\\n", "interpret_backslash" => true)).to eq ["a=\n"]
      expect(subject.ParseOptions("a=\\n", "interpret_backslash" => false)).to eq ["a=\\n"]
    end

    it "removes backslash from invalid sequention if backslash is interpretted" do
      expect(subject.ParseOptions("a=\\q", "interpret_backslash" => true)).to eq ["a=q"]
    end

    it "keeps trailing backslash if backslash is interpretted" do
      expect(subject.ParseOptions("a=\\", "interpret_backslash" => true)).to eq ["a=\\"]
    end

    it "returns empty array if nil passed as options" do
      expect(subject.ParseOptions(nil, {})).to eq []
    end

    it "returns empty array if empty string passed as options" do
      expect(subject.ParseOptions("", {})).to eq []
    end

    it "returns empty array if string containing only separator passed as options" do
      expect(subject.ParseOptions("  \t  ", {})).to eq []
    end
  end

  describe ".CutRegexMatch" do
    it "returns string with first match of given regexp removed when glob is set to false" do
      expect(subject.CutRegexMatch("ab123cd56", "[0-9]+", false)).to eq "abcd56"
    end

    it "returns string with all matches of given regexp removed when glob is set to true" do
      expect(subject.CutRegexMatch("ab123cd56", "[0-9]+", true)).to eq "abcd"
    end

    it "returns input when no match of regex found" do
      expect(subject.CutRegexMatch("ab123cd56", "[A-Z]+", false)).to eq "ab123cd56"
    end

    it "returns empty string if input is nil" do
      expect(subject.CutRegexMatch(nil, "[A-Z]+", false)).to eq ""
    end

    it "returns input if regex is nil" do
      expect(subject.CutRegexMatch("ab123cd56", nil, false)).to eq "ab123cd56"
    end
  end

  describe ".EscapeTags" do
    it "escapes html/xml tags" do
      expect(subject.EscapeTags("<font size='2'><b>text & another</b></font>")).to eq(
        "&lt;font size='2'&gt;&lt;b&gt;text &amp; another&lt;/b&gt;&lt;/font&gt;"
      )
    end

    it "returns nil if nil passed" do
      expect(subject.EscapeTags(nil)).to eq nil
    end
  end

  describe ".StartsWith" do
    it "checks if string str start with string test" do
      expect(subject.StartsWith("Hello world", "Hello")).to eq true
      expect(subject.StartsWith("Hello", "Hello")).to eq true
      expect(subject.StartsWith("Hello", "hello")).to eq false
      expect(subject.StartsWith("Hello", "World")).to eq false
    end

    it "returns false if str is nil" do
      expect(subject.StartsWith(nil, "hello")).to eq false
    end

    it "returns false if test is nil" do
      expect(subject.StartsWith("hello", nil)).to eq false
    end

    it "returns false if both params are nil" do
      expect(subject.StartsWith(nil, nil)).to eq false
    end
  end

  describe ".RemoveShortcut" do
    it "returns string with removed a UI key shortcuts from label" do
      expect(subject.RemoveShortcut("Hello")).to eq "Hello"
      expect(subject.RemoveShortcut("&Hello")).to eq "Hello"
      expect(subject.RemoveShortcut("He&llo")).to eq "Hello"
      expect(subject.RemoveShortcut("&He&llo")).to eq "&Hello" # FIXME: Why? this looks like bug
      expect(subject.RemoveShortcut("&&He&llo")).to eq "&&Hello"
      expect(subject.RemoveShortcut("&&Hello")).to eq "&&Hello"
      expect(subject.RemoveShortcut("&&&Hello")).to eq "&&Hello"
      expect(subject.RemoveShortcut("&&&&Hello")).to eq "&&&&Hello"
    end

    it "returns nil if label is nil" do
      expect(subject.RemoveShortcut(nil)).to eq nil
    end
  end

  describe ".OptParens" do
    it "returns parameter in parens and with space prefix" do
      expect(subject.OptParens(5)).to eq " (5)"
    end

    it "returns empty string if parameter is nil or empty" do
      expect(subject.OptParens(nil)).to eq ""
      expect(subject.OptParens("")).to eq ""
    end
  end

  describe ".NonEmpty" do
    it "filters out empty strings from array" do
      expect(subject.NonEmpty(["a", "", "b", "", nil])).to eq ["a", "b", nil]
    end

    it "returns nil if nil passed" do
      expect(subject.NonEmpty(nil)).to eq nil
    end
  end

  describe ".NewlineItems" do
    it "returns list of lines from string containing \\n" do
      expect(subject.NewlineItems("a\nb\nc")).to eq ["a", "b", "c"]
    end

    it "removes from list all empty lines" do
      expect(subject.NewlineItems("a\n\n")).to eq ["a"]
    end

    it "returns nil if nil passed" do
      expect(subject.NewlineItems(nil)).to eq nil
    end
  end

  describe ".YesNo" do
    it "returns translated \"Yes\" if param is true" do
      expect(subject.YesNo(true)).to eq "Yes"

      allow(subject).to receive(:_).and_return "Ano"
      expect(subject.YesNo(true)).to eq "Ano"
    end

    it "returns translated \"No\" if param is false" do
      expect(subject.YesNo(false)).to eq "No"

      allow(subject).to receive(:_).and_return "Ne"
      expect(subject.YesNo(true)).to eq "Ne"
    end

    it "returns translated \"No\" if param is nil" do
      expect(subject.YesNo(nil)).to eq "No"

      allow(subject).to receive(:_).and_return "Ne"
      expect(subject.YesNo(true)).to eq "Ne"
    end
  end

  describe ".FormatRateMessage" do
    it "returns text with %1 replaced by formated rate for average and current download " do
      expect(subject.FormatRateMessage("Downloading %1", 1 << 20, 1 << 10)).to eq "Downloading 1 KiB/s (on average 1.00 MiB/s)"
      expect(subject.FormatRateMessage("Downloading %1", 1025 << 20, 1025 << 30)).to eq "Downloading 1.001 TiB/s (on average 1.001 GiB/s)"
    end

    it "returns text with %1 replaced by format current rate string if avg_rate is zero" do
      expect(subject.FormatRateMessage("Downloading %1", 0, 1 << 10)).to eq "Downloading 1 KiB/s"
    end

    # FIXME: looks like bug as download can have parts when it is paused
    it "returns text with %1 replaced by empty string if current rate is zero" do
      expect(subject.FormatRateMessage("Downloading %1", 1 << 10, 0)).to eq "Downloading "
    end

    it "returns text with %1 replaced by empty string if current rate and avg_rate are zeros" do
      expect(subject.FormatRateMessage("Downloading %1", 0, 0)).to eq "Downloading "
    end
  end

  describe ".FormatTwoDigits" do
    it "returns string with input if number has at least two digits" do
      expect(subject.FormatTwoDigits(10)).to eq "10"
      expect(subject.FormatTwoDigits(15)).to eq "15"
      expect(subject.FormatTwoDigits(150)).to eq "150"
    end

    it "returns string with number prefixed by zero if param is non-negative and single digit" do
      expect(subject.FormatTwoDigits(0)).to eq "00"
      expect(subject.FormatTwoDigits(5)).to eq "05"
    end

    it "returns string with input if number is negative" do
      expect(subject.FormatTwoDigits(-100)).to eq "-100"
      expect(subject.FormatTwoDigits(-5)).to eq "-5"
    end
  end

  describe ".FormatTime" do
    it "returns string with minutes and seconds if less then one hour" do
      expect(subject.FormatTime(1801)).to eq "30:01"
    end

    it "returns string with hours, minutes and seconds if above one hour" do
      expect(subject.FormatTime(11_801)).to eq "3:16:41"
    end

    it "returns empty string if negative number passed" do
      expect(subject.FormatTime(-1)).to eq ""
    end

    # FIXME: looks like bug
    it "returns \"nil:nil:nil\" string if nil passed" do
      expect(subject.FormatTime(nil)).to eq "nil:nil:nil"
    end
  end

  describe ".FirstChunk" do
    it "returns first part s splitted by any of separators" do
      expect(subject.FirstChunk("a b", " ")).to eq "a"
      expect(subject.FirstChunk("a b", "\n\t ")).to eq "a"
      expect(subject.FirstChunk("abc def", "\n\t ")).to eq "abc"
    end

    it "returns s string if there is no match of separators" do
      expect(subject.FirstChunk("a b", "\t")).to eq "a b"
    end

    it "returns empty string if s is nil" do
      expect(subject.FirstChunk(nil, "\t")).to eq ""
    end

    it "returns empty string if separators is nil" do
      expect(subject.FirstChunk("a b", nil)).to eq ""
    end
  end

  describe ".TextTable" do
    it "returns string with ascii formatted table" do
      expected_table = "    h1    h2 \n" \
                       "    ---------\n" \
                       "    a1    a2 \n" \
                       "    bb10  bb2"

      expect(subject.TextTable(["h1", "h2"], [["a1", "a2"], ["bb10", "bb2"]], {})).to eq(
        expected_table
      )
    end

    it "it allows to specify horizontal padding by integer" do
      expected_table = "    h1        h2 \n" \
                       "    -------------\n" \
                       "    a1        a2 \n" \
                       "    bb10      bb2"

      expect(subject.TextTable(["h1", "h2"], [["a1", "a2"], ["bb10", "bb2"]], "horizontal_padding" => 6)).to eq(
        expected_table
      )
    end

    it "it allows to specify table left padding by integer" do
      expected_table = "      h1    h2 \n" \
                       "      ---------\n" \
                       "      a1    a2 \n" \
                       "      bb10  bb2"

      expect(subject.TextTable(["h1", "h2"], [["a1", "a2"], ["bb10", "bb2"]], "table_left_padding" => 6)).to eq(
        expected_table
      )
    end

    it "returns header only if items param is nil" do
      expected_table = "    h1  h2\n" \
                       "    ------\n" \

      expect(subject.TextTable(["h1", "h2"], nil, {})).to eq expected_table
    end

    it "returns table without header if header param is nil" do
      expected_table = "    \n" \
                       "    ---------\n" \
                       "    a1    a2 \n" \
                       "    bb10  bb2"

      expect(subject.TextTable(nil, [["a1", "a2"], ["bb10", "bb2"]], {})).to eq expected_table
    end
  end

  describe ".UnderlinedHeader" do
    it "returns underlined text" do
      expected_output = "abc\n---"

      expect(subject.UnderlinedHeader("abc", 0)).to eq expected_output
    end

    it "use left padding to indent text" do
      expected_output = "  abc\n  ---"

      expect(subject.UnderlinedHeader("abc", 2)).to eq expected_output
    end

    it "returns nil if nil passed as text" do
      expect(subject.UnderlinedHeader(nil, 0)).to eq nil
    end

    it "acts like if padding is zero if nil passed as padding" do
      expected_output = "abc\n---"

      expect(subject.UnderlinedHeader("abc", nil)).to eq expected_output
    end
  end

  describe ".Replace" do
    it "returns string with all source substring replaced by target" do
      arg = "abcdabcdab"
      expected_output = "12cd12cd12"

      expect(subject.Replace(arg, "ab", "12")).to eq expected_output
    end

    it "recursive replace parts if replacement create again source matching" do
      arg = "abbaabbaa"
      expected_output = "bbbbaaaaa"

      expect(subject.Replace(arg, "ab", "ba")).to eq expected_output
    end

    it "return nil if text is nil" do
      expect(subject.Replace(nil, "ab", "12")).to eq nil
    end

    it "returns unmodified text if source is nil" do
      expect(subject.Replace("abc", nil, "12")).to eq "abc"
    end

    it "returns unmodified text if target is nil" do
      expect(subject.Replace("abc", "ab", nil)).to eq "abc"
    end

    it "raises exception if target include source" do
      expect { subject.Replace("abc", "ab", "abcde") }.to raise_exception
      expect { subject.Replace("abc", "ab", "ab") }.to raise_exception
    end
  end

  describe ".Random" do
    it "generates random 36-base number with given length" do
      Yast::Builtins.srandom(50) # ensure we get same number

      expect(subject.Random(10)).to eq "wbxu466m52"
    end

    it "generates empty string if non-positive number passed" do
      expect(subject.Random(0)).to eq ""
      expect(subject.Random(-10)).to eq ""
    end

    it "generates empty string if nil as len passed" do
      expect(subject.Random(nil)).to eq ""
    end
  end

  describe ".FormatFilename" do
    it "returns truncated middle part of directory to fit len" do
      expect(subject.FormatFilename("/really/long/file/name", 15)).to eq "/.../file/name"
      expect(subject.FormatFilename("/really/long/file/name/", 15)).to eq "/.../file/name/"
      expect(subject.FormatFilename("/really/long/file/name", 10)).to eq "/.../name"
    end

    it "returns whole file_path if it fits len" do
      expect(subject.FormatFilename("/really/long/file/name", 50)).to eq "/really/long/file/name"
    end

    it "never removes the last part of name" do
      expect(subject.FormatFilename("/really/long/file/name", 3)).to eq ".../name"
    end

    it "can remove first part of path" do
      expect(subject.FormatFilename("/really/long/file/name", 5)).to eq ".../name"
    end

    it "returns nil if file_path is nil" do
      expect(subject.FormatFilename(nil, 5)).to eq nil
    end

    it "returns file_len truncated by second path element if len is nil" do
      expect(subject.FormatFilename("/really/long/file/name", nil)).to eq "/really/.../file/name"
    end
  end

  describe ".FindMountPoint" do
    it "returns mount point where dir belongs to" do
      mount_points = ["/", "/boot", "/var"]

      expect(subject.FindMountPoint("/boot/grub2", mount_points)).to eq "/boot"
      expect(subject.FindMountPoint("/var", mount_points)).to eq "/var"
      expect(subject.FindMountPoint("/usr", mount_points)).to eq "/"
      expect(subject.FindMountPoint("/usr", ["/var"])).to eq "/"
    end

    it "returns \"/\" if dir is nil or empty" do
      mount_points = ["/", "/boot", "/var"]

      expect(subject.FindMountPoint("", mount_points)).to eq "/"
      expect(subject.FindMountPoint(nil, mount_points)).to eq "/"
    end

    it "returns \"/\" if dirs are empty or nil" do
      expect(subject.FindMountPoint("/usr", [])).to eq "/"
      expect(subject.FindMountPoint("/usr", nil)).to eq "/"
    end
  end
end
