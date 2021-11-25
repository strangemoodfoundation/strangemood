import * as solana from '@solana/web3.js';
import {
  createAccountGovernance,
  createEmptyCharterAccount,
  createRealm,
  createTokenGovernance,
  depositGovernanceTokens,
  setCharterAccount,
} from './dao/instructions';
import splToken, { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteWeightSource,
} from './dao/governance/accounts';
import BN from 'bn.js';
import { CharterLayout } from './dao/state';
import { STRANGEMOOD_PROGRAM_ID } from './constants';
import { createListing, purchaseListing } from './strangemood';

interface Governance {
  governanceProgramId: solana.PublicKey;
  realm: solana.PublicKey;
  communityMint: solana.PublicKey;
  charterGovernance: solana.PublicKey;
  charter: solana.PublicKey;
}

const test_governance = {
  governanceProgramId: new solana.PublicKey(
    'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
  ),
  communityMint: new solana.PublicKey(
    '36RC6XAKAnjEYVySfb4k6dnyjWJGgfjRL1oMx3pe9MVL'
  ),
};

function randomString(len, charSet) {
  charSet =
    charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

function getTimestampFromDays(days: number) {
  const SECONDS_PER_DAY = 86400;

  return days * SECONDS_PER_DAY;
}

async function createDAO(
  conn: solana.Connection,
  governanceProgramId: solana.PublicKey,
  signer: solana.Keypair,
  initialVoteSupply: number,
  charter: {
    expansion_rate_amount: number;
    expansion_rate_decimals: number;
    sol_contribution_rate_amount: number;
    sol_contribution_rate_decimals: number;
    vote_contribution_rate_amount: number;
    vote_contribution_rate_decimals: number;
    authority: solana.PublicKey;
  }
) {
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

  console.log('createRealm');
  const [realm_ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: communityMint.publicKey,
    payer: signer.publicKey,
    name: randomString(5, 'abcdefghijklmnopqrs'),
    governanceProgramId: governanceProgramId,
  });

  // Deposit the tokens into the realm so we can do stuff
  console.log('depositGovernanceTokens');
  const [deposit_tx] = await depositGovernanceTokens({
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

  const [sol_tg_tx, _] = await createTokenGovernance({
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
      minCommunityTokensToCreateProposal: new BN(0),
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

  const [vote_tg_tx, __] = await createTokenGovernance({
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
  console.log('createEmptyCharterAccount');
  const create_empty_charter_tx = createEmptyCharterAccount({
    lamportsForRent: balance,
    payerPubkey: signer.publicKey,
    newAccountPubkey: charterKeypair.publicKey,
    owner: STRANGEMOOD_PROGRAM_ID,
  });

  // Update the charter details
  console.log('setCharterAccount');
  const set_charter_tx = setCharterAccount({
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
    },
    charterPubkey: charterKeypair.publicKey,
    signer: signer.publicKey,
  });

  // Create the Account governance for said charter
  const [ag_ix, accountGovernance] = await createAccountGovernance({
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
    charterKeypair: charterKeypair,
  };
}

export const main = async () => {
  let signer = solana.Keypair.generate();
  let conn = new solana.Connection('http://127.0.0.1:8899');

  // Get some SOL to pay for the transactions
  let airdropSignature = await conn.requestAirdrop(
    signer.publicKey,
    solana.LAMPORTS_PER_SOL * 10
  );
  await conn.confirmTransaction(airdropSignature);

  console.log('creating dao');
  const dao = await createDAO(
    conn,
    test_governance.governanceProgramId,
    signer,
    100000, // inital supply
    {
      expansion_rate_amount: 1,
      expansion_rate_decimals: 2,

      sol_contribution_rate_amount: 5,
      sol_contribution_rate_decimals: 2,

      vote_contribution_rate_amount: 5,
      vote_contribution_rate_decimals: 2,

      authority: signer.publicKey,
    }
  );
  console.log('Created DAO!');

  // Create a SOL account for the charter governance
  let wrappedSol = new splToken.Token(
    conn,
    splToken.NATIVE_MINT,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let sol_acct = await wrappedSol.getOrCreateAssociatedAccountInfo(
    signer.publicKey
  );

  let votes = new splToken.Token(
    conn,
    dao.communityMint,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let vote_acct = await votes.getOrCreateAssociatedAccountInfo(
    signer.publicKey
  );

  const { listing, listingMint } = await createListing(
    conn,
    {
      signer: signer,
      payer: signer,
    },
    {
      solDeposit: sol_acct.address,
      voteDeposit: vote_acct.address,
      realm: dao.realm,
      charter: dao.charterKeypair.publicKey,
      charterGovernance: dao.charterGovernance,
      governanceProgramId: test_governance.governanceProgramId,
      priceInLamports: 1000,
    }
  );

  // Airdrop some SOL to purchase the listing with
  console.log('Creating wrapped native account');
  let paymentAccount = await splToken.Token.createWrappedNativeAccount(
    conn,
    splToken.TOKEN_PROGRAM_ID,
    signer.publicKey,
    signer,
    5000
  );

  console.log('purchasing listing');
  const listingTokenAccount = await purchaseListing(
    conn,
    {
      signer: signer,
      payer: signer,
    },
    {
      listing: listing.publicKey,
      solTokenAccountToPayWith: paymentAccount,
      realm: dao.realm,
      charterGovernance: dao.charterGovernance,
      charter: dao.charterKeypair.publicKey,
      governanceProgramId: test_governance.governanceProgramId,
    }
  );

  console.log('purchased listing', listingTokenAccount);
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
