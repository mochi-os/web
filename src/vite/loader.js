// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The module loader each app page carries inline (see mochi-plugin.js).
//
// Inside the shell's sandboxed frame the page's origin is opaque, and Chrome's
// HTTP cache neither stores nor serves anything for such a document: every
// page view downloaded the app's whole bundle again. The shell page is the
// server's own origin and its cache works, so when the shell offers to (it
// names the frames it makes 'mochi:bridge') the code is fetched through it
// and run from the text it hands back. Native ES modules cannot run that way
// - a module evaluated from text has no URL its relative imports could
// resolve against - so the bundles are built as System.register modules,
// which this loads, keeping each module's own URL for its imports and
// import.meta.url.
//
// Outside the shell, under a shell without the bridge, and for anything the
// shell will not carry, each module loads as a plain script from its URL.
//
// manifest names, for each chunk, every chunk it statically imports, directly
// or not, so they are all asked for at once rather than one level at a time.
// styles are the app's stylesheets: outside the shell a blocking <link>, as
// the page had before, and in the frame taken through the shell too and in
// place before the app runs.
//
// This function's source is inlined into the page, so it uses nothing from
// its module.
export function loader(manifest, entry, styles) {
  'use strict'

  // A load failure reads as the browser's own for a failed dynamic import, so
  // lib/web's page-load recovery treats it the same way.
  function failure(url) {
    return new Error('Failed to fetch dynamically imported module: ' + url)
  }

  var origin = new URL(location.href).origin
  var bridged =
    window.parent !== window &&
    window.name === 'mochi:bridge' &&
    origin !== 'null'

  // Chunk URL -> the URLs of every chunk it imports statically.
  var closures = Object.create(null)
  var base = new URL(entry, document.baseURI)
  var files = manifest[0].map(function (file) {
    return new URL(file, base).href
  })
  manifest[1].forEach(function (pair) {
    closures[files[pair[0]]] = pair[1].map(function (dependency) {
      return files[dependency]
    })
  })

  // --- Fetching ---

  var waiting = Object.create(null)
  var carrying = Object.create(null) // URL -> Promise of its text, or null
  if (bridged) {
    window.addEventListener('message', function (event) {
      if (event.source !== window.parent || event.origin !== origin) return
      var data = event.data
      if (!data || data.type !== 'fetch.result' || typeof data.id !== 'string')
        return
      var settle = waiting[data.id]
      if (!settle) return
      delete waiting[data.id]
      settle(data)
    })
  }

  function identifier() {
    var bytes = crypto.getRandomValues(new Uint8Array(16))
    var text = ''
    for (var i = 0; i < bytes.length; i++)
      text += (bytes[i] + 256).toString(16).slice(1)
    return text
  }

  // The script's text as the shell fetched it, from the top window's cache, or
  // null when the shell will not carry it and the script loads natively.
  function carried(url, kind) {
    if (!bridged) return Promise.resolve(null)
    kind = kind || /javascript/i
    if (carrying[url]) return carrying[url]
    return (carrying[url] = new Promise(function (resolve) {
      var id = identifier()
      // The shell answers every request, refusals included; this is for one
      // that is lost, and long enough that a slow link is not taken for one.
      // A request given up on is ended, so it is not downloaded twice.
      var timer = setTimeout(function () {
        delete waiting[id]
        try {
          window.parent.postMessage({ type: 'fetch.abort', id: id }, origin)
        } catch (error) {
          // The shell has gone; nothing to end.
        }
        resolve(null)
      }, 60000)
      waiting[id] = function (reply) {
        clearTimeout(timer)
        var type = ''
        var headers = Array.isArray(reply.headers) ? reply.headers : []
        for (var i = 0; i < headers.length; i++) {
          if (String(headers[i][0]).toLowerCase() === 'content-type')
            type = String(headers[i][1])
        }
        resolve(
          reply.status === 200 &&
            Object.prototype.toString.call(reply.body) ===
              '[object ArrayBuffer]' &&
            kind.test(type)
            ? new TextDecoder().decode(reply.body)
            : null
        )
      }
      try {
        window.parent.postMessage(
          { type: 'fetch', id: id, url: url, method: 'GET', headers: [] },
          origin
        )
      } catch (error) {
        clearTimeout(timer)
        delete waiting[id]
        resolve(null)
      }
    }))
  }

  // Ask for a chunk before it is needed: through the shell, or as a preload
  // the script element later takes up.
  var hinted = Object.create(null)
  function prefetch(url) {
    if (registry[url]) return
    if (bridged) {
      carried(url)
      return
    }
    if (hinted[url]) return
    hinted[url] = true
    var link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'script'
    link.crossOrigin = 'anonymous'
    link.href = url
    document.head.appendChild(link)
  }

  // --- Registration ---

  var registrations = Object.create(null) // URL -> [dependencies, declare]
  var evaluating = null // URL of the text being evaluated

  function register(dependencies, declare) {
    var url = evaluating
    if (!url) {
      var script = document.currentScript
      url = script && script.src
    }
    if (url) registrations[url] = [dependencies, declare]
  }

  function registration(url) {
    var found = registrations[url]
    delete registrations[url]
    if (!found) throw failure(url)
    return found
  }

  function script(url) {
    return new Promise(function (resolve, reject) {
      var element = document.createElement('script')
      // CORS mode, as a module script was: inside the sandboxed frame every
      // URL is cross-origin, and a classic script's errors would reach
      // window.onerror only as "Script error.".
      element.crossOrigin = 'anonymous'
      element.src = url
      element.addEventListener('error', function () {
        element.remove()
        reject(failure(url))
      })
      element.addEventListener('load', function () {
        element.remove()
        try {
          resolve(registration(url))
        } catch (error) {
          reject(error)
        }
      })
      document.head.appendChild(element)
    })
  }

  function instantiate(url) {
    return carried(url).then(function (text) {
      if (text === null) return script(url)
      delete carrying[url]
      evaluating = url
      try {
        ;(0, eval)(text + '\n//# sourceURL=' + url)
      } finally {
        evaluating = null
      }
      return registration(url)
    })
  }

  // --- Linking and execution, as SystemJS's core does it ---

  var registry = Object.create(null) // URL -> load record

  function resolve(specifier, parent) {
    return new URL(specifier, parent).href
  }

  function record(url) {
    var load = registry[url]
    if (load) return load
    var importers = []
    var namespace = Object.create(null)
    if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
      Object.defineProperty(namespace, Symbol.toStringTag, { value: 'Module' })
    }
    ;(closures[url] || []).forEach(prefetch)

    var instantiated = Promise.resolve()
      .then(function () {
        return instantiate(url)
      })
      .then(
        function (registered) {
          function bind(name, value) {
            load.hoisted = true
            var changed = false
            if (typeof name === 'string') {
              if (!(name in namespace) || namespace[name] !== value) {
                namespace[name] = value
                changed = true
              }
            } else {
              for (var key in name) {
                var next = name[key]
                if (!(key in namespace) || namespace[key] !== next) {
                  namespace[key] = next
                  changed = true
                }
              }
              if (name && name.__esModule)
                namespace.__esModule = name.__esModule
            }
            if (changed) {
              for (var i = 0; i < importers.length; i++) {
                if (importers[i]) importers[i](namespace)
              }
            }
            return value
          }
          var declared = registered[1](bind, {
            import: function (specifier) {
              return load_module(resolve(specifier, url))
            },
            meta: { url: url },
          })
          load.execute = declared.execute || function () {}
          return [registered[0], declared.setters || []]
        },
        function (error) {
          load.execute = null
          load.error = error
          throw error
        }
      )

    var linked = instantiated.then(function (instantiation) {
      return Promise.all(
        instantiation[0].map(function (dependency, i) {
          var setter = instantiation[1][i]
          var other = record(resolve(dependency, url))
          return Promise.resolve(other.instantiated).then(function () {
            if (setter) {
              other.importers.push(setter)
              if (other.hoisted || !other.instantiated) setter(other.namespace)
            }
            return other
          })
        })
      ).then(function (dependencies) {
        load.dependencies = dependencies
      })
    })

    load = registry[url] = {
      url: url,
      importers: importers,
      namespace: namespace,
      instantiated: instantiated,
      linked: linked,
      hoisted: false,
      dependencies: undefined,
      execute: undefined,
      error: undefined,
      executing: undefined,
      completed: undefined,
    }
    return load
  }

  function link_all(load, seen) {
    if (seen[load.url]) return
    seen[load.url] = true
    return Promise.resolve(load.linked)
      .then(function () {
        return Promise.all(
          load.dependencies.map(function (dependency) {
            return link_all(dependency, seen)
          })
        )
      })
      .catch(function (error) {
        if (load.error) throw error
        load.execute = null
        throw error
      })
  }

  var context = Object.freeze(Object.create(null))

  // Dependencies first, unless they are already running (a cycle). A
  // promise only when something in the graph awaits at its top level.
  function execute(load, seen) {
    if (seen[load.url]) return
    seen[load.url] = true
    if (!load.execute) {
      if (load.error) throw load.error
      if (load.executing) return load.executing
      return
    }
    var run = load.execute
    load.execute = null

    var pending
    load.dependencies.forEach(function (dependency) {
      try {
        var waited = execute(dependency, seen)
        if (waited) (pending = pending || []).push(waited)
      } catch (error) {
        load.error = error
        throw error
      }
    })
    if (pending) return Promise.all(pending).then(go)
    return go()

    function go() {
      try {
        var result = run.call(context)
        if (result) {
          result = result.then(
            function () {
              load.completed = load.namespace
              load.executing = null
            },
            function (error) {
              load.error = error
              load.executing = null
              throw error
            }
          )
          return (load.executing = result)
        }
        load.completed = load.namespace
        load.linked = load.instantiated = undefined
      } catch (error) {
        load.error = error
        throw error
      }
    }
  }

  function load_module(url) {
    var load = record(url)
    if (load.completed) return Promise.resolve(load.completed)
    return (load.completed = link_all(load, {})
      .then(function () {
        return execute(load, {})
      })
      .then(function () {
        return load.namespace
      }))
  }

  // --- Stylesheets ---

  // Until the app's own stylesheet arrives the frame's document has no colour
  // scheme, and a dark shell then paints the frame's canvas white.
  var scheme = document.createElement('style')
  scheme.textContent = ':root.dark{color-scheme:dark}'
  document.head.appendChild(scheme)

  function linked(url) {
    return new Promise(function (resolve) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.crossOrigin = 'anonymous'
      link.href = url
      link.addEventListener('load', resolve)
      link.addEventListener('error', resolve)
      document.head.appendChild(link)
    })
  }

  // The addresses a stylesheet names - its fonts and images - made absolute
  // against its own address, as a <link> resolves them. A constructed sheet
  // resolves them against the page's instead: Chrome ignores the baseURL its
  // constructor takes.
  function absolute(text, url) {
    return text.replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
      function (whole, quote, address) {
        if (/^(#|[a-z][a-z0-9+.-]*:)/i.test(address)) return whole
        try {
          return 'url(' + quote + new URL(address, url).href + quote + ')'
        } catch (error) {
          return whole
        }
      }
    )
  }

  // In place, from the shell's copy where it can be.
  function adopted(url) {
    return carried(url, /css/i).then(function (text) {
      if (text !== null && document.adoptedStyleSheets) {
        try {
          var sheet = new CSSStyleSheet()
          sheet.replaceSync(absolute(text, url))
          document.adoptedStyleSheets = document.adoptedStyleSheets.concat([
            sheet,
          ])
          return
        } catch (error) {
          // A browser without constructed sheets: the <link> below.
        }
      }
      return linked(url)
    })
  }

  var urls = (styles || []).map(function (style) {
    return new URL(style, document.baseURI).href
  })
  var styled = Promise.resolve()
  if (bridged) {
    styled = Promise.all(urls.map(adopted))
  } else {
    // Written while the page is still being read, so it blocks the first
    // paint as the page's own <link> did.
    urls.forEach(function (url) {
      document.write(
        '<link rel="stylesheet" crossorigin href="' +
          url.replace(/"/g, '&quot;') +
          '">'
      )
    })
  }

  window.System = { register: register }

  // The code is fetched while the stylesheets are, and runs once they are in.
  record(base.href)
  styled
    .then(function () {
      return load_module(base.href)
    })
    .catch(function (error) {
      // Reported as an uncaught error, as a failed module script is.
      setTimeout(function () {
        throw error
      })
    })
}
