import { nanoid } from 'nanoid'
import { verify } from './crypto'

import { Scope } from './types'

type MetadataStatement =
  `Do you want to allow this service to modify the metadata of your listing?`

type Statement = MetadataStatement

function getStatement(scope: Scope): Statement {
  if (scope.startsWith('listing/')) {
    return `Do you want to allow this service to modify the metadata of your listing?`
  }

  throw new Error('Unknown scope ' + scope)
}

function getURI(scope: Scope): string {
  const [resource, id] = scope.split('/')

  const DOMAIN = 'https://api.strangemood.org'
  return DOMAIN + '/v1/listings/' + id
}

export function createChallengeMessage(params: Permission) {
  const statement: MetadataStatement = getStatement(params.scope)

  return `${params.domain} wants you to sign in with your wallet:
${params.publicKey}
  
${getStatement(params.scope)}
  
URI: ${getURI(params.scope)}
Version: ${'0.0.0'}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}`
}

interface Permission {
  publicKey: string
  domain: string
  scope: Scope
  nonce: string
  issuedAt: string
}

export async function storePermission(permission: Permission) {
  await SIGNATURES.put(
    `${permission.publicKey}/${permission.scope}`,
    JSON.stringify(permission),
    {
      // We may want to consider not having an expiration date
      // in the future, and making this work more like OAuth
      // Permissions
      expirationTtl: 60 * 60 * 2,
    },
  )
}

export async function getPermission(
  publicKey: string,
  scope: Scope,
): Promise<Permission | null> {
  const result = await SIGNATURES.get(`${publicKey}/${scope}`)

  if (!result) return result as null
  return JSON.parse(result) as Permission
}

export async function isAuthorized(
  request: Request,
  publicKey: string,
  scope: Scope,
): Promise<boolean> {
  const signature = request.headers.get('Authorization')
  if (!signature) return false

  const permission = await getPermission(publicKey, scope)
  if (!permission) return false

  let msg = createChallengeMessage(permission)
  return verify(msg, signature, publicKey)
}
