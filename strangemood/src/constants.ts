import * as anchor from "@project-serum/anchor";

export type NET = typeof MAINNET;

export type Government = {
  governance_program_id: anchor.web3.PublicKey;
  mint: anchor.web3.PublicKey;
  realm: anchor.web3.PublicKey;
  charter: anchor.web3.PublicKey;
  sol_account: anchor.web3.PublicKey;
  vote_account: anchor.web3.PublicKey;
  sol_account_governance: anchor.web3.PublicKey;
  vote_account_governance: anchor.web3.PublicKey;
  charter_governance: anchor.web3.PublicKey;
  mint_authority: anchor.web3.PublicKey;
};

export type Environment = {
  strangemood_program_id: anchor.web3.PublicKey;
  government: Government;
};

export const MAINNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW"
  ),
  government: {
    governance_program_id: new anchor.web3.PublicKey(
      "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
    ),
    mint: new anchor.web3.PublicKey(
      "moodzXgRAZuPDjdogxtWCQSs3xjyiXKtiqsFGTPpkeW"
    ),
    sol_account: new anchor.web3.PublicKey(
      "5BGdQ9MKMSbkHRKPvC1XNq5ky9hVCU4s1QbNxLBYgJDv"
    ),
    sol_account_governance: new anchor.web3.PublicKey(
      "4SxNGraPXoS3ia38Wt89MdTBN1AACSjzJE56LLLAonrL"
    ),
    vote_account: new anchor.web3.PublicKey(
      "3tHFaRiaiSoJsBkx5HbSm6Ep8J43Xuev2Sm1TwSnraUZ"
    ),
    vote_account_governance: new anchor.web3.PublicKey(
      "BPXhmqQZ8BUmd5F17a2K2QogPRQ45Fisa3NZfnfAoXzN"
    ),
    charter_governance: new anchor.web3.PublicKey(
      "HLHjZydWuWQa23Ykp53YTgCmT2XccrM3amgHvTCpWLK4"
    ),
    charter: new anchor.web3.PublicKey(
      "BdbEbwDDLF5421zZdoZJLGjbRZYACyRBhE7cmKwfhmZF"
    ),
    realm: new anchor.web3.PublicKey(
      "FvzZFjf3NPTZbKAmQA4Gf1v7uTW7HFcP5Pcr2oVm49t3"
    ),
    mint_authority: new anchor.web3.PublicKey(
      "4TTmTnvvBqH6aSJ1aLqapHBitfH47AfvSoZpGmEA88hu"
    ),
  },
};

export const TESTNET: Environment = {
  strangemood_program_id: new anchor.web3.PublicKey(
    "sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW"
  ),
  government: {
    governance_program_id: new anchor.web3.PublicKey(
      "smfjietFKFJ4Sbw1cqESBTpPhF4CwbMwN8kBEC1e5ui"
    ),
    mint: new anchor.web3.PublicKey(
      "678yLhgiZbnRdUb8XZoGembuF5zfjzN1wMAdgr4JXGQx"
    ),
    realm: new anchor.web3.PublicKey(
      "ApRKmRxykkXFHjJtxWR4bk8m4AJTw5x46DyaX65VZMPe"
    ),
    charter: new anchor.web3.PublicKey(
      "BXoctCMnGs5Y1nrRYuYWLBwdg79o9JfGUsbYzPJbLjvT"
    ),
    sol_account: new anchor.web3.PublicKey(
      "4U9UYj9KcEghQ5n6Datvq8HPAbhkqENebyn9BuMfdCB5"
    ),
    vote_account: new anchor.web3.PublicKey(
      "3Yi8nAPyEJFbxvQHEksuukqChv9BXwfSmHnV29pkWrFH"
    ),
    sol_account_governance: new anchor.web3.PublicKey(
      "Ga1Y5ubkou5BgNsRDWJcn9JehgZDoE36fW7rP2SQSpCL"
    ),
    vote_account_governance: new anchor.web3.PublicKey(
      "CK5k5UCC9DNyAXCBwzYpFAZ24ZRoe6DomvsGrNyC7HVg"
    ),
    charter_governance: new anchor.web3.PublicKey(
      "8BxgjyhxXQkhibc2jKzjVhTnM5KZGCcVbKoCod141f1R"
    ),
    mint_authority: new anchor.web3.PublicKey(
      "Hi9KN3FHbJpjJxtnzyEvVFKm4x4iYkXDg4CPehUYUPAH"
    ),
  },
};
