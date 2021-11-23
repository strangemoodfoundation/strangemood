import { ns64, struct, u8 } from '@solana/buffer-layout';
import * as solana from '@solana/web3.js';
import { serialize } from 'borsh';
import {
  STRANGEMOOD_INSTRUCTION_INDEXES as INDEXES,
  STRANGEMOOD_PROGRAM_ID,
} from '../constants';
import { asSigner, asWritable, publicKey } from '../utils';
import splToken from '@solana/spl-token';
import {
  getRealmConfigAddress,
  getTokenHoldingAddress,
  getTokenOwnerAddress,
  GovernanceConfig,
  GOVERNANCE_PROGRAM_SEED,
  MintMaxVoteWeightSource,
  RealmConfigArgs,
} from './governance/accounts';
import {
  CreateAccountGovernanceArgs,
  CreateRealmArgs,
  DepositGoverningTokensArgs,
} from './governance/instructions';
import {
  getGovernanceSchema,
  GOVERNANCE_SCHEMA,
  PROGRAM_VERSION_V2,
} from './governance/serialization';
import { CharterLayout } from './state';
import { Charter } from './types';
import BN from 'bn.js';

export type CreateCharterAccountParams = {
  lamportsForRent: number;
  payerPubkey: solana.PublicKey;
  newAccountPubkey: solana.PublicKey;
  owner: solana.PublicKey;
};

export function createEmptyCharterAccount(params: CreateCharterAccountParams) {
  return solana.SystemProgram.createAccount({
    fromPubkey: params.payerPubkey,
    newAccountPubkey: params.newAccountPubkey,
    lamports: params.lamportsForRent,
    space: CharterLayout.span,

    // TODO: this probably should be the gov program, but technically there's no check,
    // since anyone could create their own governance program.
    programId: params.owner,
  });
}

export async function depositGovernanceTokens(params: {
  amount: BN;
  realm: solana.PublicKey;
  governingTokenSource: solana.PublicKey;
  governingTokenMint: solana.PublicKey;
  governingTokenOwner: solana.PublicKey;
  transferAuthority: solana.PublicKey;
  governanceProgramId: solana.PublicKey;
  payer: solana.PublicKey;
}) {
  const args = new DepositGoverningTokensArgs({ amount: params.amount });
  const data = Buffer.from(
    serialize(getGovernanceSchema(PROGRAM_VERSION_V2), args)
  );

  const tokenOwnerRecordAddress = await getTokenOwnerAddress(
    params.governanceProgramId,
    params.realm,
    params.governingTokenMint,
    params.governingTokenOwner
  );

  const [
    governingTokenHoldingAddress,
  ] = await solana.PublicKey.findProgramAddress(
    [
      Buffer.from(GOVERNANCE_PROGRAM_SEED),
      params.realm.toBuffer(),
      params.governingTokenMint.toBuffer(),
    ],
    params.governanceProgramId
  );

  const keys = [
    {
      pubkey: params.realm,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: governingTokenHoldingAddress,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: params.governingTokenSource,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: params.governingTokenOwner,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: params.transferAuthority,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: tokenOwnerRecordAddress,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: params.payer,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: solana.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splToken.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: solana.SYSVAR_RENT_PUBKEY,
      isWritable: false,
      isSigner: false,
    },
  ];

  return [
    new solana.TransactionInstruction({
      keys,
      programId: params.governanceProgramId,
      data,
    }),
  ];
}

