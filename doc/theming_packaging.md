# Shipping an appearance on a medium

Companion to [theming.md](theming.md), which is about designing and writing that
stylesheet, whether it is a product appearance, named after a product id, or a
brand appearance, a single `brand.css` reaching every screen of the medium. This
one is only about getting either of them onto a medium.

Nobody has to contribute their branding to Agama. The web server serves a plain
static directory, so the package that builds the medium can drop the files into
it and own them end to end: no pull request, no waiting for an Agama release,
and the branding stays in its own repository, versioned with the rest of the
product.

Agama itself ships neither kind of appearance. The `example.css` and
`example-advanced.css` files in its sources are documentation, and the web UI
package installs only its own assets, so a package adding files under the served
directory is not overriding anything: it is filling in a slot that is empty by
design.

## Where the files go

The served directory is `/usr/share/agama/web_ui` (the web server's default; it
accepts `--web-ui-dir` to point elsewhere). The paths the UI asks for, relative
to it:

| What                                  | Path                                               |
| ------------------------------------- | -------------------------------------------------- |
| the product stylesheet                | `assets/appearance/<product-id>.css`               |
| the brand stylesheet                  | `assets/appearance/brand.css`                      |
| logo                                  | `assets/logos/<icon>`                              |
| dark logo                             | same name with `-dark` before the extension        |
| fonts and anything else it references | wherever it points at, relative to the file itself |

Both names come from the product definition the medium ships,
`/usr/share/agama/products.d/<product>.yaml`: the file is named after its `id:`
and the logo after its `icon:`. A product declaring

```yaml
id: MyProduct
icon: MyProduct.svg
```

is served `assets/appearance/MyProduct.css` and `assets/logos/MyProduct.svg`,
with `MyProduct-dark.svg` used on the dark scheme when present. The names have to
match exactly, and a product without a dark logo falls back to the light one.

The brand stylesheet takes no id, since a medium carries at most one, and it
brings no logo: logos are named after a product's `icon:`. Everything else it
references, fonts included, resolves relative to the file itself, exactly as for
a product.

Keeping a product's own files next to its stylesheet, for instance
`assets/appearance/fonts/MyProductMono.woff2` referenced as
`url("./fonts/MyProductMono.woff2")`, keeps everything the product needs in one
place.

## Fonts

The official ISO ships a limited, curated font set, the one Agama's own defaults
need, so a typeface of your own has to be shipped with it. The stylesheet
declares the
`@font-face` (see the other document); the package's job is to put the file where
that declaration points. Two constraints come with it:

- **License.** The font ships on the medium, so its license has to allow
  redistribution (OFL and similar). Keep the license text in the package.
- **Size.** Prefer `woff2` and subset the font to the scripts the product needs.
  For
  scale: the full variable CJK families Agama bundles are 9 MB to 17 MB each.

## Trying it on a running installer first

Before building anything, the fastest loop is a medium you already have. The live
system runs writable in RAM, so the served directory can be edited in place.

Get a root shell first: the medium prints a root password on the console, or the
boot prompt accepts `live.password=<password>` to choose one, and SSH is enabled
for root. Then copy the file in, named after a product the medium already offers:

```console
scp MyTheme.css root@installer:/usr/share/agama/web_ui/assets/appearance/Tumbleweed.css
scp MyLogo.svg  root@installer:/usr/share/agama/web_ui/assets/logos/Tumbleweed.svg
```

Reload the browser and select that product. Everything lives in RAM, so a reboot
wipes the experiment, which is the property to want while trying values out.

A brand stylesheet goes in the same way, under its fixed name and with no
product to pick:

```console
scp brand.css root@installer:/usr/share/agama/web_ui/assets/appearance/brand.css
```

Reload the browser and it is already in effect on the product selection screen,
before anything is selected, which is the fastest look at it.

From the Agama sources, `setup-web.sh` points the served directory at the
development build, so everything the build emits (the examples included) is
served straight away.

