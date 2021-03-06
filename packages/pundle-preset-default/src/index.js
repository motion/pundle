// @flow
/* eslint-disable global-require */

const BABEL_ALLOWED_VERSIONS = new Set([6, 7])
const DEFAULT_STATICS = [
  '.png',
  '.jpg',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.svg',
  '.webp',
  '.jpeg',
  '.gif',
  '.apng',
  '.bmp',
]

function getPresetComponents({
  report: { cli: reportCLI = true } = {},
  transform: {
    cson = true,
    css = true,
    coffee = true,
    json = true,
    json5 = false,
    babel = false,
    graphql = true,
    js = true,
    less = true,
    sass = true,
    statics = {},
    stylus = true,
    toml = true,
    postcss = false,
    typescript = true,
    yaml = true,
  } = {},
  development = process.env.NODE_ENV !== 'production',
  generate: { js: generateJS = true, css: generateCSS = true, html: generateHTML = true } = {},
  optimize: { js: optimizeJS = !development, css: optimizeCSS = !development, html: optimizeHTML = !development } = {},
  resolve = true,
}: {
  report?: {
    cli?: boolean,
  },
  transform?: {
    cson?: boolean | Object,
    css?: boolean | Object,
    coffee?: boolean | Object,
    json?: boolean | Object,
    json5?: boolean | Object,
    babel?: 6 | 7 | Object | false,
    graphql?: boolean | Object,
    js?: boolean | Object,
    less?: boolean | Object,
    sass?: boolean | Object,
    statics?: boolean | Object,
    stylus?: boolean | Object,
    toml?: boolean | Object,
    postcss?: boolean | Object,
    typescript?: boolean | Object,
    yaml?: boolean | Object,
  },
  development?: boolean,
  generate?: {
    js?: boolean,
    csss?: boolean,
    html?: boolean,
  },
  optimize?: {
    js?: boolean | { uglify?: boolean | Object, common?: boolean | Object, dedupe?: boolean | Object },
    css?: boolean | { cssnano?: boolean | Object },
    html?: boolean,
  },
  resolve?: boolean | { aliases: Object, external: Array<string> },
} = {}) {
  const components = []
  const extensions = {
    css: new Set(['.css']),
    js: new Set(['.js', '.mjs']),
    static: new Set([]),
  }
  if (statics) {
    DEFAULT_STATICS.concat(statics.extensions || []).forEach(ext => extensions.static.add(ext))
  }

  if (reportCLI) {
    components.push(require('@pundle/reporter-cli')())
  }
  if (cson) {
    extensions.js.add('.cson')
    components.push(
      require('@pundle/transformer-cson')({
        ...cson,
      }),
    )
  }
  if (coffee) {
    extensions.js.add('.coffee')
    components.push(
      require('@pundle/transformer-coffee')({
        ...coffee,
      }),
    )
  }
  if (json && !json5) {
    extensions.js.add('.json')
    components.push(
      require('@pundle/transformer-json')({
        ...json,
      }),
    )
  }
  if (json5) {
    extensions.js.add('.json')
    extensions.js.add('.json5')
    components.push(
      require('@pundle/transformer-json5')({
        extensions: ['.json', '.json5'],
        ...json5,
      }),
    )
  }
  if (babel) {
    if (typeof babel === 'number' && !BABEL_ALLOWED_VERSIONS.has(babel)) {
      throw new Error(
        `preset-default expects config.babel to be any of ${Array.from(BABEL_ALLOWED_VERSIONS).join(
          ', ',
        )} but got: ${babel} (type ${typeof babel})`,
      )
    }
    components.push(
      require('@pundle/transformer-babel')(
        typeof babel === 'number'
          ? {
              version: babel,
            }
          : babel,
      ),
    )
  }
  if (less) {
    extensions.css.add('.less')
    components.push(
      require('@pundle/transformer-less')({
        ...less,
      }),
    )
  }
  if (sass) {
    extensions.css.add('.scss')
    extensions.css.add('.sass')
    components.push(
      require('@pundle/transformer-sass')({
        ...sass,
      }),
    )
  }
  if (stylus) {
    extensions.css.add('.styl')
    extensions.css.add('.stylus')
    components.push(
      require('@pundle/transformer-stylus')({
        ...stylus,
      }),
    )
  }
  if (postcss) {
    components.push(
      require('@pundle/transformer-postcss')({
        extensions: Array.from(extensions.css),
        ...postcss,
      }),
    )
  }
  if (typescript) {
    extensions.js.add('.ts')
    extensions.js.add('.tsx')
    components.push(
      require('@pundle/transformer-typescript')({
        ...typescript,
      }),
    )
  }
  if (toml) {
    extensions.js.add('.toml')
    components.push(
      require('@pundle/transformer-toml')({
        ...toml,
      }),
    )
  }
  if (yaml) {
    extensions.js.add('.yaml')
    extensions.js.add('.yml')
    components.push(
      require('@pundle/transformer-yaml')({
        ...yaml,
      }),
    )
  }
  if (graphql) {
    extensions.js.add('.gql')
    extensions.js.add('.graphql')
    components.push(
      require('@pundle/transformer-graphql')({
        ...graphql,
      }),
    )
  }
  if (js) {
    components.push(
      require('@pundle/transformer-js')({
        injectNodeGlobals: 'auto',
        ...js,
      }),
    )
  }
  if (statics) {
    components.push(
      require('@pundle/transformer-static')({
        ...statics,
        extensions: Array.from(extensions.static),
      }),
    )
  }
  if (css) {
    components.push(
      require('@pundle/transformer-css')({
        development,
        extensions: Array.from(extensions.css),
        ...css,
      }),
    )
  }
  if (resolve) {
    components.push(
      require('@pundle/resolver-default')({
        ...resolve,
        formats: {
          js: Array.from(extensions.js),
          css: Array.from(extensions.css),
          static: Array.from(extensions.static),
          ...(generateHTML ? { html: ['.html', '.htm'] } : {}),
        },
      }),
    )
  }
  if (generateJS) {
    components.push(require('@pundle/chunk-generator-js')())
  }
  if (generateCSS) {
    components.push(require('@pundle/chunk-generator-css')())
  }
  if (generateHTML) {
    components.push(require('@pundle/chunk-generator-html')())
  }
  components.push(require('@pundle/chunk-generator-static')())

  if (optimizeJS) {
    if (typeof optimizeJS === 'boolean' || optimizeJS.common) {
      components.push(
        require('@pundle/job-transformer-js-common')({
          ...optimizeJS.common,
        }),
      )
    }
    if (typeof optimizeJS === 'boolean' || optimizeJS.uglify) {
      components.push(
        require('@pundle/chunk-transformer-uglify')({
          uglifier: 'terser',
          ...(optimizeJS && optimizeJS.uglify),
        }),
      )
    }
    if (typeof optimizeJS === 'boolean' || optimizeJS.dedupe) {
      components.push(
        require('@pundle/job-transformer-js-dedupe')({
          ...(optimizeJS && optimizeJS.dedupe),
        }),
      )
    }
  }
  if (optimizeCSS) {
    components.push(
      require('@pundle/chunk-transformer-cssnano')({
        ...(optimizeCSS && optimizeCSS.cssnano),
      }),
    )
  }
  if (optimizeHTML) {
    /* TODO: Implement html chunk transformer */
  }

  return components
}

module.exports = getPresetComponents
