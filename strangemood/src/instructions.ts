// import { ns64, struct, u8, seq } from "@solana/buffer-layout";
import * as anchor from "@project-serum/anchor";
import { serialize } from "borsh";
import * as splToken from "@solana/spl-token";
import {
  getRealmConfigAddress,
  getTokenHoldingAddress,
  getTokenOwnerAddress,
  GovernanceConfig,
  GOVERNANCE_PROGRAM_SEED,
  MintMaxVoteWeightSource,
  RealmConfigArgs,
} from "./governance/accounts";
import {
  CreateAccountGovernanceArgs,
  CreateRealmArgs,
  CreateTokenGovernanceArgs,
  DepositGoverningTokensArgs,
} from "./governance/instructions";
import {
  getGovernanceSchema,
  GOVERNANCE_SCHEMA,
  PROGRAM_VERSION_V2,
} from "./governance/serialization";
// import { strToFixedBytes, toUTF8Array } from "./utils";

export async function depositGovernanceTokens(params: {
  amount: anchor.BN;
  realm: anchor.web3.PublicKey;
  governingTokenSource: anchor.web3.PublicKey;
  governingTokenMint: anchor.web3.PublicKey;
  governingTokenOwner: anchor.web3.PublicKey;
  transferAuthority: anchor.web3.PublicKey;
  governanceProgramId: anchor.web3.PublicKey;
  payer: anchor.web3.PublicKey;
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

  const [governingTokenHoldingAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(GOVERNANCE_PROGRAM_SEED),
        params.realm.toBuffer(),
        params.governingTokenMint.toBuffer(),
      ],
      params.governanceProgramId
    );

  console.log("sent to", governingTokenHoldingAddress.toString());

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
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splToken.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isWritable: false,
      isSigner: false,
    },
  ];

  return [
    new anchor.web3.TransactionInstruction({
      keys,
      programId: params.governanceProgramId,
      data,
    }),
  ];
}

export async function createAccountGovernance(params: {
  authority: anchor.web3.PublicKey;
  governanceProgramId: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;
  governedAccount: anchor.web3.PublicKey;
  config: GovernanceConfig;

  // Technically anyone can create an account governance if they
  // have enough tokens. This is the person who created it.
  governingTokenOwner: anchor.web3.PublicKey;

  // Technically anyone can create an account governance if they
  // have enough tokens. This is the person who created it.
  governingTokenMint: anchor.web3.PublicKey;

  payer: anchor.web3.PublicKey;
}): Promise<[anchor.web3.TransactionInstruction, anchor.web3.PublicKey]> {
  const args = new CreateAccountGovernanceArgs({ config: params.config });
  const data = Buffer.from(serialize(GOVERNANCE_SCHEMA, args));

  const [governanceAddress] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from("account-governance"),
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
      pubkey: anchor.web3.SystemProgram.programId,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isWritable: false,
      isSigner: false,
    },
    {
      pubkey: params.authority,
      isWritable: false,
      isSigner: true,
    },
  ];

  const ix = new anchor.web3.TransactionInstruction({
    keys,
    programId: params.governanceProgramId,
    data,
  });

  return [ix, governanceAddress];
}

export async function createTokenGovernance(params: {
  governanceProgramId: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;

  // For example, a SOL token account
  tokenAccountToBeGoverned: anchor.web3.PublicKey;

  // The community token mint
  governingTokenMint: anchor.web3.PublicKey;
  governingTokenOwner: anchor.web3.PublicKey;
  authority: anchor.web3.PublicKey;

  config: GovernanceConfig;
  transferTokenOwner: boolean;
  tokenOwner: anchor.web3.PublicKey;
  payer: anchor.web3.PublicKey;
}): Promise<[anchor.web3.TransactionInstruction, anchor.web3.PublicKey]> {
  const args = new CreateTokenGovernanceArgs({
    config: params.config,
    transferTokenOwner: params.transferTokenOwner,
  });
  const data = Buffer.from(serialize(GOVERNANCE_SCHEMA, args));

  const [tokenGovernanceAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("token-governance"),
        params.realm.toBuffer(),
        params.tokenAccountToBeGoverned.toBuffer(),
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
      pubkey: tokenGovernanceAddress,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: params.tokenAccountToBeGoverned,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: params.tokenOwner,
      isWritable: false,
      isSigner: true,
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
      pubkey: splToken.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: params.authority,
      isWritable: false,
      isSigner: true,
    },
  ];

  return [
    new anchor.web3.TransactionInstruction({
      keys,
      programId: params.governanceProgramId,
      data,
    }),
    tokenGovernanceAddress,
  ];
}

export async function createRealm(params: {
  authority: anchor.web3.PublicKey;
  communityMint: anchor.web3.PublicKey;
  payer: anchor.web3.PublicKey;
  name: string;
  governanceProgramId: anchor.web3.PublicKey;
}): Promise<[anchor.web3.TransactionInstruction, anchor.web3.PublicKey]> {
  // Ripped from https://github.com/solana-labs/oyster/blob/main/packages/governance/src/models/withCreateRealm.ts
  const configArgs = new RealmConfigArgs({
    useCouncilMint: false,
    minCommunityTokensToCreateGovernance: new anchor.BN(1),
    communityMintMaxVoteWeightSource: new MintMaxVoteWeightSource({
      value: new anchor.BN(1),
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

  const [realmAddress] = await anchor.web3.PublicKey.findProgramAddress(
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
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splToken.TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
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
    new anchor.web3.TransactionInstruction({
      keys,
      programId: params.governanceProgramId,
      data,
    }),
    realmAddress,
  ];
}
