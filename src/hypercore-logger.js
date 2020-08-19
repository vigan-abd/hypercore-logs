'use strict'

const _ = require('lodash')
const debug = require('debug')('hcore-logger')
const hypercore = require('hypercore')
const replicate = require('@hyperswarm/replicator')

class HyperCoreLogger {
  /**
   * @param {string|Function} feedDir
   * @param {string|Buffer} [feedKey]
   *
   * @param {Object} [feedOpts]
   * @param {boolean} [feedOpts.createIfMissing]
   * @param {'json'|'utf-8'|'binary'} [feedOpts.valueEncoding]
   * @param {boolean} [feedOpts.eagerUpdate]
   * @param {string|Buffer} [feedOpts.secretKey]
   * @param {boolean} [feedOpts.storeSecretKey]
   * @param {number} [feedOpts.storageCacheSize]
   * @param {(index: number, data: any, peer: Peer, cb: Function) => void} [feedOpts.onwrite]
   * @param {boolean} [feedOpts.stats]
   * @param {Object} [feedOpts.crypto]: {
   * @param {(data: any, secretKey: string|Buffer, cb: Function) => void} feedOpts.crypto.sign
   * @param {(signature: any, data: any, key: string|Buffer, cb: function name(params)} feedOpts.crypto.verify
   * @param {Object} [feedOpts.noiseKeyPair]
   * @param {string|Buffer} feedOpts.noiseKeyPair.publicKey
   * @param {string|Buffer} feedOpts.noiseKeyPair.secretKey
   *
   * @param {Object} [swarmOpts]
   * @param {string[]} [swarmOpts.bootstrap]
   * @param {any} [swarmOpts.ephemeral]
   * @param {number} [swarmOpts.maxPeers]
   * @param {number} [swarmOpts.maxServerSockets]
   * @param {number} [swarmOpts.maxClientSockets]
   * @param {(peer: Peer) => boolean} [swarmOpts.validatePeer]
   * @param {Object} [swarmOpts.queue]
   * @param {number} swarmOpts.queue.requeue
   * @param {Object} swarmOpts.queue.forget
   * @param {number} swarmOpts.queue.forget.unresponsive
   * @param {number} swarmOpts.queue.forget.banned
   * @param {boolean} [swarmOpts.multiplex]
   */
  constructor (feedDir, feedKey = null, feedOpts = null, swarmOpts = null) {
    feedOpts = feedOpts || {}
    this.feedOpts = _.assign(feedOpts, {
      valueEncoding: feedOpts.valueEncoding || 'utf-8',
      sparse: true,
      live: true,
      overwrite: false
    })

    swarmOpts = swarmOpts || {}
    this.swarmOpts = _.assign(swarmOpts, {
      live: true,
      upload: true,
      download: false,
      announce: true,
      lookup: true
    })

    this.feedKey = feedKey
    this.feedDir = feedDir
  }

  async start () {
    this.feed = hypercore(this.feedDir, this.feedKey, this.feedOpts)

    await new Promise((resolve, reject) => {
      this.feed.ready((err) => {
        if (err) return reject(err)

        this.swarm = replicate(this.feed, this.swarmOpts, (err) => {
          if (err) return reject(err)

          this.feedKey = this.feed.key.toString('hex')
          debug('key: %s', this.feedKey)
          debug('secret-key: %s', this.feed.secretKey.toString('hex'))
          resolve()
        })
      })
    })
  }

  async stop () {
    await new Promise((resolve, reject) => {
      this.swarm.destroy((err) => {
        if (err) return reject(err)
        this.feed.close((err) => err ? reject(err) : resolve())
      })
    })
    debug('writer closed')
  }
}

module.exports = HyperCoreLogger
