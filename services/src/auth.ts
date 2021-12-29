import { nanoid } from 'nanoid'

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
