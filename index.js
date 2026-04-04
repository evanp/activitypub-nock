import as2 from './activitystreams.js'
import nock from 'nock'
import crypto from 'node:crypto'
import { promisify } from 'node:util'

const PAGE_SIZE = 20

const generateKeyPair = promisify(crypto.generateKeyPair)

const defaultDomain = 'social.example'

const domains = new Map()
domains[defaultDomain] = new Map()

const graph = new Map()
graph[defaultDomain] = new Map()

const collections = new Map()
collections[defaultDomain] = new Map()

const bios = new Map()
bios[defaultDomain] = new Map()

const newKeyPair = async () => {
  return await generateKeyPair(
    'rsa',
    {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      }
    }
  )
}

export const getPair = async (username, domain = defaultDomain) => {
  if (!domains.has(domain)) {
    domains.set(domain, new Map())
  }
  if (!domains.get(domain).has(username)) {
    const pair = await newKeyPair(username)
    domains.get(domain).set(username, pair)
  }
  return domains.get(domain).get(username)
}

export const getPublicKey = async (username, domain = defaultDomain) => {
  const pair = await getPair(username, domain)
  return pair.publicKey
}

export const getPrivateKey = async (username, domain = defaultDomain) => {
  const pair = await getPair(username, domain)
  return pair.privateKey
}

function ensureGraph (domain, username) {
  if (!graph.has(domain)) {
    graph.set(domain, new Map())
  }
  if (!graph.get(domain).has(username)) {
    graph.get(domain).set(username, new Map())
    graph.get(domain).get(username).set('followers', [])
    graph.get(domain).get(username).set('following', [])
  }
  return graph.get(domain).get(username)
}

export function addFollower (username, id, domain = defaultDomain) {
  ensureGraph(domain, username).get('followers').unshift(id)
}

export function addFollowing (username, id, domain = defaultDomain) {
  ensureGraph(domain, username).get('following').unshift(id)
}

function ensureCollection (domain, username, collection) {
  if (!collections.has(domain)) {
    collections.set(domain, new Map())
  }
  const dc = collections.get(domain)
  if (!dc.has(username)) {
    dc.set(username, new Map())
  }
  const dcu = dc.get(username)
  if (!dcu.has(collection)) {
    dcu.set(collection, [])
  }
  const dcuc = dcu.get(collection)
  return dcuc
}

export function addToCollection (username, collection, item, domain = defaultDomain) {
  ensureCollection(domain, username, collection).unshift(item)
}

function ensureBio (domain) {
  if (!bios.has(domain)) {
    bios.set(domain, new Map())
  }
  return bios.get(domain)
}

export function setBio (username, bio, domain = defaultDomain) {
  ensureBio(domain).set(username, bio)
}

export function getBio (username, domain = defaultDomain) {
  const dm = ensureBio(domain)
  if (dm.has(username)) {
    return dm.get(username)
  } else {
    return undefined
  }
}

export const nockSignature = async ({ method = 'GET', url, date, digest = null, username, domain = defaultDomain, algorithm = 'rsa-sha256' }) => {
  const privateKey = await getPrivateKey(username, domain)
  const keyId = nockFormat({ username, key: true, domain })
  const parsed = new URL(url)
  const target = (parsed.search && parsed.search.length)
    ? `${parsed.pathname}${parsed.search}`
    : `${parsed.pathname}`
  let data = `(request-target): ${method.toLowerCase()} ${target}\n`
  data += `host: ${parsed.host}\n`
  data += `date: ${date}`
  if (digest) {
    data += `\ndigest: ${digest}`
  }
  const signer = crypto.createSign('sha256')
  signer.update(data)
  const signature = signer.sign(privateKey).toString('base64')
  signer.end()
  return `keyId="${keyId}",headers="(request-target) host date${(digest) ? ' digest' : ''}",signature="${signature.replace(/"/g, '\\"')}",algorithm="${algorithm}"`
}

