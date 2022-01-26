
## get the list of available languages

Iface: o.o.YaST.Installer1.Language

stupid api:
  AvailableLanguages -> array(string)

minimal working api:
  needed: human readable name (how localized?), identifier

identifiers: maybe LanguageTag https://www.rubydoc.info/github/yast/yast-packager/master/LanguageTag
- move it to yast-yast2
- link to the standard from yard 
- see https://tools.ietf.org/html/rfc4647 Matching of Language Tags
- see https://lists.opensuse.org/archives/list/yast-devel@lists.opensuse.org/message/D52PSZ7TRID2RVM6CE6K2C2RUNNGOS6Z/

return an array of objects (object paths) representing the languages?

(later: keyboard layouts; territories? timezones? console fonts?)

## get the list of base products

I can do this

## interact with the storage proposal

I have no idea
 
