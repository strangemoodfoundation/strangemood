import * as solana from '@solana/web3.js';
import { CharterLayout } from './state';
import { Charter } from './types';
import * as ix from './instructions';
import * as splToken from '@solana/spl-token';
import {
  getGovernanceSchema,
  PROGRAM_VERSION_V2,
} from './governance/serialization';
import { deserialize } from 'borsh';
import {
  GovernanceConfig,
  Realm,
  VoteThresholdPercentage,
  VoteWeightSource,
} from './governance/accounts';
import BN from 'bn.js';

export async function getRealmAccount(
  conn: solana.Connection,
  realmPubkey: solana.PublicKey
) {
  let realmAccount = await conn.getAccountInfo(realmPubkey);

  let gov = getGovernanceSchema(PROGRAM_VERSION_V2);
  let realm = deserialize(gov, Realm, realmAccount.data);

  return {
    data: realm,
  };
}

// TODO: make this an account meta instead of just the data inside the account
export async function getCharterAccount(
  conn: solana.Connection,
  charterPubkey: solana.PublicKey
) {
  let charter = await conn.getAccountInfo(charterPubkey);
  let object = CharterLayout.decode(charter.data);

  return {
    data: {
      expansion_rate_amount: new splToken.u64(object.expansion_rate_amount),
      expansion_rate_decimals: object.expansion_rate_decimals,

      sol_contribution_rate_amount: new splToken.u64(
        object.sol_contribution_rate_amount
      ),
      sol_contribution_rate_decimals: object.sol_contribution_rate_decimals,

      vote_contribution_rate_amount: new splToken.u64(
        object.vote_contribution_rate_amount
      ),
      vote_contribution_rate_decimals: object.vote_contribution_rate_decimals,

      authority: new solana.PublicKey(object.authority),

      realm_sol_token_account: new solana.PublicKey(
        object.realm_sol_token_account
      ),
      realm_vote_token_account: new solana.PublicKey(
        object.realm_vote_token_account
      ),
    },
  };
}