export const nockSignatureFragment = async ({ method = 'GET', url, date, digest = null, username, domain = defaultDomain }) => {
  const keyId = nockFormat({ username, domain }) + '#main-key'
  const privateKey = await getPrivateKey(username, domain)
  const parsed = new URL(url)
  const target = (parsed.search && parsed.search.length)
    ? `${parsed.pathname}?${parsed.search}`
    : `${parsed.pathname}`
  let data = `(request-target): ${method.toLowerCase()} ${target}\n`
  data += `host: ${parsed.host}\n`
  data += `date: ${date}`
  if (digest) {
    data += `\ndigest: ${digest}`
  }
  const signer = crypto.createSign('sha256')
  signer.update(data)
  const signature = signer.sign(privateKey).toString('base64')
  signer.end()
  return `keyId="${keyId}",headers="(request-target) host date${(digest) ? ' digest' : ''}",signature="${signature.replace(/"/g, '\\"')}",algorithm="rsa-sha256"`
}

export const nockMessageSignature = async ({ method = 'GET', url, contentDigest = null, username, domain = defaultDomain, keyId = null }) => {
  if (!keyId) {
    keyId = nockFormat({ username, key: true, domain })
  }
  const privateKey = await getPrivateKey(username, domain)
  const parsed = new URL(url)

  const signatureInput = []

  signatureInput.push(['@method', method ])
  signatureInput.push(['@authority', parsed.hostname])
  signatureInput.push(['@path', parsed.pathname])
  if (parsed.search) {
    signatureInput.push(['@query', parsed.search])
  }
  if (contentDigest) {
    signatureInput.push(['content-digest', contentDigest])
  }

  const created = Math.floor(Date.now() / 1000)
  const componentList = signatureInput.map(([name]) => `"${name}"`).join(' ')
  const signatureParams = `(${componentList});keyId="${keyId}";alg="rsa-v1_5-sha256";created=${created}`

  signatureInput.push(['@signature-params', signatureParams])

  const data = signatureInput.map(pair => `"${pair[0]}": ${pair[1]}`).join('\n')

  const signer = crypto.createSign('sha256')
  signer.update(data)
  const signature = signer.sign(privateKey).toString('base64')
  signer.end()

  return {
    'signature-input': `sig1=${signatureParams}`,
    'signature': `sig1=:${signature}:`
  }
}

export const nockKeyRotate = async (username, domain = defaultDomain) =>
  domains.get(domain).set(username, await newKeyPair(username))

export const makeActor = async (username, domain = defaultDomain, options = {}) =>
  await as2.import({
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    id: `https://${domain}/user/${username}`,
    type: 'Person',
    preferredUsername: username,
    summary: getBio(username, domain),
    inbox: `https://${domain}/user/${username}/inbox`,
    outbox: `https://${domain}/user/${username}/outbox`,
    followers: `https://${domain}/user/${username}/followers`,
    following: `https://${domain}/user/${username}/following`,
    liked: `https://${domain}/user/${username}/liked`,
    to: ['as:Public'],
    publicKey: {
      id: `https://${domain}/user/${username}/publickey`,
      type: 'CryptographicKey',
      owner: `https://${domain}/user/${username}`,
      publicKeyPem: await getPublicKey(username, domain)
    },
    url: {
      type: 'Link',
      href: `https://${domain}/profile/${username}`,
      mediaType: 'text/html'
    },
    endpoints: (options.sharedInbox)
      ? { sharedInbox: `https://${domain}/shared/inbox` }
      : undefined
  })

// Just the types we use here
const isActivityType = (type) => ['Create', 'Update', 'Delete', 'Add', 'Remove', 'Follow', 'Accept', 'Reject', 'Like', 'Block', 'Flag', 'Undo'].includes(uppercase(type))

