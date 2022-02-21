use anchor_lang::prelude::*;

#[error_code]
pub enum StrangemoodError {
    // custom program error: 0x1770
    #[msg("MintIsNotSupported")]
    MintIsNotSupported,

    // custom program error: 0x1771
    #[msg("Unauthorized Charter")]
    CharterIsUnauthorized,

    // custom program error: 0x1772
    #[msg("Deposit not found in listing")]
    DepositIsNotFoundInListing,

    // custom program error: 0x1773
    #[msg("Unexpected Listing Token Account")]
    ListingTokenAccountIsUnexpected,

    // custom program error: 0x1774
    // You attempted to pass in a deposit that is not the one
    // found in the charter
    #[msg("Deposit not found in charter")]
    DepositIsNotFoundInCharter,

    // custom program error: 0x1775
    // You attempted to pass in a mint that is not the one
    // found in the charter
    #[msg("Mint is not found in charter")]
    MintIsNotFoundInCharter,

    // custom program error: 0x1776
    // You attempted to pass in an authority that is not the
    // authority of a listing or charter
    #[msg("Provided Authority Account Does Not Have Access")]
    AuthorityIsUnauthorized,

    // custom program error: 0x1777
    #[msg("Listing Is Not Refundable")]
    ListingIsNotRefundable,

    // You tried to complete a receipt with a cashier, but
    // the receipt did not have a cashier.
    // custom program error: 0x1778
    #[msg("Receipt Does Not Have Cashier")]
    ReceiptDoesNotHaveCashier,

    // You tried to complete a receipt without a cashier, but
    // the receipt has a cashier.
    // custom program error: 0x1779
    #[msg("Receipt Has Cashier")]
    ReceiptHasCashier,

    // custom program error: 0x177a
    #[msg("Listing is Unavailable")]
    ListingIsUnavailable,

    // custom program error: 0x177b
    #[msg("Listing Mint Does Not Match Listing")]
    ListingMintDoesNotMatchListing,

    // custom program error: 0x177c
    #[msg("Listing is not consumable")]
    ListingIsNotConsumable,

    // custom program error: 0x177d
    // Creating a charter requires the signer to be the mint authority
    #[msg("Signer is not Mint Authority")]
    SignerIsNotMintAuthority,

    // custom program error: 0x177e
    // The cashier's split must be 1.0 to 0.0.
    #[msg("Invalid Cashier Split")]
    CashierSplitIsInvalid,
}