## The package

Once the values settle, the files travel onto a medium the way everything else
does: as an RPM. It needs no scriptlets and no dependencies beyond the web UI,
since it only adds files to a directory that is already served:

```
%install
install -Dm644 MyProduct.css %{buildroot}%{_datadir}/agama/web_ui/assets/appearance/MyProduct.css
install -Dm644 MyProduct.svg %{buildroot}%{_datadir}/agama/web_ui/assets/logos/MyProduct.svg
install -Dm644 MyProduct-dark.svg %{buildroot}%{_datadir}/agama/web_ui/assets/logos/MyProduct-dark.svg
```

A branding package ships the one file instead:

```
%install
install -Dm644 brand.css %{buildroot}%{_datadir}/agama/web_ui/assets/appearance/brand.css
```

Since a medium has room for exactly one brand appearance, branding packages
should declare a virtual provide and conflict on it, so two of them fail at
install time instead of racing for the same path:

```
Provides:  agama-branding
Conflicts: agama-branding
```

Then it has to reach the image build. The Agama live image is built with KIWI,
and its description pulls packages from the repositories of the project building
it (`obsrepositories:/`), so there are two steps: publish the package into a
repository the image project can see, and add it to the image description's
package list:

```xml
<packages type="image">
  <package name="my-product-branding"/>
</packages>
```

### How far a branding package reaches

Two levels of involvement are easy to conflate. Shipping a branding package means
adding files to a directory Agama serves: the stylesheet, the logos, a font
if it
brings one. It works on any Agama medium that includes the package, needs no
change to the image description beyond that one line, and covers everything the
roles cover.

Building your own image is a bigger commitment, and in exchange it reaches
everything the package cannot touch: the browser the medium launches, the boot
menu, the services that run. Which color scheme the installer opens in, below, sits on
that side of the line.

## Failure modes

- **A missing file is harmless.** The browser ignores a stylesheet that fails to
  load and the UI keeps the Agama defaults, which is what makes this safe to
  add late in a medium's build.
- **A stale precompressed sibling wins.** The server prefers a `.gz` next to a
  file when the browser accepts gzip, so a leftover `<product-id>.css.gz` (or
  `brand.css.gz`) from an earlier build keeps being served after the plain file
  is updated. Ship both or neither.
- **A name mismatch is silent.** A file named after the product _name_ instead of
  its `id:`, or a logo not matching `icon:`, simply never loads.

## The color scheme the medium opens in

A product describes what both schemes look like, not which one the installer
opens
in. That is decided before any product is chosen: the web UI follows the
`prefers-color-scheme` the browser reports, and remembers whatever the user
picks afterwards. So a brand that is natively dark still opens light unless the
browser says otherwise.

On the live medium the browser belongs to the image, not to a product package. It
starts from a Firefox profile the image provides, and one preference there
settles the question:

```js
user_pref("ui.systemUsesDarkTheme", 1);
```

Firefox then reports a dark preference and the first paint is already dark. A
profile has a single `user.js`, so this is a change for whoever builds the image
rather than something a branding package can add on the side. It is also a
medium-wide default: on a medium offering several products, it is not a per
product setting.

On a running installer the same line can be added to
`/root/.mozilla/firefox/profile/user.js` to see the effect, restarting the
graphical session with `systemctl restart x11-autologin` afterwards. Whatever the
first paint is, the appearance menu in the header still switches schemes at any
time.

## Compatibility

The `--agm-t--*` roles are an interface, and a package-supplied appearance has
nothing
checking it at build time: a role that no longer exists is not an error, it just
stops applying. So pin the expectation the other way around, by setting only the
roles the brand needs and leaving the rest to Agama, and verify it against
the Agama version that lands on the medium rather than against a newer one.

## Before shipping

Walk the manual checks from [theming.md](theming.md): light, dark and high
contrast, on the screens listed there. A brand appearance adds the product
selection screen, and a product that ships its own file next to it.
