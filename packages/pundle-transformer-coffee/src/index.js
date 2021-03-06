// @flow

import path from 'path'
import nanomatch from 'nanomatch'
import { createFileTransformer, loadLocalFromContext } from '@pundle/api'

import manifest from '../package.json'

const DEFAULT_EXCLUDE = [/node_modules/]

function createComponent({
  exclude = DEFAULT_EXCLUDE,
  extensions = ['.coffee'],
  processOutsideProjectRoot,
}: { exclude?: Array<string | RegExp>, extensions?: Array<string>, processOutsideProjectRoot?: boolean } = {}) {
  return createFileTransformer({
    name: manifest.name,
    version: manifest.version,
    priority: 1250,
    async callback({ file, context }) {
      const extName = path.extname(file.filePath)
      if (!extensions.includes(extName) || file.format !== 'js') {
        return null
      }

      if (exclude.some(item => nanomatch.isMatch(file.filePath, item))) {
        // Excluded
        return null
      }
      if (!processOutsideProjectRoot && !file.filePath.startsWith(context.config.rootDirectory)) {
        // Outside project root
        return null
      }

      const exported = await loadLocalFromContext(context, 'coffeescript')
      const transformed = exported.compile(typeof file.contents === 'string' ? file.contents : file.contents.toString(), {
        filename: file.filePath,
        sourceMap: true,
      })

      return {
        contents: transformed.js,
        sourceMap: JSON.parse(transformed.v3SourceMap),
      }
    },
  })
}

module.exports = createComponent
