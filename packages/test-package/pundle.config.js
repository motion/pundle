import path from 'path'

import cssnano from 'cssnano'
import cliReporter from 'pundle-reporter-cli'
import resolverDefault from 'pundle-resolver-default'
import transformerJS from 'pundle-transformer-js'
import transformerCSS from 'pundle-transformer-css'
import transformerSass from 'pundle-transformer-sass'
import transformerLess from 'pundle-transformer-less'
import transformerCSON from 'pundle-transformer-cson'
import transformerJSON from 'pundle-transformer-json'
import transformerJSON5 from 'pundle-transformer-json5'
import transformerBabel from 'pundle-transformer-babel'
import transformerStatic from 'pundle-transformer-static'
import transformerPostcss from 'pundle-transformer-postcss'
import transformerTypescript from 'pundle-transformer-typescript'
import chunkGeneratorJs from 'pundle-chunk-generator-js'
import chunkGeneratorHtml from 'pundle-chunk-generator-html'
import chunkGeneratorStatic from 'pundle-chunk-generator-static'
import browserAliases from 'pundle-resolver-aliases-browser'

export default {
  entry: ['./src', './index.html'],
  components: [
    cliReporter(),
    resolverDefault({
      formats: {
        js: ['.js', '.mjs', '.json', '.ts', '.tsx', '.json5', '.cson'],
        html: ['.html'],
        css: ['.css', '.less', '.scss'],
        static: ['.png'],
      },
      aliases: browserAliases,
    }),
    transformerCSON(),
    transformerJSON(),
    transformerJSON5(),
    transformerBabel(),
    transformerJS({
      transformCore: true,
    }),
    transformerLess(),
    transformerCSS({
      extensions: ['.css', '.less', '.scss'],
    }),
    transformerSass(),
    transformerStatic({
      extensionsOrMimes: ['.png'],
    }),
    transformerPostcss({
      plugins: [cssnano({ preset: 'default' })],
    }),
    transformerTypescript(),
    chunkGeneratorJs(),
    chunkGeneratorHtml(),
    chunkGeneratorStatic({ formats: ['css'] }),
  ],
  rootDirectory: __dirname,
  output: {
    rootDirectory: path.join(__dirname, 'dist'),
    formats: {
      '*.map': 'assets/[id].[format]',
      static: 'assets/[id][ext]',
      '*': 'assets/[id].[format]',
      html: '[name].[format]',
    },
  },
}
