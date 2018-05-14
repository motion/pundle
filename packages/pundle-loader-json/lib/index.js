// @flow

import path from 'path'
import { createFileLoader } from 'pundle-api'

import manifest from '../package.json'

export default function({ extensions = ['.json'] }: { extensions?: Array<string> } = {}) {
  return createFileLoader({
    name: 'pundle-loader-json',
    version: manifest.version,
    callback({ contents, filePath, format }) {
      const extName = path.extname(filePath)
      if (!extensions.includes(extName) || format !== 'js') {
        return null
      }
      let parsed
      try {
        parsed = contents.toString()
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Error parsing JSON at '${filePath}'`)
        }
        throw error
      }
      return {
        contents: `module.exports = ${JSON.stringify(parsed)}`,
        isBuffer: false,
        sourceMap: null,
      }
    },
  })
}