export async function makeObject (
  username,
  type,
  num,
  domain = defaultDomain,
  extra = {}) {
  const props = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://purl.archive.org/socialweb/thread/1.0',
      { ostatus: 'http://ostatus.org/schema/1.0/' }
    ],
    id: nockFormat({ username, type, num, domain }),
    type: uppercase(type),
    to: 'as:Public',
    ...extra
  }
  if (isActivityType(type)) {
    props.actor = nockFormat({ username, domain })
  } else {
    props.attributedTo = nockFormat({ username, domain })
    props.replies = nockFormat({ username, type, num, domain, obj: 'replies' })
    props.shares = nockFormat({ username, type, num, domain, obj: 'shares' })
    props.likes = nockFormat({ username, type, num, domain, obj: 'likes' })
    props.thread = nockFormat({ username, type, num, domain, obj: 'thread' })
    props.context = nockFormat({ username, type, num, domain, obj: 'context' })
    props['ostatus:conversation'] = nockFormat({ username, type, num, domain, obj: 'conversation' })
  }
  return as2.import(props)
}

export const makeTransitive = (username, type, num, obj, domain = defaultDomain) =>
  as2.import({
    id: nockFormat({ username, type, num, obj, domain }),
    type: uppercase(type),
    to: 'as:Public',
    actor: nockFormat({ username, domain }),
    object: `https://${obj}`
  })

const uppercase = (str) => str.charAt(0).toUpperCase() + str.slice(1)
const lowercase = (str) => str.toLowerCase()

export const postInbox = {}
export const postSharedInbox = {}

export const resetInbox = () => {
  for (const username in postInbox) {
    postInbox[username] = 0
  }
}

export const resetSharedInbox = () => {
  for (const domain in postSharedInbox) {
    postSharedInbox[domain] = 0
  }
}

const bodies = new Map()

export function getBody (uri) {
  return bodies.get(uri)
}

export function resetBodies () {
  bodies.clear()
}

function captureBody (domain, uri, requestBody) {
  const url = new URL(uri, `https://${domain}`).toString()
  bodies.set(url, requestBody)
}

const requestHeaders = new Map()

export function getRequestHeaders (uri) {
  return requestHeaders.get(uri)
}

export const resetRequestHeaders = () => {
  requestHeaders.clear()
}

const captureRequestHeaders = (domain, uri, req) => {
  const url = new URL(uri, `https://${domain}`).toString()
  const headers = req?.headers || {}
  requestHeaders.set(url, headers)
}

