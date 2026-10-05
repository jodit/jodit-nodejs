# Changelog

## 2.0.0

A security release. Every item below was reachable on a default configuration,
so updating is strongly recommended. Reported by Yaseen Royqk (the PDF renderer
SSRF and the SVG upload) and by Timur Seyidov, whose review of 1.0.39 against
his Python port found the rest.

### Breaking

- **`html`, `htm` and `js` are no longer in the default `extensions`.** Uploads
  are served by a plain web server from `baseurl`, so an uploaded page ran its
  script in whatever origin serves the files. A source that really needs these
  types lists them in its own `extensions`.
- **`fetchGuardedAgainstSsrf` no longer returns a web `Response`.** It returns
  `{ status, headers, stream }`, because the request is now made over
  `node:http` to a pinned address. `readBodyWithLimit` takes that object.

### Security

- **SSRF in `generatePdf`.** The renderer was handed client HTML and loaded
  every URL in it, with the fetched content drawn into the returned PDF, which
  made it a readable proxy into anything the container could reach, including
  the cloud metadata service. Requests from the page are now intercepted and
  checked; see the new `remoteResources` configuration.
- **SSRF in `generateDocx`.** The converter downloaded the images it found and
  embedded the answers in `word/media/` of the returned document. Images are
  now checked before the converter sees them, and `iframe`, `frame`,
  `frameset`, `object`, `embed`, `link` and `base` are dropped from the markup
  (`base` rewrites what relative URLs resolve to).
- **SSRF guard bypassed by IPv6 spellings of IPv4 addresses.** `new URL()`
  rewrites `::ffff:10.0.0.1` into hex, and only the dotted form was recognised,
  so everything wrapped in IPv6 counted as public. IPv4-mapped (both
  spellings), IPv4-compatible, 6to4, NAT64 and Teredo addresses now have their
  embedded IPv4 checked.
- **SSRF guard bypassed by DNS rebinding.** The host was resolved for the check
  and then resolved again to connect, so a name answering differently the
  second time went somewhere the check never saw. The request now goes to the
  address that was checked, keeping the original `Host` header and TLS server
  name.
- **Unbounded download in `fileUploadRemote`.** The body was read whole and
  measured afterwards, so a huge or endless answer exhausted memory. The limit
  is enforced while the body streams, and `timeoutLimit` now applies to the
  request.
- **A refused upload destroyed an existing file.** Validation ran after the
  write, so with `saveSameFileNameStrategy: "replace"` an upload that was then
  rejected had already overwritten the file of the same name, and the cleanup
  deleted it. A user without upload rights could delete files by name. Nothing
  is written until every file in the request has passed, and a rollback only
  removes what the request itself created.
- **`imageSave` ignored `extensions`.** Only the bytes were checked, so a valid
  image with a payload appended could be stored as `shell.php` or `evil.html`.
  The target name now goes through the same whitelist as an upload.
- **Uploaded SVG kept its scripting.** An SVG is served as `image/svg+xml` and
  runs in the origin that serves it. Uploads through `fileUpload`,
  `fileUploadRemote` and `imageSave` are now stripped of `script`,
  `foreignObject`, event handlers, `javascript:` links, external references and
  processing instructions; a file declaring XML entities is refused. Turn it
  off with `sanitizeSvgUploads: false`.
- **Access rules could be stepped around by spelling the path differently.**
  `private`, `./private` and `/public/../private` did not match a rule written
  for `/private`, which let `files` and `folders` list a folder the
  configuration meant to hide. Paths are made absolute and resolved before
  rules are matched.
- **`folderRemove` could delete the folder being browsed.** A name resolving
  back to the current folder (`.`, or `sub/..`) passed the "inside the current
  directory" check, and with `path=/` that removed the whole source.
- **Server paths disclosed in responses.** Storage errors carried absolute
  paths from the operating system, and a thumbnail that could not be generated
  was reported as a `../../..` path relative to the working directory. Roots
  are stripped from error messages, and such a thumbnail is reported by name.
- **Writes could land behind a symlinked folder.** `verifyRealPath` skipped its
  check for a path that does not exist yet, so while the link itself was
  refused, a new entry under it was not. The real location of a path about to
  be created is now resolved from its deepest existing ancestor. (This one
  could not be reproduced on a default configuration; the check was hardened
  because the gap in it was real.)

### Added

- `remoteResources` configuration for the `generatePdf` and `generateDocx`
  renderers: `allowPrivateNetwork` (off by default), plus `allow` and `deny`
  URL masks where `*` matches any run of characters. An empty `allow` means any
  public address.
- `sanitizeSvgUploads` configuration, on by default.
- `CHROMIUM_SANDBOX=1` keeps the Chromium sandbox on. It is off by default
  because Docker's default seccomp profile blocks the syscalls the sandbox
  needs, and a container that cannot start Chromium is worse than one that
  renders without it. A profile that allows it ships as
  `docker/chromium-seccomp.json`:
  `docker run --security-opt seccomp=./docker/chromium-seccomp.json -e CHROMIUM_SANDBOX=1 …`
- `CHROMIUM_BLOCKED_HOSTS`, an optional comma-separated list of hosts that must
  not resolve inside the renderer. Empty by default; it covers what request
  interception cannot see, such as Chromium's own speculative lookups.

### Changed

- The Docker image runs as the unprivileged `node` user instead of root, and
  ships `chromium-sandbox`.
