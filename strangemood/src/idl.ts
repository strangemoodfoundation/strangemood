export type Strangemood = {
  version: "0.1.1";
  name: "strangemood";
  instructions: [
    {
      name: "initListing";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: true;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "paymentDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "voteDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "mintAuthorityBump";
          type: "u8";
        },
        {
          name: "decimals";
          type: "u8";
        },
        {
          name: "price";
          type: "u64";
        },
        {
          name: "refundable";
          type: "bool";
        },
        {
          name: "consumable";
          type: "bool";
        },
        {
          name: "available";
          type: "bool";
        },
        {
          name: "cashierSplit";
          type: "f64";
        },
        {
          name: "uri";
          type: "string";
        }
      ];
    },
    {
      name: "purchase";
      accounts: [
        {
          name: "payment";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventory";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventoryDelegate";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingsPaymentDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingsVoteDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasuryDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterReserve";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "purchaser";
          isMut: false;
          isSigner: true;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "listingMintAuthorityBump";
          type: "u8";
        },
        {
          name: "charterMintAuthorityBump";
          type: "u8";
        },
        {
          name: "inventoryDelegateBump";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "purchaseWithCashier";
      accounts: [
        {
          name: "payment";
          isMut: true;
          isSigner: false;
        },
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashierTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashierTreasuryEscrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventory";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventoryDelegate";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingsPaymentDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingsVoteDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasuryDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterReserve";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "purchaser";
          isMut: false;
          isSigner: true;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "listingMintAuthorityBump";
          type: "u8";
        },
        {
          name: "charterMintAuthorityBump";
          type: "u8";
        },
        {
          name: "inventoryDelegateBump";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "startTrial";
      accounts: [
        {
          name: "payment";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingPaymentDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingPaymentDepositMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "inventory";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventoryDelegate";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receipt";
          isMut: true;
          isSigner: false;
        },
        {
          name: "escrow";
          isMut: true;
          isSigner: true;
        },
        {
          name: "escrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "purchaser";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "listingMintAuthorityBump";
          type: "u8";
        },
        {
          name: "escrowAuthorityBump";
          type: "u8";
        },
        {
          name: "inventoryDelegateBump";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "startTrialWithCashier";
      accounts: [
        {
          name: "payment";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingPaymentDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingPaymentDepositMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "inventory";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventoryDelegate";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receipt";
          isMut: true;
          isSigner: false;
        },
        {
          name: "escrow";
          isMut: true;
          isSigner: true;
        },
        {
          name: "escrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "purchaser";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "listingMintAuthorityBump";
          type: "u8";
        },
        {
          name: "escrowAuthorityBump";
          type: "u8";
        },
        {
          name: "inventoryDelegateBump";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "finishTrial";
      accounts: [
        {
          name: "receipt";
          isMut: true;
          isSigner: false;
        },
        {
          name: "purchaser";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptEscrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptEscrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingsPaymentDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingsVoteDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasuryDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterReserve";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "charterMintAuthorityBump";
          type: "u8";
        },
        {
          name: "receiptEscrowAuthorityBump";
          type: "u8";
        }
      ];
    },
    {
      name: "finishTrialWithCashier";
      accounts: [
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashierTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashierTreasuryEscrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receipt";
          isMut: true;
          isSigner: false;
        },
        {
          name: "purchaser";
          isMut: false;
          isSigner: false;
        },
        {
          name: "receiptEscrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receiptEscrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingsPaymentDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingsVoteDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasuryDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterReserve";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charterMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "charterMintAuthorityBump";
          type: "u8";
        },
        {
          name: "receiptEscrowAuthorityBump";
          type: "u8";
        }
      ];
    },
    {
      name: "refundTrial";
      accounts: [
        {
          name: "purchaser";
          isMut: false;
          isSigner: true;
        },
        {
          name: "returnDeposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "receipt";
          isMut: true;
          isSigner: false;
        },
        {
          name: "escrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "escrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "inventory";
          isMut: true;
          isSigner: false;
        },
        {
          name: "inventoryDelegate";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "listingMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "listingMintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "listingMintAuthorityBump";
          type: "u8";
        },
        {
          name: "inventoryDelegateBump";
          type: "u8";
        },
        {
          name: "escrowAuthorityBump";
          type: "u8";
        }
      ];
    },
    {
      name: "consume";
      accounts: [
        {
          name: "listing";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mintAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "inventoryDelegate";
          isMut: false;
          isSigner: false;
        },
        {
          name: "inventory";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "mintAuthorityBump";
          type: "u8";
        },
        {
          name: "inventoryDelegateBump";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "initCharter";
      accounts: [
        {
          name: "charter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "reserve";
          isMut: false;
          isSigner: false;
        },
        {
          name: "user";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "expansionRate";
          type: "f64";
        },
        {
          name: "paymentContribution";
          type: "f64";
        },
        {
          name: "voteContribution";
          type: "f64";
        },
        {
          name: "withdrawPeriod";
          type: "u64";
        },
        {
          name: "stakeWithdrawAmount";
          type: "u64";
        },
        {
          name: "uri";
          type: "string";
        }
      ];
    },
    {
      name: "setListingPrice";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "price";
          type: "u64";
        }
      ];
    },
    {
      name: "setListingUri";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "uri";
          type: "string";
        }
      ];
    },
    {
      name: "setListingAvailability";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "isAvailable";
          type: "bool";
        }
      ];
    },
    {
      name: "setListingDeposits";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "paymentDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "voteDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "setListingAuthority";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "newAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "setListingCharter";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "voteDeposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "setCharterExpansionRate";
      accounts: [
        {
          name: "charter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "expansionRate";
          type: "f64";
        }
      ];
    },
    {
      name: "setCharterContributionRate";
      accounts: [
        {
          name: "charter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "paymentContribution";
          type: "f64";
        },
        {
          name: "voteContribution";
          type: "f64";
        }
      ];
    },
    {
      name: "setCharterAuthority";
      accounts: [
        {
          name: "charter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "newAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "setCharterReserve";
      accounts: [
        {
          name: "charter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "reserve";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "initCharterTreasury";
      accounts: [
        {
          name: "treasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "deposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "scalar";
          type: "f64";
        }
      ];
    },
    {
      name: "setCharterTreasuryScalar";
      accounts: [
        {
          name: "treasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "scalar";
          type: "f64";
        }
      ];
    },
    {
      name: "setCharterTreasuryDeposit";
      accounts: [
        {
          name: "treasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "deposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "initCashier";
      accounts: [
        {
          name: "cashier";
          isMut: true;
          isSigner: false;
        },
        {
          name: "stake";
          isMut: true;
          isSigner: true;
        },
        {
          name: "stakeAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "stakeAuthorityBump";
          type: "u8";
        },
        {
          name: "uri";
          type: "string";
        }
      ];
    },
    {
      name: "initCashierTreasury";
      accounts: [
        {
          name: "cashierTreasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "deposit";
          isMut: false;
          isSigner: false;
        },
        {
          name: "escrow";
          isMut: true;
          isSigner: true;
        },
        {
          name: "escrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "escrowAuthorityBump";
          type: "u8";
        }
      ];
    },
    {
      name: "burnCashierStake";
      accounts: [
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "stake";
          isMut: true;
          isSigner: false;
        },
        {
          name: "stakeAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "mint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "mintAuthorityBump";
          type: "u8";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "withdrawCashierTreasury";
      accounts: [
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "charterTreasury";
          isMut: true;
          isSigner: false;
        },
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "stake";
          isMut: false;
          isSigner: false;
        },
        {
          name: "cashierTreasury";
          isMut: false;
          isSigner: false;
        },
        {
          name: "escrow";
          isMut: true;
          isSigner: false;
        },
        {
          name: "escrowAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "deposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "paymentMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "voteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "mintAuthorityBump";
          type: "u8";
        },
        {
          name: "cashierEscrowBump";
          type: "u8";
        }
      ];
    },
    {
      name: "withdrawCashierStake";
      accounts: [
        {
          name: "charter";
          isMut: true;
          isSigner: false;
        },
        {
          name: "cashier";
          isMut: false;
          isSigner: false;
        },
        {
          name: "stake";
          isMut: false;
          isSigner: false;
        },
        {
          name: "stakeAuthority";
          isMut: false;
          isSigner: false;
        },
        {
          name: "deposit";
          isMut: true;
          isSigner: false;
        },
        {
          name: "voteMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "clock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "stakeAuthorityBump";
          type: "u8";
        }
      ];
    },
    {
      name: "setListingSuspension";
      accounts: [
        {
          name: "listing";
          isMut: true;
          isSigner: false;
        },
        {
          name: "charter";
          isMut: false;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "suspended";
          type: "bool";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "receipt";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isInitialized";
            type: "bool";
          },
          {
            name: "listing";
            type: "publicKey";
          },
          {
            name: "inventory";
            type: "publicKey";
          },
          {
            name: "purchaser";
            type: "publicKey";
          },
          {
            name: "cashier";
            type: {
              option: "publicKey";
            };
          },
          {
            name: "escrow";
            type: "publicKey";
          },
          {
            name: "quantity";
            type: "u64";
          },
          {
            name: "price";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "listing";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isInitialized";
            type: "bool";
          },
          {
            name: "isAvailable";
            type: "bool";
          },
          {
            name: "isSuspended";
            type: "bool";
          },
          {
            name: "charter";
            type: "publicKey";
          },
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "paymentDeposit";
            type: "publicKey";
          },
          {
            name: "voteDeposit";
            type: "publicKey";
          },
          {
            name: "price";
            type: "u64";
          },
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "isRefundable";
            type: "bool";
          },
          {
            name: "isConsumable";
            type: "bool";
          },
          {
            name: "cashierSplit";
            type: "f64";
          },
          {
            name: "uri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "charter";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isInitialized";
            type: "bool";
          },
          {
            name: "expansionRate";
            type: "f64";
          },
          {
            name: "paymentContribution";
            type: "f64";
          },
          {
            name: "voteContribution";
            type: "f64";
          },
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "reserve";
            type: "publicKey";
          },
          {
            name: "withdrawPeriod";
            type: "u64";
          },
          {
            name: "stakeWithdrawAmount";
            type: "u64";
          },
          {
            name: "uri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "charterTreasury";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isInitialized";
            type: "bool";
          },
          {
            name: "charter";
            type: "publicKey";
          },
          {
            name: "deposit";
            type: "publicKey";
          },
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "scalar";
            type: "f64";
          }
        ];
      };
    },
    {
      name: "cashier";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isInitialized";
            type: "bool";
          },
          {
            name: "charter";
            type: "publicKey";
          },
          {
            name: "stake";
            type: "publicKey";
          },
          {
            name: "lastWithdrawAt";
            type: "u64";
          },
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "uri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "cashierTreasury";
      type: {
        kind: "struct";
        fields: [
          {
            name: "isInitialized";
            type: "bool";
          },
          {
            name: "cashier";
            type: "publicKey";
          },
          {
            name: "escrow";
            type: "publicKey";
          },
          {
            name: "deposit";
            type: "publicKey";
          },
          {
            name: "mint";
            type: "publicKey";
          },
          {
            name: "lastWithdrawAt";
            type: "u64";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "TokenAccountHasUnexpectedMint";
    },
    {
      code: 6001;
      name: "ListingHasUnexpectedMint";
    },
    {
      code: 6002;
      name: "ListingHasUnexpectedCharter";
    },
    {
      code: 6003;
      name: "ListingHasUnexpectedAuthority";
    },
    {
      code: 6004;
      name: "ListingHasUnexpectedDeposit";
    },
    {
      code: 6005;
      name: "CharterTreasuryHasUnexpectedCharter";
    },
    {
      code: 6006;
      name: "CharterTreasuryHasUnexpectedMint";
    },
    {
      code: 6007;
      name: "CharterTreasuryHasUnexpectedDeposit";
    },
    {
      code: 6008;
      name: "CashierTreasuryHasUnexpectedMint";
    },
    {
      code: 6009;
      name: "CashierTreasuryHasUnexpectedDeposit";
    },
    {
      code: 6010;
      name: "CashierTreasuryHasUnexpectedEscrow";
    },
    {
      code: 6011;
      name: "CashierTreasuryHasUnexpectedCashier";
    },
    {
      code: 6012;
      name: "CashierHasUnexpectedCharter";
    },
    {
      code: 6013;
      name: "CashierHasUnexpectedAuthority";
    },
    {
      code: 6014;
      name: "CashierHasUnexpectedStake";
    },
    {
      code: 6015;
      name: "CharterHasUnexpectedMint";
    },
    {
      code: 6016;
      name: "CharterHasUnexpectedAuthority";
    },
    {
      code: 6017;
      name: "CharterHasUnexpectedReserve";
    },
    {
      code: 6018;
      name: "ReceiptHasUnexpectedListing";
    },
    {
      code: 6019;
      name: "ReceiptHasUnexpectedPurchaser";
    },
    {
      code: 6020;
      name: "ReceiptHasUnexpectedEscrow";
    },
    {
      code: 6021;
      name: "ReceiptHasUnexpectedCashier";
    },
    {
      code: 6022;
      name: "ReceiptHasUnexpectedInventory";
    },
    {
      code: 6023;
      name: "ListingIsNotRefundable";
    },
    {
      code: 6024;
      name: "ReceiptDoesNotHaveCashier";
      msg: "Receipt Does Not Have Cashier";
    },
    {
      code: 6025;
      name: "ReceiptHasCashier";
      msg: "Receipt Has Cashier";
    },
    {
      code: 6026;
      name: "ListingIsUnavailable";
      msg: "Listing is Unavailable";
    },
    {
      code: 6027;
      name: "ListingIsNotConsumable";
      msg: "Listing is not consumable";
    },
    {
      code: 6028;
      name: "SignerIsNotMintAuthority";
      msg: "Signer is not Mint Authority";
    },
    {
      code: 6029;
      name: "CashierSplitIsInvalid";
      msg: "Invalid Cashier Split";
    },
    {
      code: 6030;
      name: "ListingIsSuspended";
    }
  ];
};

export const IDL: Strangemood = {
  version: "0.1.1",
  name: "strangemood",
  instructions: [
    {
      name: "initListing",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: true,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "paymentDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "voteDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "mintAuthorityBump",
          type: "u8",
        },
        {
          name: "decimals",
          type: "u8",
        },
        {
          name: "price",
          type: "u64",
        },
        {
          name: "refundable",
          type: "bool",
        },
        {
          name: "consumable",
          type: "bool",
        },
        {
          name: "available",
          type: "bool",
        },
        {
          name: "cashierSplit",
          type: "f64",
        },
        {
          name: "uri",
          type: "string",
        },
      ],
    },
    {
      name: "purchase",
      accounts: [
        {
          name: "payment",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventory",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventoryDelegate",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingsPaymentDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingsVoteDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasuryDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterReserve",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "purchaser",
          isMut: false,
          isSigner: true,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "listingMintAuthorityBump",
          type: "u8",
        },
        {
          name: "charterMintAuthorityBump",
          type: "u8",
        },
        {
          name: "inventoryDelegateBump",
          type: "u8",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "purchaseWithCashier",
      accounts: [
        {
          name: "payment",
          isMut: true,
          isSigner: false,
        },
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashierTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashierTreasuryEscrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventory",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventoryDelegate",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingsPaymentDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingsVoteDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasuryDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterReserve",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "purchaser",
          isMut: false,
          isSigner: true,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "listingMintAuthorityBump",
          type: "u8",
        },
        {
          name: "charterMintAuthorityBump",
          type: "u8",
        },
        {
          name: "inventoryDelegateBump",
          type: "u8",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "startTrial",
      accounts: [
        {
          name: "payment",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingPaymentDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingPaymentDepositMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "inventory",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventoryDelegate",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receipt",
          isMut: true,
          isSigner: false,
        },
        {
          name: "escrow",
          isMut: true,
          isSigner: true,
        },
        {
          name: "escrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "purchaser",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "listingMintAuthorityBump",
          type: "u8",
        },
        {
          name: "escrowAuthorityBump",
          type: "u8",
        },
        {
          name: "inventoryDelegateBump",
          type: "u8",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "startTrialWithCashier",
      accounts: [
        {
          name: "payment",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingPaymentDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingPaymentDepositMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "inventory",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventoryDelegate",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receipt",
          isMut: true,
          isSigner: false,
        },
        {
          name: "escrow",
          isMut: true,
          isSigner: true,
        },
        {
          name: "escrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "purchaser",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "listingMintAuthorityBump",
          type: "u8",
        },
        {
          name: "escrowAuthorityBump",
          type: "u8",
        },
        {
          name: "inventoryDelegateBump",
          type: "u8",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "finishTrial",
      accounts: [
        {
          name: "receipt",
          isMut: true,
          isSigner: false,
        },
        {
          name: "purchaser",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptEscrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptEscrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingsPaymentDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingsVoteDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasuryDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterReserve",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "charterMintAuthorityBump",
          type: "u8",
        },
        {
          name: "receiptEscrowAuthorityBump",
          type: "u8",
        },
      ],
    },
    {
      name: "finishTrialWithCashier",
      accounts: [
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashierTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashierTreasuryEscrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receipt",
          isMut: true,
          isSigner: false,
        },
        {
          name: "purchaser",
          isMut: false,
          isSigner: false,
        },
        {
          name: "receiptEscrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receiptEscrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingsPaymentDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingsVoteDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasuryDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterReserve",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charterMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "charterMintAuthorityBump",
          type: "u8",
        },
        {
          name: "receiptEscrowAuthorityBump",
          type: "u8",
        },
      ],
    },
    {
      name: "refundTrial",
      accounts: [
        {
          name: "purchaser",
          isMut: false,
          isSigner: true,
        },
        {
          name: "returnDeposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "receipt",
          isMut: true,
          isSigner: false,
        },
        {
          name: "escrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "escrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "inventory",
          isMut: true,
          isSigner: false,
        },
        {
          name: "inventoryDelegate",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "listingMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "listingMintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "listingMintAuthorityBump",
          type: "u8",
        },
        {
          name: "inventoryDelegateBump",
          type: "u8",
        },
        {
          name: "escrowAuthorityBump",
          type: "u8",
        },
      ],
    },
    {
      name: "consume",
      accounts: [
        {
          name: "listing",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mintAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "inventoryDelegate",
          isMut: false,
          isSigner: false,
        },
        {
          name: "inventory",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "mintAuthorityBump",
          type: "u8",
        },
        {
          name: "inventoryDelegateBump",
          type: "u8",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "initCharter",
      accounts: [
        {
          name: "charter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "reserve",
          isMut: false,
          isSigner: false,
        },
        {
          name: "user",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "expansionRate",
          type: "f64",
        },
        {
          name: "paymentContribution",
          type: "f64",
        },
        {
          name: "voteContribution",
          type: "f64",
        },
        {
          name: "withdrawPeriod",
          type: "u64",
        },
        {
          name: "stakeWithdrawAmount",
          type: "u64",
        },
        {
          name: "uri",
          type: "string",
        },
      ],
    },
    {
      name: "setListingPrice",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "price",
          type: "u64",
        },
      ],
    },
    {
      name: "setListingUri",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "uri",
          type: "string",
        },
      ],
    },
    {
      name: "setListingAvailability",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "isAvailable",
          type: "bool",
        },
      ],
    },
    {
      name: "setListingDeposits",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "paymentDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "voteDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setListingAuthority",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "newAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setListingCharter",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "voteDeposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setCharterExpansionRate",
      accounts: [
        {
          name: "charter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "expansionRate",
          type: "f64",
        },
      ],
    },
    {
      name: "setCharterContributionRate",
      accounts: [
        {
          name: "charter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "paymentContribution",
          type: "f64",
        },
        {
          name: "voteContribution",
          type: "f64",
        },
      ],
    },
    {
      name: "setCharterAuthority",
      accounts: [
        {
          name: "charter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "newAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setCharterReserve",
      accounts: [
        {
          name: "charter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "reserve",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "initCharterTreasury",
      accounts: [
        {
          name: "treasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "deposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "scalar",
          type: "f64",
        },
      ],
    },
    {
      name: "setCharterTreasuryScalar",
      accounts: [
        {
          name: "treasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "scalar",
          type: "f64",
        },
      ],
    },
    {
      name: "setCharterTreasuryDeposit",
      accounts: [
        {
          name: "treasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "deposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "initCashier",
      accounts: [
        {
          name: "cashier",
          isMut: true,
          isSigner: false,
        },
        {
          name: "stake",
          isMut: true,
          isSigner: true,
        },
        {
          name: "stakeAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "stakeAuthorityBump",
          type: "u8",
        },
        {
          name: "uri",
          type: "string",
        },
      ],
    },
    {
      name: "initCashierTreasury",
      accounts: [
        {
          name: "cashierTreasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "deposit",
          isMut: false,
          isSigner: false,
        },
        {
          name: "escrow",
          isMut: true,
          isSigner: true,
        },
        {
          name: "escrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "escrowAuthorityBump",
          type: "u8",
        },
      ],
    },
    {
      name: "burnCashierStake",
      accounts: [
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "stake",
          isMut: true,
          isSigner: false,
        },
        {
          name: "stakeAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "mint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "mintAuthorityBump",
          type: "u8",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "withdrawCashierTreasury",
      accounts: [
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "charterTreasury",
          isMut: true,
          isSigner: false,
        },
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "stake",
          isMut: false,
          isSigner: false,
        },
        {
          name: "cashierTreasury",
          isMut: false,
          isSigner: false,
        },
        {
          name: "escrow",
          isMut: true,
          isSigner: false,
        },
        {
          name: "escrowAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "deposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "paymentMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "voteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "mintAuthorityBump",
          type: "u8",
        },
        {
          name: "cashierEscrowBump",
          type: "u8",
        },
      ],
    },
    {
      name: "withdrawCashierStake",
      accounts: [
        {
          name: "charter",
          isMut: true,
          isSigner: false,
        },
        {
          name: "cashier",
          isMut: false,
          isSigner: false,
        },
        {
          name: "stake",
          isMut: false,
          isSigner: false,
        },
        {
          name: "stakeAuthority",
          isMut: false,
          isSigner: false,
        },
        {
          name: "deposit",
          isMut: true,
          isSigner: false,
        },
        {
          name: "voteMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "clock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "stakeAuthorityBump",
          type: "u8",
        },
      ],
    },
    {
      name: "setListingSuspension",
      accounts: [
        {
          name: "listing",
          isMut: true,
          isSigner: false,
        },
        {
          name: "charter",
          isMut: false,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "suspended",
          type: "bool",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "receipt",
      type: {
        kind: "struct",
        fields: [
          {
            name: "isInitialized",
            type: "bool",
          },
          {
            name: "listing",
            type: "publicKey",
          },
          {
            name: "inventory",
            type: "publicKey",
          },
          {
            name: "purchaser",
            type: "publicKey",
          },
          {
            name: "cashier",
            type: {
              option: "publicKey",
            },
          },
          {
            name: "escrow",
            type: "publicKey",
          },
          {
            name: "quantity",
            type: "u64",
          },
          {
            name: "price",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "listing",
      type: {
        kind: "struct",
        fields: [
          {
            name: "isInitialized",
            type: "bool",
          },
          {
            name: "isAvailable",
            type: "bool",
          },
          {
            name: "isSuspended",
            type: "bool",
          },
          {
            name: "charter",
            type: "publicKey",
          },
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "paymentDeposit",
            type: "publicKey",
          },
          {
            name: "voteDeposit",
            type: "publicKey",
          },
          {
            name: "price",
            type: "u64",
          },
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "isRefundable",
            type: "bool",
          },
          {
            name: "isConsumable",
            type: "bool",
          },
          {
            name: "cashierSplit",
            type: "f64",
          },
          {
            name: "uri",
            type: "string",
          },
        ],
      },
    },
    {
      name: "charter",
      type: {
        kind: "struct",
        fields: [
          {
            name: "isInitialized",
            type: "bool",
          },
          {
            name: "expansionRate",
            type: "f64",
          },
          {
            name: "paymentContribution",
            type: "f64",
          },
          {
            name: "voteContribution",
            type: "f64",
          },
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "reserve",
            type: "publicKey",
          },
          {
            name: "withdrawPeriod",
            type: "u64",
          },
          {
            name: "stakeWithdrawAmount",
            type: "u64",
          },
          {
            name: "uri",
            type: "string",
          },
        ],
      },
    },
    {
      name: "charterTreasury",
      type: {
        kind: "struct",
        fields: [
          {
            name: "isInitialized",
            type: "bool",
          },
          {
            name: "charter",
            type: "publicKey",
          },
          {
            name: "deposit",
            type: "publicKey",
          },
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "scalar",
            type: "f64",
          },
        ],
      },
    },
    {
      name: "cashier",
      type: {
        kind: "struct",
        fields: [
          {
            name: "isInitialized",
            type: "bool",
          },
          {
            name: "charter",
            type: "publicKey",
          },
          {
            name: "stake",
            type: "publicKey",
          },
          {
            name: "lastWithdrawAt",
            type: "u64",
          },
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "uri",
            type: "string",
          },
        ],
      },
    },
    {
      name: "cashierTreasury",
      type: {
        kind: "struct",
        fields: [
          {
            name: "isInitialized",
            type: "bool",
          },
          {
            name: "cashier",
            type: "publicKey",
          },
          {
            name: "escrow",
            type: "publicKey",
          },
          {
            name: "deposit",
            type: "publicKey",
          },
          {
            name: "mint",
            type: "publicKey",
          },
          {
            name: "lastWithdrawAt",
            type: "u64",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "TokenAccountHasUnexpectedMint",
    },
    {
      code: 6001,
      name: "ListingHasUnexpectedMint",
    },
    {
      code: 6002,
      name: "ListingHasUnexpectedCharter",
    },
    {
      code: 6003,
      name: "ListingHasUnexpectedAuthority",
    },
    {
      code: 6004,
      name: "ListingHasUnexpectedDeposit",
    },
    {
      code: 6005,
      name: "CharterTreasuryHasUnexpectedCharter",
    },
    {
      code: 6006,
      name: "CharterTreasuryHasUnexpectedMint",
    },
    {
      code: 6007,
      name: "CharterTreasuryHasUnexpectedDeposit",
    },
    {
      code: 6008,
      name: "CashierTreasuryHasUnexpectedMint",
    },
    {
      code: 6009,
      name: "CashierTreasuryHasUnexpectedDeposit",
    },
    {
      code: 6010,
      name: "CashierTreasuryHasUnexpectedEscrow",
    },
    {
      code: 6011,
      name: "CashierTreasuryHasUnexpectedCashier",
    },
    {
      code: 6012,
      name: "CashierHasUnexpectedCharter",
    },
    {
      code: 6013,
      name: "CashierHasUnexpectedAuthority",
    },
    {
      code: 6014,
      name: "CashierHasUnexpectedStake",
    },
    {
      code: 6015,
      name: "CharterHasUnexpectedMint",
    },
    {
      code: 6016,
      name: "CharterHasUnexpectedAuthority",
    },
    {
      code: 6017,
      name: "CharterHasUnexpectedReserve",
    },
    {
      code: 6018,
      name: "ReceiptHasUnexpectedListing",
    },
    {
      code: 6019,
      name: "ReceiptHasUnexpectedPurchaser",
    },
    {
      code: 6020,
      name: "ReceiptHasUnexpectedEscrow",
    },
    {
      code: 6021,
      name: "ReceiptHasUnexpectedCashier",
    },
    {
      code: 6022,
      name: "ReceiptHasUnexpectedInventory",
    },
    {
      code: 6023,
      name: "ListingIsNotRefundable",
    },
    {
      code: 6024,
      name: "ReceiptDoesNotHaveCashier",
      msg: "Receipt Does Not Have Cashier",
    },
    {
      code: 6025,
      name: "ReceiptHasCashier",
      msg: "Receipt Has Cashier",
    },
    {
      code: 6026,
      name: "ListingIsUnavailable",
      msg: "Listing is Unavailable",
    },
    {
      code: 6027,
      name: "ListingIsNotConsumable",
      msg: "Listing is not consumable",
    },
    {
      code: 6028,
      name: "SignerIsNotMintAuthority",
      msg: "Signer is not Mint Authority",
    },
    {
      code: 6029,
      name: "CashierSplitIsInvalid",
      msg: "Invalid Cashier Split",
    },
    {
      code: 6030,
      name: "ListingIsSuspended",
    },
  ],
};