export async function createAccountGovernance(params: {
  authority: solana.PublicKey;
  governanceProgramId: solana.PublicKey;
  realm: solana.PublicKey;
  governedAccount: solana.PublicKey;
  config: GovernanceConfig;

  // Technically anyone can create an account governance if they
  // have enough tokens. This is the person who created it.
  governingTokenOwner: solana.PublicKey;

  // Technically anyone can create an account governance if they
  // have enough tokens. This is the person who created it.
  governingTokenMint: solana.PublicKey;

  payer: solana.PublicKey;
}): Promise<[solana.TransactionInstruction, solana.PublicKey]> {
  const args = new CreateAccountGovernanceArgs({ config: params.config });
  const data = Buffer.from(serialize(GOVERNANCE_SCHEMA, args));

  const [governanceAddress] = await solana.PublicKey.findProgramAddress(
    [
      Buffer.from('account-governance'),
      params.realm.toBuffer(),
      params.governedAccount.toBuffer(),
    ],
    params.governanceProgramId
  );

  const tokenOwnerRecord = await getTokenOwnerAddress(
    params.governanceProgramId,
    params.realm,
    params.governingTokenMint,
    params.governingTokenOwner
  );

  const keys = [
    {
      pubkey: params.realm,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: governanceAddress,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: params.governedAccount,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: tokenOwnerRecord,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: params.payer,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: solana.SystemProgram.programId,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: solana.SYSVAR_RENT_PUBKEY,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: params.authority,
      isWritable: false,
      isSigner: true,
    },
  ];

  const ix = new solana.TransactionInstruction({
    keys,
    programId: params.governanceProgramId,
    data,
  });

  return [ix, governanceAddress];
}

export async function createRealm(params: {
  authority: solana.PublicKey;
  communityMint: solana.PublicKey;
  payer: solana.PublicKey;
  name: string;
  governanceProgramId: solana.PublicKey;
}): Promise<[solana.TransactionInstruction, solana.PublicKey]> {
  // Ripped from https://github.com/solana-labs/oyster/blob/main/packages/governance/src/models/withCreateRealm.ts
  const configArgs = new RealmConfigArgs({
    useCouncilMint: false,
    minCommunityTokensToCreateGovernance: new BN(1),
    communityMintMaxVoteWeightSource: new MintMaxVoteWeightSource({
      value: new BN(1),
    }),
    useCommunityVoterWeightAddin: false,
  });

  const args = new CreateRealmArgs({
    configArgs,
    name: params.name,
  });

  const data = Buffer.from(
    serialize(getGovernanceSchema(PROGRAM_VERSION_V2), args)
  );

  const [realmAddress] = await solana.PublicKey.findProgramAddress(
    [Buffer.from(GOVERNANCE_PROGRAM_SEED), Buffer.from(args.name)],
    params.governanceProgramId
  );

  const communityTokenHoldingAddress = await getTokenHoldingAddress(
    params.governanceProgramId,
    realmAddress,
    params.communityMint
  );

  let keys = [
    {
      pubkey: realmAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: params.authority,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: params.communityMint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: communityTokenHoldingAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: params.payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: solana.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splToken.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: solana.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  const realmConfigAddress = await getRealmConfigAddress(
    params.governanceProgramId,
    realmAddress
  );

  keys.push({
    pubkey: realmConfigAddress,
    isSigner: false,
    isWritable: true,
  });

  return [
    new solana.TransactionInstruction({
      keys,
      programId: params.governanceProgramId,
      data,
    }),
    realmAddress,
  ];
}

export type SetCharterAccountParams = {
  charterPubkey: solana.PublicKey;
  charterData: Charter;
  signer: solana.PublicKey;
};

export function setCharterAccount(params: SetCharterAccountParams) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_CHARTER },
    {
      expansion_rate_amount: params.charterData.expansion_rate_amount,
      expansion_rate_decimals: params.charterData.expansion_rate_decimals,
      contribution_rate_amount: params.charterData.contribution_rate_amount,
      contribution_rate_decimals: params.charterData.contribution_rate_decimals,
      authority: params.charterData.authority.toBytes(),
      realm_sol_token_account: params.charterData.realm_sol_token_account.toBytes(),
    }
  );

  let layout = struct([
    u8('instruction'),

    ns64('expansion_rate_amount'),
    u8('expansion_rate_decimals'),

    ns64('contribution_rate_amount'),
    u8('contribution_rate_decimals'),

    publicKey('authority'),
    publicKey('realm_sol_token_account'),
  ]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [asSigner(params.signer), asWritable(params.charterPubkey)];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}
