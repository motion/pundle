// @flow

import fs from 'sb-fs'
import path from 'path'
import pReduce from 'p-reduce'
import {
  getFileImportHash,
  type ImportResolved,
  type ImportRequest,
  type WorkerProcessResult,
  type ComponentFileResolverResult,
} from 'pundle-api'
import type { Config } from 'pundle-core-load-config'
import type Communication from 'sb-communication'

import type { RunOptions, WorkerType } from '../types'

export default class Worker {
  type: WorkerType
  config: Config
  options: RunOptions
  bridge: Communication

  constructor(type: WorkerType, config: Config, options: RunOptions, bridge: Communication) {
    this.type = type
    this.config = config
    this.options = options
    this.bridge = bridge
  }
  async resolve({ request, requestRoot, ignoredResolvers }: ImportRequest): Promise<ComponentFileResolverResult> {
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
        // TODO: Validation?
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
  async resolveFromMaster(payload: ImportRequest) {
    return this.bridge.send('resolve', payload)
  }
  async process({ filePath, format }: ImportResolved): Promise<WorkerProcessResult> {
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
        // TODO: Validation?
        return response || payload
      },
      initialPayload,
    )
    if (result === initialPayload) {
      throw new Error(`Unable to load file '${filePath}' of format '${format}'`)
    }

    const fileImports = []
    const fileChunks = []

    const transformers = this.config.components.filter(c => c.type === 'file-transformer')
    const transformed = await pReduce(
      transformers,
      async (payload, transformer) => {
        const response = await transformer.callback(
          {
            ...payload,
            format,
            filePath,
          },
          {
            resolve: async request => {
              const resolved = await this.resolveFromMaster({
                request,
                requestRoot: path.dirname(filePath),
                ignoredResolvers: [],
              })
              return { filePath: resolved.resolved, format: resolved.format }
            },
            addImport(fileImport) {
              // TODO: Validation
              fileImports.push(fileImport)
            },
            addChunk(chunk) {
              // TODO: Validation
              fileChunks.push(chunk)
            },
          },
        )
        if (response) {
          // TODO: Validation?
          // TODO: Merge isBuffer, contents and sourceMap here instead of returning like this
          return response
        }
        return payload
      },
      {
        contents: result.contents,
        isBuffer: result.isBuffer,
        sourceMap: result.sourceMap,
      },
    )

    return {
      ...transformed,
      id: getFileImportHash(filePath, format),
      format,
      filePath,
      imports: fileImports,
      chunks: fileChunks,
    }
  }
}