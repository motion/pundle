// @flow

import type { Config } from 'pundle-core-load-config'

import PundleError from '../pundle-error'
import { getFileName } from '../common'
import type { Component, ComponentType, ImportRequest, ImportResolved, ResolutionPayload } from '../types'
import * as validators from './validators'

export default class Context {
  config: Config
  configInline: Object
  configFileName: string
  configLoadFile: boolean
  directory: string

  constructor({
    config,
    configInline,
    configFileName,
    configLoadFile,
    directory,
  }: {|
    config: Config,
    configInline: Object,
    configFileName: string,
    configLoadFile: boolean,
    directory: string,
  |}) {
    this.config = config
    this.configInline = configInline
    this.configFileName = configFileName
    this.configLoadFile = configLoadFile
    this.directory = directory
  }
  serialize() {
    return {
      configInline: this.configInline,
      configFileName: this.configFileName,
      configLoadFile: this.configLoadFile,
      directory: this.directory,
    }
  }
  getComponents<T1: ComponentType, T2>(type: T1): Array<Component<T1, T2>> {
    return this.config.components.filter(c => c.type === type)
  }
  getFileName(payload: ResolutionPayload) {
    return getFileName(this.config.output.formats, payload)
  }
  async invokeFileResolvers({ request, requestFile, ignoredResolvers }: ImportRequest): Promise<ImportResolved> {
    const allResolvers = this.getComponents('file-resolver')
    const resolvers = allResolvers.filter(c => !ignoredResolvers.includes(c.name))

    if (!allResolvers.length) {
      throw new PundleError('WORK', 'RESOLVE_FAILED', 'No file resolvers configured', requestFile)
    }
    if (!resolvers.length) {
      throw new PundleError('WORK', 'RESOLVE_FAILED', 'All resolvers were ignored', requestFile)
    }

    let resolved

    for (const resolver of resolvers) {
      resolved = await resolver.callback({
        context: this,
        request,
        requestFile,
        ignoredResolvers,
      })
      if (!resolved) continue

      const errors = await validators.resolved(resolved)
      if (errors)
        throw new PundleError(
          'WORK',
          'RESOLVE_FAILED',
          `Resolver '${resolver.name}' returned invalid result: ${errors.join(', ')}`,
        )
    }

    if (!resolved) {
      throw new PundleError('WORK', 'RESOLVE_FAILED', `Unable to resolve '${request}'`, requestFile)
    }
    return resolved
  }
}
