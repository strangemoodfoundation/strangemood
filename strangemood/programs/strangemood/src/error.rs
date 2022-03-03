use anchor_lang::prelude::*;

#[error_code]
pub enum StrangemoodError {
    TokenAccountHasUnexpectedMint,

    ListingHasUnexpectedMint,

    ListingHasUnexpectedCharter,

    ListingHasUnexpectedAuthority,

    ListingHasUnexpectedDeposit,

    CharterTreasuryHasUnexpectedCharter,

    CharterTreasuryHasUnexpectedMint,

    CharterTreasuryHasUnexpectedDeposit,

    CashierTreasuryHasUnexpectedMint,

    CashierTreasuryHasUnexpectedDeposit,

    CashierTreasuryHasUnexpectedEscrow,

    CashierTreasuryHasUnexpectedCashier,

    CashierHasUnexpectedCharter,

    CashierHasUnexpectedAuthority,

    CashierHasUnexpectedStake,

    CharterHasUnexpectedMint,

    CharterHasUnexpectedAuthority,

    CharterHasUnexpectedReserve,

    ReceiptHasUnexpectedListing,

    ReceiptHasUnexpectedPurchaser,

    ReceiptHasUnexpectedEscrow,

    ReceiptHasUnexpectedCashier,

    ReceiptHasUnexpectedInventory,

    ListingIsNotRefundable,

    // You tried to complete a receipt with a cashier, but
    // the receipt did not have a cashier.
    #[msg("Receipt Does Not Have Cashier")]
    ReceiptDoesNotHaveCashier,

    // You tried to complete a receipt without a cashier, but
    // the receipt has a cashier.
    #[msg("Receipt Has Cashier")]
    ReceiptHasCashier,

    #[msg("Listing is Unavailable")]
    ListingIsUnavailable,

    #[msg("Listing is not consumable")]
    ListingIsNotConsumable,

    // Creating a charter requires the signer to be the mint authority
    #[msg("Signer is not Mint Authority")]
    SignerIsNotMintAuthority,

    // The cashier's split must be 1.0 to 0.0.
    #[msg("Invalid Cashier Split")]
    CashierSplitIsInvalid,

    ListingIsSuspended,
}
