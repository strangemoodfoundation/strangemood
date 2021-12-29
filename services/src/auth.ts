import { nanoid } from 'nanoid'
import { Scope } from './types'

type MetadataStatement =
  `Do you want to allow this service to modify the metadata of your listing?`

type Statement = MetadataStatement

export function createChallengeMessage(params: {
  domain: string
  publicKey: string
  statement: Statement
  version: '0.0.0'
  uri: string
  nonce: string
  issuedAt: string
}) {
  return `${params.domain} wants you to sign in with your wallet:
${params.publicKey}
  
${params.statement}
  
URI: ${params.uri}
Version: ${params.version}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}`
}

interface Permission {
  publicKey: string
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

export async function getPermission(publicKey: string, scope: Scope) {
  const result = await SIGNATURES.get(`${publicKey}/${scope}`)

  if (!result) return result
  else JSON.parse(result) as Permission
}
