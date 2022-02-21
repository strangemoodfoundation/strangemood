use anchor_lang::{account, prelude::*};

use crate::util::amount_as_float;

#[account]
pub struct Receipt {
    /// Set to "true" by the program when BeginPurchase is run
    /// Contracts should not trust receipts that aren't initialized
    pub is_initialized: bool,

    // If true, then the listing was refundable at the time it was
    // purchased, and so this receipt is still refundable.
    pub is_refundable: bool,

    // If false, this receipt cannot be completed.
    pub is_cashable: bool,

    // The listing that was purchased
    pub listing: Pubkey,

    // The token account to send the listing tokens to
    // It's possible to purchase the game for another person,
    // So this is not necessarily the purchaser's token account
    pub listing_token_account: Pubkey,

    // The user that purchased the listing
    // This user is allowed to refund the purchase.
    pub purchaser: Pubkey,

    // The cashier.
    pub cashier: Option<Pubkey>,

    // A token account where payment is held in escrow
    pub escrow: Pubkey,

    // The amount of the listing token to be distributed upon redeem
    pub quantity: u64,

    // The price when they bought the listing. We store this here
    // because the price could be updated in between purchase and cash.
    pub price: u64,

    // A unique series of bytes used to generate the PDA and bump
    // for this receipt from `["receipt", listing_pubkey, nonce]`
    pub nonce: u128,
}

#[account]
pub struct Listing {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // If "false", this listing cannot be bought.
    pub is_available: bool,

    // The charter that this listing is associated with
    pub charter: Pubkey,

    /// The entity that's allowed to modify this listing
    pub authority: Pubkey,

    /// The token account to deposit sol into
    pub payment_deposit: Pubkey,

    /// The token account to deposit community votes into
    pub vote_deposit: Pubkey,

    /// Lamports required to purchase 1 listing token amount.
    pub price: u64,

    /// The mint that represents the token they're purchasing
    /// The decimals of the listing are always 0.
    pub mint: Pubkey,

    // If true, this listing can be refunded.
    //
    // When refundable, a purchase receipt starts with cashable=false
    // and needs the authority of the listing to run SetCashable
    // before the purchase can complete.
    pub is_refundable: bool,

    // If true, this listing can be "consumed" by the authority of
    // the listing arbitrarily.
    //
    // Listers can use this to implement subscriptions, usage-based pricing,
    // in-app purchases, and so on.
    pub is_consumable: bool,

    // A % of the sale that gets split between cashier and the lister
    pub cashier_split_amount: u64,
    pub cashier_split_decimals: u8,

    // The URI for where metadata can be found for this listing.
    // Example: "ipns://examplehere", "https://example.com/metadata.json"
    pub uri: String,
}

#[account]
pub struct Charter {
    pub is_initialized: bool,

    // The amount of voting tokens to give to a user per
    // 1.0 wrapped SOL contributed via community account contributions.
    //
    // Note that Borsh doesn't support floats, and so we carry over the pattern
    // used in the token program of having an "amount" and a "decimals".
    // So an "amount" of 100 and a "decimals" of 3 would be 0.1
    pub expansion_rate_amount: u64,
    pub expansion_rate_decimals: u8,

    // The % of each purchase that goes to the community account.
    pub payment_contribution_rate_amount: u64,
    pub payment_contribution_rate_decimals: u8,

    // The % of each vote token minting goes back to the governance to fund
    // new ecosystem projects
    pub vote_contribution_rate_amount: u64,
    pub vote_contribution_rate_decimals: u8,

    // The pubkey of the keypair that can modify this charter.
    // If this points to a system account, then this is basically
    // a dictatorship. If it points to a PDA of a program, then
    // this can be any arbitrary governance.
    pub authority: Pubkey,

    // The native token of this governance that's issued to listers
    // upon sale. The authority of this mint must be a PDA with seeds
    // ["mint", mint.key()].
    pub mint: Pubkey,

    // The community treasury of the native token.
    pub vote_deposit: Pubkey,

    // The number of epochs a withdraw period lasts.
    pub withdraw_period: u64,

    // The amount of the voting token (stake) that can be withdrawn per period
    pub stake_withdraw_amount: u64,

    // The URL host where off-chain services can be found for this governance.
    // Example: "https://strangemood.org", "http://localhost:3000", "https://api.strangemood.org:4040"
    pub uri: String,
}

// An charter-approved deposit account. There is only one treasury per mint and charter.
#[account]
pub struct CharterTreasury {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // The charter this is associated with
    pub charter: Pubkey,

    // The token account associated with this treasury
    pub deposit: Pubkey,

    // The mint of the deposit that this is associated with.
    pub mint: Pubkey,

    // Increases or decreases the amount of voting tokens.
    // distributed based on this deposit type.
    // amount=1 and decimals=0 is 1.0
    // amount=15 and decimals=1 is 1.5
    pub scalar_amount: u64,
    pub scalar_decimals: u8,
}

// A staked client that can receive a bounty if they initiate a sale.
#[account]
pub struct Cashier {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // The charter this is associated with
    pub charter: Pubkey,

    // The token account, in charter voting tokens, where the stake deposit lives
    pub stake: Pubkey,

    // The last epoch the cashier has withdrawn from their stake account
    pub last_withdraw_epoch: u64,

    // The authority that's allowed to withdraw from this cashier
    pub authority: Pubkey,
}

// A treasury owned by the cashier.
#[account]
pub struct CashierTreasury {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // The charter this is associated with
    pub cashier: Pubkey,

    // The intermediary account where funds collect
    // before being withdrawn
    pub escrow: Pubkey,

    // The token account associated with this treasury
    pub deposit: Pubkey,

    // The mint of the deposit that this is associated with.
    pub mint: Pubkey,

    // The last epoch the cashier has withdrawn from their deposit.
    pub last_withdraw_epoch: u64,
}

impl Charter {
    pub fn expansion_rate(&self, scalar_amount: u64, scalar_decimals: u8) -> f64 {
        amount_as_float(self.expansion_rate_amount, self.expansion_rate_decimals)
            * amount_as_float(scalar_amount, scalar_decimals)
    }
    pub fn payment_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.payment_contribution_rate_amount,
            self.payment_contribution_rate_decimals,
        )
    }
    pub fn vote_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.vote_contribution_rate_amount,
            self.vote_contribution_rate_decimals,
        )
    }
}