export const nockSetup = (domain, options = {}) => {
  let remaining = 300
  const rateLimitHeaders = () =>
    (options.rateLimit)
      ? {
          'X-RateLimit-Limit': 1000,
          'X-RateLimit-Remaining': --remaining,
          'X-RateLimit-Reset': 300
        }
      : {}
  nock(`https://${domain}`)
    .persist()
    .get(/^\/.well-known\/webfinger/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const parsed = new URL(uri, `https://${domain}`)
      const resource = parsed.searchParams.get('resource')
      if (!resource) {
        return [400, 'Bad Request']
      }
      const username = resource.slice(5).split('@')[0]
      const webfinger = {
        subject: resource,
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: `https://${domain}/user/${username}`
          }
        ]
      }
      return [200,
        JSON.stringify(webfinger),
        { 'Content-Type': 'application/jrd+json', ...rateLimitHeaders() }]
    })
    .post(/^\/shared\/inbox$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      captureBody(domain, uri, requestBody)
      if (!options.sharedInbox) {
        return [404, 'not found']
      }
      if (!(domain in postSharedInbox)) {
        postSharedInbox[domain] = 0
      }
      postSharedInbox[domain] += 1
      return [202, 'accepted', rateLimitHeaders()]
    })
    .get(/^\/user\/(\w+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const username = uri.match(/^\/user\/(\w+)$/)[1]
      const actor = await makeActor(username, domain, options)
      const actorText = await actor.write(
        { additional_context: 'https://w3id.org/security/v1' }
      )
      return [
        200,
        actorText,
        { 'Content-Type': 'application/activity+json',
          ...rateLimitHeaders() }]
    })
    .post(/^\/user\/(\w+)\/inbox$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      captureBody(domain, uri, requestBody)
      const username = uri.match(/^\/user\/(\w+)\/inbox$/)[1]
      let results
      if (username in postInbox) {
        postInbox[username] += 1
        results = [202, 'accepted', rateLimitHeaders() ]
      } else {
        postInbox[username] = (options.flaky)
          ? 0
          : 1
        results = (options.flaky)
          ? [503, 'service unavailable', rateLimitHeaders() ]
          : [202, 'accepted', rateLimitHeaders() ]
      }
      return results
    })
    .get(/^\/user\/(\w+)\/inbox$/)
    .reply(async function (uri, requestBody) {
      return [403, 'forbidden', rateLimitHeaders() ]
    })
    .get(/^\/user\/(\w+)\/publickey$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const username = uri.match(/^\/user\/(\w+)\/publickey$/)[1]
      const publicKey = await as2.import({
        '@context': [
          'https://www.w3.org/ns/activitystreams',
          'https://w3id.org/security/v1'
        ],
        id: `https://${domain}/user/${username}/publickey`,
        owner: `https://${domain}/user/${username}`,
        type: 'CryptographicKey',
        publicKeyPem: await getPublicKey(username, domain)
      })
      const publicKeyText = await publicKey.write(
        { additional_context: 'https://w3id.org/security/v1' }
      )
      return [
        200,
        publicKeyText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/followers$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const username = uri.match(/^\/user\/(\w+)\/followers$/)[1]
      const items = ensureGraph(domain, username).get('followers')
      const followers = await as2.import({
        '@context': [
          'https://www.w3.org/ns/activitystreams',
          'https://w3id.org/fep/5711'
        ],
        id: `https://${domain}/user/${username}/followers`,
        attributedTo: `https://${domain}/user/${username}`,
        to: 'as:Public',
        followersOf: `https://${domain}/user/${username}`,
        type: 'OrderedCollection',
        totalItems: items.length,
        items
      })
      const followersText = await followers.write(
        { additional_context: 'https://w3id.org/fep/5711' }
      )
      return [
        200,
        followersText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/following$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const username = uri.match(/^\/user\/(\w+)\/following$/)[1]
      const items = ensureGraph(domain, username).get('following')
      const following = await as2.import({
        '@context': [
          'https://www.w3.org/ns/activitystreams',
          'https://w3id.org/fep/5711'
        ],
        id: `https://${domain}/user/${username}/following`,
        attributedTo: `https://${domain}/user/${username}`,
        to: 'as:Public',
        followersOf: `https://${domain}/user/${username}`,
        type: 'OrderedCollection',
        totalItems: items.length,
        items
      })
      const followingText = await following.write(
        { additional_context: 'https://w3id.org/fep/5711' }
      )
      return [
        200,
        followingText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/collection\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      options?.logger?.debug('Capturing request headers')
      captureRequestHeaders(domain, uri, this?.req)
      options?.logger?.debug('Matching parameters')
      const match = uri.match(/^\/user\/(\w+)\/collection\/(\d+)$/)
      const username = match[1]
      const type = 'Collection'
      const num = parseInt(match[2])
      options?.logger?.debug('Ensuring collection')
      const items = ensureCollection(domain, username, num)
      options?.logger?.debug('Making collection object')
      const summary = `${num} collection by ${username}`
      const obj = await makeObject(username, type, num, domain, { items, summary })
      options?.logger?.debug('Writing collection object to text')
      const objText = await obj.write({ useOriginalContext: true })
      options?.logger?.debug('Sending output')
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/orderedcollection\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/orderedcollection\/(\d+)$/)
      const username = match[1]
      const type = 'OrderedCollection'
      const num = parseInt(match[2])
      const orderedItems = ensureCollection(domain, username, num)
      const summary = `${num} ordered collection by ${username}`
      const obj = await makeObject(username, type, num, domain, { orderedItems, summary })
      const objText = await obj.write({ useOriginalContext: true })
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/pagedcollection\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/pagedcollection\/(\d+)$/)
      const username = match[1]
      const type = 'Collection'
      const num = parseInt(match[2])
      const items = ensureCollection(domain, username, num)
      const totalItems = items.length
      const first = (totalItems > 0)
        ? nockFormat({ username, domain, type: 'PagedCollection', num, page: 0 })
        : undefined
      const obj = await makeObject(username, type, num, domain, { totalItems, first })
      const objText = await obj.write({ useOriginalContext: true })
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/pagedcollection\/(\d+)\/page\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/pagedcollection\/(\d+)\/page\/(\d+)$/)
      const username = match[1]
      const type = 'CollectionPage'
      const num = parseInt(match[2])
      const page = parseInt(match[3])
      const allItems = ensureCollection(domain, username, num)
      const items = allItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      const next = (allItems.length > (page + 1) * PAGE_SIZE)
        ? nockFormat({ username, domain, type: 'PagedCollection', num, page: page + 1 })
        : undefined
      const obj = await makeObject(username, type, num, domain, { items, next })
      const objText = await obj.write({ useOriginalContext: true })
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/pagedorderedcollection\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/pagedorderedcollection\/(\d+)$/)
      const username = match[1]
      const type = 'OrderedCollection'
      const num = parseInt(match[2])
      const items = ensureCollection(domain, username, num)
      const totalItems = items.length
      const first = (totalItems > 0)
        ? nockFormat({ username, domain, type: 'PagedOrderedCollection', num, page: 0 })
        : undefined
      const obj = await makeObject(username, type, num, domain, { totalItems, first })
      const objText = await obj.write({ useOriginalContext: true })
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/pagedorderedcollection\/(\d+)\/page\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/pagedorderedcollection\/(\d+)\/page\/(\d+)$/)
      const username = match[1]
      const type = 'OrderedCollectionPage'
      const num = parseInt(match[2])
      const page = parseInt(match[3])
      const allItems = ensureCollection(domain, username, num)
      const orderedItems = allItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      const next = (allItems.length > (page + 1) * PAGE_SIZE)
        ? nockFormat({ username, domain, type: 'PagedOrderedCollection', num, page: page + 1 })
        : undefined
      const obj = await makeObject(username, type, num, domain, { orderedItems, next })
      const objText = await obj.write({ useOriginalContext: true })
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/(\w+)\/(\d+)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/(\w+)\/(\d+)$/)
      const username = match[1]
      const type = uppercase(match[2])
      const num = match[3]
      const obj = await makeObject(username, type, num, domain)
      const objText = await obj.write({ useOriginalContext: true })
      return [
        200,
        objText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
    .get(/^\/user\/(\w+)\/(\w+)\/(\d+)\/(.*)$/)
    .reply(async function (uri, requestBody) {
      captureRequestHeaders(domain, uri, this?.req)
      const match = uri.match(/^\/user\/(\w+)\/(\w+)\/(\d+)\/(.*)$/)
      const username = match[1]
      const type = match[2]
      const num = match[3]
      const obj = match[4]
      const act = await makeTransitive(username, type, num, obj, domain)
      const actText = await act.write()
      return [
        200,
        actText,
        {
          'Content-Type': 'application/activity+json',
          ...rateLimitHeaders()
        }
      ]
    })
}

export function nockFormat ({ username, type, num, obj, key, collection, page, domain = defaultDomain }) {
  let url = `https://${domain}/user/${username}`
  if (key) {
    url = `${url}/publickey`
  } else if (collection) {
    url = `${url}/${collection}`
  } else {
    if (type && num) {
      url = `${url}/${lowercase(type)}/${num}`
      if (obj) {
        if (obj.startsWith('https://')) {
          url = `${url}/${obj.slice(8)}`
        } else {
          url = `${url}/${obj}`
        }
      } else if (typeof page === 'number') {
        url = `${url}/page/${page}`
      }
    }
  }
  return url
}