export async function createCharter(
  conn: solana.Connection,
  governanceProgramId: solana.PublicKey,
  strangemoodProgramId: solana.PublicKey,

  // Note that these keys can all be the same
  // keypair.
  keys: {
    // Who pays the rent?
    payer: solana.Keypair;

    // Who's making the transaction?
    signer: solana.Keypair;

    // Who's the owner of the charter?
    owner: solana.Keypair;
  },
  charter: Charter
): Promise<solana.Keypair> {
  let acctKeypair = solana.Keypair.generate();
  let minimumBalance = await conn.getMinimumBalanceForRentExemption(
    CharterLayout.span
  );

  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    ix.createEmptyCharterAccount({
      lamportsForRent: minimumBalance,
      payerPubkey: keys.payer.publicKey,
      newAccountPubkey: acctKeypair.publicKey,
      owner: governanceProgramId,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer, acctKeypair]);

  tx = new solana.Transaction();
  tx.add(
    ix.setCharterAccount({
      charterData: charter,
      charterPubkey: acctKeypair.publicKey,
      signer: keys.signer.publicKey,
      strangemoodProgramId: strangemoodProgramId,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer]);

  return acctKeypair;
}

export async function createDAO(
  conn: solana.Connection,
  governanceProgramId: solana.PublicKey,
  strangemoodProgramId: solana.PublicKey,
  signer: solana.Keypair,
  initialVoteSupply: number,
  name: string,
  charter: {
    expansion_rate_amount: number;
    expansion_rate_decimals: number;
    sol_contribution_rate_amount: number;
    sol_contribution_rate_decimals: number;
    vote_contribution_rate_amount: number;
    vote_contribution_rate_decimals: number;
    authority: solana.PublicKey;
    uri: string;
  }
): Promise<DAO> {
  // Create a community mint
  const communityMint = await splToken.Token.createMint(
    conn,
    signer,
    signer.publicKey,
    signer.publicKey,
    9,
    splToken.TOKEN_PROGRAM_ID
  );

  // Mint some tokens
  let myVoteTokenAccount = await communityMint.getOrCreateAssociatedAccountInfo(
    signer.publicKey
  );
  await communityMint.mintTo(
    myVoteTokenAccount.address,
    signer.publicKey,
    [],
    initialVoteSupply
  );

  const [realm_ix, realm] = await ix.createRealm({
    authority: signer.publicKey,
    communityMint: communityMint.publicKey,
    payer: signer.publicKey,
    name: name,
    governanceProgramId: governanceProgramId,
  });

  // Deposit the tokens into the realm so we can do stuff
  const [deposit_tx] = await ix.depositGovernanceTokens({
    amount: new BN(100),
    realm: realm,
    governanceProgramId,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    governingTokenSource: myVoteTokenAccount.address,
    transferAuthority: signer.publicKey,
    payer: signer.publicKey,
  });

  // Create SOL token accounts and give them to the realm
  let wrappedSol = new splToken.Token(
    conn,
    splToken.NATIVE_MINT,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let realmSolTokenAccount = await wrappedSol.createAccount(signer.publicKey);

  const [sol_tg_tx, _] = await ix.createTokenGovernance({
    governanceProgramId,
    realm,
    tokenAccountToBeGoverned: realmSolTokenAccount,
    transferTokenOwner: true, // very important
    tokenOwner: signer.publicKey,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    payer: signer.publicKey,
    authority: signer.publicKey,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new BN(1),
      minInstructionHoldUpTime: getTimestampFromDays(0),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new BN(1),
    }),
  });

  // Create Vote token accounts and give them to the realm
  let realmVoteTokenAccount = await communityMint.createAccount(
    signer.publicKey
  );

  const [vote_tg_tx, __] = await ix.createTokenGovernance({
    governanceProgramId,
    realm,
    tokenAccountToBeGoverned: realmVoteTokenAccount,
    transferTokenOwner: true, // very important
    tokenOwner: signer.publicKey,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    payer: signer.publicKey,
    authority: signer.publicKey,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new BN(0),
      minInstructionHoldUpTime: getTimestampFromDays(0),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new BN(1),
    }),
  });

  // Create an empty account we can use for the charter, and give
  // it to the Strangemood program
  const charterKeypair = solana.Keypair.generate();
  let balance = await conn.getMinimumBalanceForRentExemption(
    CharterLayout.span
  );

  const create_empty_charter_tx = ix.createEmptyCharterAccount({
    lamportsForRent: balance,
    payerPubkey: signer.publicKey,
    newAccountPubkey: charterKeypair.publicKey,
    owner: strangemoodProgramId,
  });

  // Update the charter details
  const set_charter_tx = ix.setCharterAccount({
    charterData: {
      expansion_rate_amount: charter.expansion_rate_amount,
      expansion_rate_decimals: charter.expansion_rate_decimals,
      sol_contribution_rate_amount: charter.sol_contribution_rate_amount,
      sol_contribution_rate_decimals: charter.sol_contribution_rate_decimals,
      vote_contribution_rate_amount: charter.vote_contribution_rate_amount,
      vote_contribution_rate_decimals: charter.vote_contribution_rate_decimals,

      // TODO: Look how token governances assign their authorities
      // and then use that to give the update authority of the charter
      // to the Realm.
      authority: signer.publicKey,
      realm_sol_token_account: realmSolTokenAccount,
      realm_vote_token_account: realmVoteTokenAccount,

      uri: charter.uri,
    },
    strangemoodProgramId: strangemoodProgramId,
    charterPubkey: charterKeypair.publicKey,
    signer: signer.publicKey,
  });

  // Create the Account governance for said charter
  const [ag_ix, accountGovernance] = await ix.createAccountGovernance({
    authority: signer.publicKey,
    governanceProgramId: governanceProgramId,
    realm: realm,
    governedAccount: charterKeypair.publicKey,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    payer: signer.publicKey,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new BN(0),
      minInstructionHoldUpTime: getTimestampFromDays(0),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new BN(1),
    }),
  });

  const tx = new solana.Transaction();
  tx.add(realm_ix);
  tx.add(deposit_tx);
  tx.add(sol_tg_tx);
  tx.add(vote_tg_tx);
  tx.add(create_empty_charter_tx);
  tx.add(set_charter_tx);
  tx.add(ag_ix);

  await solana.sendAndConfirmTransaction(conn, tx, [signer, charterKeypair]);

  return {
    charterGovernance: accountGovernance,
    realm,
    communityMint: communityMint.publicKey,
    charter: charterKeypair.publicKey,
  };
}

export interface DAO {
  charterGovernance: solana.PublicKey;
  realm: solana.PublicKey;
  communityMint: solana.PublicKey;
  charter: solana.PublicKey;
}

function getTimestampFromDays(days: number): number {
  const SECONDS_PER_DAY = 86400;

  return days * SECONDS_PER_DAY;
}
