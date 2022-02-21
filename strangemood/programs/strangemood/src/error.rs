use anchor_lang::prelude::*;

#[error]
pub enum StrangemoodError {
    // custom program error: 0x1770
    #[msg("MintNotSupported")]
    MintNotSupported,

    // custom program error: 0x1771
    #[msg("Unauthorized Charter")]
    UnauthorizedCharter,

    // custom program error: 0x1772
    #[msg("Deposit not found in listing")]
    DepositIsNotFoundInListing,

    // custom program error: 0x1773
    #[msg("Unexpected Listing Token Account")]
    UnexpectedListingTokenAccount,

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
    UnauthorizedAuthority,

    // custom program error: 0x1777
    #[msg("Listing Is Not Refundable")]
    ListingIsNotRefundable,

    // You tried to complete a receipt with a cashier, but
    // the receipt did not have a cashier.
    // custom program error: 0x1778
    #[msg("Receipt Does Not Have Cashier")]
    ReceiptDoesNotHaveCashier,

    // custom program error: 0x1779
    #[msg("Listing is Unavailable")]
    ListingUnavailable,

    // custom program error: 0x177a
    #[msg("Mint did not match Listing")]
    UnexpectedListingMint,

    // custom program error: 0x177b
    #[msg("Listing is not consumable")]
    ListingIsNotConsumable,

    // custom program error: 0x177c
    // Creating a charter requires the signer to be the mint authority
    #[msg("Signer is not Mint Authority")]
    SignerIsNotMintAuthority,

    // custom program error: 0x177d
    // The cashier's split must be 1.0 to 0.0.
    #[msg("Invalid Cashier Split")]
    InvalidCashierSplit,
}
