// @flow

import fs from 'sb-fs'
import pReduce from 'p-reduce'
import type { Config } from 'pundle-core-load-config'
import type { RunOptions, WorkerType } from '../types'

export default class Worker {
  type: WorkerType
  config: Config
  options: RunOptions

  constructor(type: WorkerType, config: Config, options: RunOptions) {
    this.type = type
    this.config = config
    this.options = options
  }
  async resolve({ request, requestRoot, ignoredResolvers }: $FlowFixMe) {
    const resolvers = this.config.components.filter(c => c.type === 'file-resolver')
    const allowedResolvers = resolvers.filter(c => !ignoredResolvers.includes(c.name))

    if (!resolvers.length) {
      throw new Error('No resolvers have been configured')
    }
    if (!allowedResolvers.length) {
      throw new Error('All resolvers have been excluded by config')
    }

    const result = await pReduce(
      allowedResolvers,
      async (payload, resolver) => {
        const response = await resolver.callback(payload)
        return response || payload
      },
      {
        request,
        requestRoot,
        ignoredResolvers,
        format: null,
        resolved: null,
        resolvedRoot: null,
      },
    )

    if (!result.resolved) {
      throw new Error(`Unable to resolve '${request}' from '${requestRoot}'`)
    }
    if (!result.format) {
      throw new Error(`Resolved request '${request}' to '${result.resolved}' but format was not determined`)
    }
    return result
  }
  async process({ filePath, format }: { filePath: string, format: string }): Promise<void> {
    const contents = await fs.readFile(filePath)
    const initialPayload = {
      format,
      contents,
      filePath,
    }

    const loaders = this.config.components.filter(c => c.type === 'file-loader')
    if (!loaders.length) {
      throw new Error('No loaders have been configured')
    }
    const result = await pReduce(
      loaders,
      async (payload, loader) => {
        if (payload !== initialPayload) {
          // Already been loaded
          return payload
        }

        const response = await loader.callback(payload)
        return response || payload
      },
      initialPayload,
    )
    if (result === initialPayload) {
      throw new Error(`Unable to load file '${filePath}' of format '${format}'`)
    }
    console.log('result', result)
  }
}
