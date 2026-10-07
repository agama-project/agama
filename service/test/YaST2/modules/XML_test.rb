require_relative "test_helper"
require "tempfile"

Yast.import "XML"

describe "Yast::XML" do
  subject { Yast::XML }

  before do
    subject.xmlCreateDoc("test",
      "cdataSections" => ["cdata1", "cdata2"],
      "systemID"      => "just_testing.dtd",
      "rootElement"   => "test",
      "listEntries"   => { "list1" => "list1_element", "list2" => "list2_element" })
  end

  describe "YCPToXMLString" do
    it "return nil for not defined doc_type" do
      expect(subject.YCPToXMLString("not-exist", "test" => 1)).to eq nil
    end

    it "returns converted xml for known doc type and passed object" do
      input = { "test" => :abc, "lest" => 15 }
      expected = "<?xml version=\"1.0\"?>\n" \
                 "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                 "<test>\n" \
                 "  <lest t=\"integer\">15</lest>\n" \
                 "  <test t=\"symbol\">abc</test>\n" \
                 "</test>\n"

      expect(subject.YCPToXMLString("test", input)).to eq expected
    end

    context "for boolean" do
      it "creates xml element with t=boolean attribute" do
        input = { "test" => true, "lest" => false }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <lest t=\"boolean\">false</lest>\n" \
                   "  <test t=\"boolean\">true</test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end
    end

    context "for integer" do
      it "creates xml element with t=integer attribute" do
        input = { "test" => 5, "lest" => -5 }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <lest t=\"integer\">-5</lest>\n" \
                   "  <test t=\"integer\">5</test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end
    end

    context "for symbols" do
      it "creates xml element with t=symbol attribute" do
        input = { "test" => :test, "lest" => :lest }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <lest t=\"symbol\">lest</lest>\n" \
                   "  <test t=\"symbol\">test</test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end
    end

    context "for string" do
      it "creates xml element with no type attribute" do
        input = { "test" => "test", "lest" => "lest" }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <lest>lest</lest>\n" \
                   "  <test>test</test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end

      it "creates CDATA element if string starts with spaces" do
        input = { "test" => " test", "lest" => "\nlest" }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <lest><![CDATA[\nlest]]></lest>\n" \
                   "  <test><![CDATA[ test]]></test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end

      it "creates CDATA element if string ends with spaces" do
        input = { "test" => "test ", "lest" => "lest\n" }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <lest><![CDATA[lest\n]]></lest>\n" \
                   "  <test><![CDATA[test ]]></test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end
    end

    context "for hash" do
      it "create xml elements for its keys and values and t=map attribute" do
        input = { "test" => { "a" => "b", "lest" => :lest } }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <test t=\"map\">\n" \
                   "    <a>b</a>\n" \
                   "    <lest t=\"symbol\">lest</lest>\n" \
                   "  </test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end

      it "raises XMLSerializationError when key is not string" do
        input = { "test" => { "a" => "b", "lest" => :lest, 1 => 2, nil => "t", :symbol => "symbol" } }

        expect { subject.YCPToXMLString("test", input) }.to raise_error(Yast::XMLSerializationError)
      end

      it "places keys in alphabetic sorting" do
        input = { "test" => { "a" => "b", "lest" => :lest, "b" => "c" } }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <test t=\"map\">\n" \
                   "    <a>b</a>\n" \
                   "    <b>c</b>\n" \
                   "    <lest t=\"symbol\">lest</lest>\n" \
                   "  </test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end

      it "raises XMLSerializationError when entry has nil as value" do
        input = { "test" => { "a" => "b", "b" => "c", "c" => nil, "d" => "e", "e" => "f" } }

        expect { subject.YCPToXMLString("test", input) }.to raise_error(Yast::XMLSerializationError)
      end

      it "raises XMLSerializationError when entry has a weird value" do
        input = { "test" => /I am a Regexp/ }

        expect { subject.YCPToXMLString("test", input) }.to raise_error(Yast::XMLSerializationError)
      end
    end

    context "for array" do
      it "create xml elements for values and specify t=list" do
        input = { "test" => ["b", :lest] }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <test t=\"list\">\n" \
                   "    <listentry>b</listentry>\n" \
                   "    <listentry t=\"symbol\">lest</listentry>\n" \
                   "  </test>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end

      # see global before section for listEntries
      it "creates xml elements with name passed to listEntries if found" do
        input = { "list1" => ["b", :lest] }
        expected = "<?xml version=\"1.0\"?>\n" \
                   "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                   "<test>\n" \
                   "  <list1 t=\"list\">\n" \
                   "    <list1_element>b</list1_element>\n" \
                   "    <list1_element t=\"symbol\">lest</list1_element>\n" \
                   "  </list1>\n" \
                   "</test>\n"

        expect(subject.YCPToXMLString("test", input)).to eq expected
      end

      it "raises XMLSerializationError when list contains nil" do
        input = { "test" => ["a", "b", nil, "d", "e", "f"] }

        expect { subject.YCPToXMLString("test", input) }.to raise_error(Yast::XMLSerializationError)
      end
    end

    it "creates properly specified namespaces" do
      subject.xmlCreateDoc("testns",
        "cdataSections" => ["cdata1", "cdata2"],
        "systemID"      => "just_testing.dtd",
        "rootElement"   => "test",
        "nameSpace"     => "http://www.suse.com/1.0/yast2ns",
        "typeNamespace" => "http://www.suse.com/1.0/configns")

      input = { "test" => :abc, "lest" => 15 }
      expected = "<?xml version=\"1.0\"?>\n" \
                 "<!DOCTYPE test SYSTEM \"just_testing.dtd\">\n" \
                 "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                 "  <lest t=\"integer\">15</lest>\n" \
                 "  <test t=\"symbol\">abc</test>\n" \
                 "</test>\n"

      expect(subject.YCPToXMLString("testns", input)).to eq expected
    end
  end

  describe ".XMLToYCPString" do
    context "regarding 'config:type' and 't' attributes:" do
      it "recognizes the 't' attribute" do
        input = "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <foo t=\"symbol\">sym</foo>\n" \
                "</test>\n"
        expected = { "foo" => :sym }
        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "recognizes the 'type' attribute (unnamespaced)" do
        input = "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <foo type=\"symbol\">sym</foo>\n" \
                "</test>\n"
        expected = { "foo" => :sym }
        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "recognizes the 'config:type' attribute" do
        input = "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <foo config:type=\"symbol\">sym</foo>\n" \
                "</test>\n"
        expected = { "foo" => :sym }
        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "recognizes the 'config:type' attribute even with a different prefix" do
        input = "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:c=\"http://www.suse.com/1.0/configns\">\n" \
                "  <foo c:type=\"symbol\">sym</foo>\n" \
                "</test>\n"
        expected = { "foo" => :sym }
        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "in case of conflict it raises" do
        input = "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <foo t=\"string\" type=\"symbol\">str</foo>\n" \
                "  <bar t=\"string\" config:type=\"symbol\">str</bar>\n" \
                "</test>\n"
        expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError, /both 't' and 'type'/)
      end

      it "in raises when the type is invalid" do
        input = "<test xmlns=\"http://www.suse.com/1.0/yast2ns\">\n" \
                "  <foo t=\"typewriter\">old</foo>\n" \
                "</test>\n"
        expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError, /invalid type "typewriter"/)
      end
    end

    it "returns string for xml element with type=\"string\"" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<!DOCTYPE test SYSTEM \"whatever.dtd\">\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"string\">5</test>\n" \
              "  <lest config:type=\"string\"> \n" \
              "    -5 \n" \
              "  </lest>\n" \
              "</test>\n"
      expected = { "test" => "5", "lest" => "-5" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    # backward compatibility
    it "returns string for xml element with type=\"disksize\"" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"disksize\">5</test>\n" \
              "  <lest config:type=\"disksize\"> \n" \
              "    -5 \n" \
              "  </lest>\n" \
              "</test>\n"
      expected = { "test" => "5", "lest" => "-5" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "returns string for xml element without type and with text" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test>5</test>\n" \
              "  <lest>\n" \
              "    -5 \n" \
              "  </lest>\n" \
              "</test>\n"
      expected = { "test" => "5", "lest" => "-5" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "strips spaces at the end of strings" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test>foo </test>\n" \
              "  <lest>bar\n" \
              "  </lest>\n" \
              "</test>\n"
      expected = { "test" => "foo", "lest" => "bar" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "preserves spaces at the end of CDATA elements" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test><![CDATA[foo ]]></test>\n" \
              "  <lest><![CDATA[bar\n]]></lest>\n" \
              "</test>\n"
      expected = { "test" => "foo ", "lest" => "bar\n" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "strips spaces at the start of strings" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test> foo</test>\n" \
              "  <lest>\nbar" \
              "  </lest>\n" \
              "</test>\n"
      expected = { "test" => "foo", "lest" => "bar" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "preserves spaces at the start of CDATA elements" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test><![CDATA[ foo]]></test>\n" \
              "  <lest><![CDATA[\nbar]]></lest>\n" \
              "</test>\n"
      expected = { "test" => " foo", "lest" => "\nbar" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "returns integer for xml element with type=\"integer\"" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"integer\">5</test>\n" \
              "  <lest config:type=\"integer\">-5</lest>\n" \
              "</test>\n"
      expected = { "test" => 5, "lest" => -5 }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "raises XMLDeserializationError (with line info) for invalid integers" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"integer\">5</test>\n" \
              "  <lest config:type=\"integer\">-5</lest>\n" \
              "  <invalid config:type=\"integer\">invalid</invalid>\n" \
              "</test>\n"

      expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError, /at line 5: cannot be parsed as an integer/)
    end

    it "returns symbol for xml element with type=\"symbol\"" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"symbol\">5</test>\n" \
              "  <lest config:type=\"symbol\">test</lest>\n" \
              "</test>\n"
      expected = { "test" => :"5", "lest" => :test }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "returns boolean for xml element with type=\"boolean\"" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"boolean\">true</test>\n" \
              "  <lest config:type=\"boolean\">false</lest>\n" \
              "</test>\n"
      expected = { "test" => true, "lest" => false }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "raises XMLDeserializationError xml element with type=\"boolean\" and unknown value" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"boolean\">true</test>\n" \
              "  <lest config:type=\"boolean\">invalid</lest>\n" \
              "</test>\n"

      expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError)
    end

    it "returns array for xml element with type=\"list\"" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"list\">\n" \
              "    <lest config:type=\"boolean\">false</lest>\n" \
              "    <int config:type=\"integer\">5</int>\n" \
              "  </test>\n" \
              "</test>\n"
      expected = { "test" => [false, 5] }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "works also on nested arrays" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test config:type=\"list\">\n" \
              "    <lest config:type=\"list\">\n" \
              "      <a config:type=\"boolean\">false</a>\n" \
              "      <b config:type=\"boolean\">true</b>\n" \
              "    </lest>\n" \
              "    <int config:type=\"integer\">5</int>\n" \
              "  </test>\n" \
              "</test>\n"
      expected = { "test" => [[false, true], 5] }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "returns hash for xml element that contain only sub elements" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test>\n" \
              "    <lest config:type=\"boolean\">false</lest>\n" \
              "    <int config:type=\"integer\">5</int>\n" \
              "  </test>\n" \
              "</test>\n"
      expected = { "test" => { "lest" => false, "int" => 5 } }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "raise Yast::XMLDeserializationError for xml element that contain sub elements and value" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <test>\n" \
              "    <lest config:type=\"boolean\">false</lest>\n" \
              "    <int config:type=\"integer\">5</int>\n" \
              "    test value \n" \
              "  </test>\n" \
              "</test>\n"

      expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError, /both text.*and elements/)
    end

    context "element with empty value" do
      it "return empty string if no type is specified" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <test></test>\n" \
                "</test>\n"

        expected = { "test" => "" }
        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "returns empty string with type string" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <test type=\"string\" />\n" \
                "</test>\n"
        expected = { "test" => "" }

        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "returns empty hash with type map" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <test type=\"map\" />\n" \
                "</test>\n"
        expected = { "test" => {} }

        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "returns empty array with type list" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <test type=\"list\" />\n" \
                "</test>\n"
        expected = { "test" => [] }

        expect(subject.XMLToYCPString(input)).to eq expected
      end

      it "raises XMLDeserializationError with type symbol" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <lest type=\"symbol\"></lest>\n" \
                "</test>\n"

        expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError)
      end

      it "raises XMLDeserializationError with type integer" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <lest type=\"integer\"></lest>\n" \
                "</test>\n"

        expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError)
      end

      it "raises XMLDeserializationError with type boolean" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <lest type=\"boolean\"></lest>\n" \
                "</test>\n"

        expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError)
      end

      it "workaround with empty cdata still works" do
        input = "<?xml version=\"1.0\"?>\n" \
                "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
                "  <lest><![CDATA[]]></lest>\n" \
                "</test>\n"
        expected = { "lest" => "" }

        expect(subject.XMLToYCPString(input)).to eq expected
      end
    end

    # for cdata see global before
    it "returns cdata section as string" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <cdata1>false</cdata1>\n" \
              "</test>\n"
      expected = { "cdata1" => "false" }

      expect(subject.XMLToYCPString(input)).to eq expected
    end

    it "raises XMLDeserializationError if xml is malformed" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <okoze>blabla</ovoze>\n" \
              "</test>\n"

      expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError, /mismatch/)
    end

    it "raises XMLDeserializationError if xml is empty" do
      input = ""
      expect { subject.XMLToYCPString(input) }.to raise_error(Yast::XMLDeserializationError)
    end

    it "ignores xml comments" do
      input = "<?xml version=\"1.0\"?>\n" \
              "<test xmlns=\"http://www.suse.com/1.0/yast2ns\" xmlns:config=\"http://www.suse.com/1.0/configns\">\n" \
              "  <!-- we need empty list -->\n" \
              "  <test type=\"list\" />\n" \
              "</test>\n"
      expected = { "test" => [] }

      expect(subject.XMLToYCPString(input)).to eq expected
    end
  end

  describe "validate" do
    let(:schema) do
      '<element name="test" xmlns="http://relaxng.org/ns/structure/1.0">
         <zeroOrMore>
           <element name="person">
             <element name="name">
               <text/>
             </element>
             <element name="voice">
               <text/>
             </element>
           </element>
         </zeroOrMore>
       </element>'
    end

    let(:valid_xml) do
      '<?xml version="1.0"?>
        <test>
          <person>
            <name>
              clark
            </name>
            <voice>
              nice
            </voice>
          </person>
        </test>'
    end

    it "returns empty array for valid xml" do
      expect(Yast::XML.validate(valid_xml, schema)).to be_empty
    end

    it "returns error string in array when xml is not valid for given schema" do
      xml = '<?xml version="1.0"?>
             <test>
               <person>
                 <name>
                   clark
                 </name>
               </person>
             </test>'

      expect(Yast::XML.validate(xml, schema)).to_not be_empty
    end

    it "raises XMLDeserializationError for a not well formed XML" do
      # make the document invalid by commenting out a closing tag
      xml = '<?xml version="1.0"?>
             <test>
               <person>
                 <name>
                   clark
                 </name>
                 <voice>
                   nice
                 </voice>
               <!-- </person> -->
             </test>'

      expect { Yast::XML.validate(xml, schema) }.to raise_error(Yast::XMLDeserializationError)
    end

    it "can read the input from files" do
      # create temporary files with the testing content
      xml_file = Tempfile.new
      schema_file = Tempfile.new
      begin
        xml_file.write(valid_xml)
        xml_file.close
        schema_file.write(schema)
        schema_file.close

        errors = Yast::XML.validate(Pathname.new(xml_file.path), Pathname.new(schema_file.path))
        expect(errors).to be_empty
      ensure
        xml_file.unlink
        schema_file.unlink
      end
    end
  end

  describe "#XMLToYCPFile" do
    it "raises ArgumentError when nil is passed" do
      expect { subject.XMLToYCPFile(nil) }.to raise_error(ArgumentError)
    end
  end
end
