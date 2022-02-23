use anchor_lang::{declare_id, prelude::*, System, account, Accounts};
use anchor_spl::token::{Mint, Token, TokenAccount};

use cpi::{mint_to, token_transfer, token_transfer_with_seed};
use state::{CashierTreasury, Charter, Cashier, CharterTreasury, Listing, Receipt};
use std::cmp;

pub mod state;
pub mod error;
pub mod cpi;

use crate::error::StrangemoodError;

declare_id!("sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW");

fn distribute_governance_tokens<'a>(
    contributed: u64, 
    scalar: f64, 
    contribution_rate: f64, 
    token_program: AccountInfo<'a>, 
    charter_mint: AccountInfo<'a>,
    charter_mint_authority: AccountInfo<'a>,
    charter_mint_authority_bump: u8,
    listing_deposit: AccountInfo<'a>,
    charter_deposit: AccountInfo<'a>,
) -> Result<()> {
    let votes = contributed as f64 * scalar;
    let deposit_rate = 1.0 - contribution_rate;
    let deposit_amount = (deposit_rate * votes as f64) as u64;
    let contribution_amount = (votes as u64) - deposit_amount;

    // Mint votes to lister
    mint_to(
        token_program.clone(),
        charter_mint.clone(),
       listing_deposit,
        charter_mint_authority.clone(),
        charter_mint_authority_bump,
        deposit_amount,
    )?;

    // Mint votes to charter
    mint_to(
        token_program,
        charter_mint,
        charter_deposit,
        charter_mint_authority,
        charter_mint_authority_bump,
        contribution_amount,
    )?;

    Ok(())
}


struct Splits { 
    pub to_charter_amount: u64,
    pub to_lister_amount: u64,
}

fn transfer_funds<'info>(
    total: u64,
    listing: &Listing,
    charter: &Charter,
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    charter_deposit: Account<'info, TokenAccount>,
    listing_deposit: Account<'info, TokenAccount>,
    purchaser: Signer<'info>,
) -> Result<Splits> {
    let deposit_rate = 1.0 - charter.payment_contribution;
    let to_lister_amount = (deposit_rate * total as f64) as u64;
    let to_charter_amount = total - to_lister_amount;

    // Distribute payment to the charter
    token_transfer( 
    token_program.to_account_info(),
    from.to_account_info(),
        charter_deposit.to_account_info(),
        purchaser.to_account_info(),
        to_charter_amount,
    )?;

    // Distribute payment to the lister
    token_transfer(
    token_program.to_account_info(),
    from.to_account_info(),
        listing_deposit.to_account_info(),
        purchaser.to_account_info(),
        to_lister_amount,
    )?;
    
    Ok(Splits { to_charter_amount, to_lister_amount })
}

struct SplitsWithCashier { 
    pub to_charter_amount: u64,
    pub to_lister_amount: u64,
    pub to_cashier_amount: u64,
}

fn transfer_funds_with_cashier<'info>(
    total: u64,
    listing: &Listing,
    charter: &Charter,
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    charter_deposit: Account<'info, TokenAccount>,
    listing_deposit: Account<'info, TokenAccount>,
    cashier_deposit: Account<'info, TokenAccount>,
    purchaser: Signer<'info>,
) -> Result<SplitsWithCashier> {
    let deposit_rate = 1.0 - charter.payment_contribution;
    let deposit_amount = (deposit_rate * total as f64) as u64;
    let to_charter_amount = total - deposit_amount;

    // Then split the deposit pool between the lister, and the cashier.
    // (charter, (lister, cashier))
    let to_cashier_rate = listing.cashier_split;
    let to_lister_rate = 1.0 - to_cashier_rate;
    let to_lister_amount = (deposit_amount as f64 * to_lister_rate) as u64;
    let to_cashier_amount = deposit_amount - to_lister_amount;

    // Distribute payment to the charter
    token_transfer( 
    token_program.to_account_info(),
    from.to_account_info(),
        charter_deposit.to_account_info(),
        purchaser.to_account_info(),
        to_charter_amount,
    )?;

    // Distribute payment to the lister
    token_transfer(
    token_program.to_account_info(),
    from.to_account_info(),
        listing_deposit.to_account_info(),
        purchaser.to_account_info(),
        to_lister_amount,
    )?;

        // Distribute payment to cashier
    token_transfer(
        token_program.to_account_info(),
    from.to_account_info(),
    cashier_deposit.to_account_info(),
        purchaser.to_account_info(),
        to_cashier_amount,
    )?;
    

    Ok(SplitsWithCashier { to_charter_amount, to_lister_amount, to_cashier_amount })
}


fn transfer_funds_from_escrow_with_cashier<'info>(
    total: u64,
    listing: &Listing,
    charter: &Charter,
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    charter_deposit: Account<'info, TokenAccount>,
    listing_deposit: Account<'info, TokenAccount>,
    cashier_deposit: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    bump: u8,
) -> Result<SplitsWithCashier> {
    let deposit_rate = 1.0 - charter.payment_contribution;
    let deposit_amount = (deposit_rate * total as f64) as u64;
    let to_charter_amount = total - deposit_amount;

    // Then split the deposit pool between the lister, and the cashier.
    // (charter, (lister, cashier))
    let to_cashier_rate = listing.cashier_split;
    let to_lister_rate = 1.0 - to_cashier_rate;
    let to_lister_amount = (deposit_amount as f64 * to_lister_rate) as u64;
    let to_cashier_amount = deposit_amount - to_lister_amount;

    // Distribute payment to the charter
    token_transfer_with_seed( 
    token_program.to_account_info(),
    from.to_account_info(),
        charter_deposit.to_account_info(),
        authority.to_account_info(),
        to_charter_amount,
        b"token_authority",
        bump
    )?;

    // Distribute payment to the lister
    token_transfer_with_seed(
    token_program.to_account_info(),
    from.to_account_info(),
        listing_deposit.to_account_info(),
        authority.to_account_info(),
        to_lister_amount,
        b"token_authority",
        bump
    )?;

    // Distribute payment to cashier
    token_transfer_with_seed(
        token_program.to_account_info(),
    from.to_account_info(),
    cashier_deposit.to_account_info(),
        authority.to_account_info(),
        to_cashier_amount,
        b"token_authority",
        bump
    )?;

    Ok(SplitsWithCashier { to_charter_amount, to_lister_amount, to_cashier_amount })
}


fn transfer_funds_from_escrow<'info>(
    total: u64,
    listing: &Listing,
    charter: &Charter,
    token_program: Program<'info, Token>,
    from: Account<'info, TokenAccount>,
    charter_deposit: Account<'info, TokenAccount>,
    listing_deposit: Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    bump: u8,
) -> Result<Splits> {
    let deposit_rate = 1.0 - charter.payment_contribution;
    let to_lister_amount = (deposit_rate * total as f64) as u64;
    let to_charter_amount = total - to_lister_amount;

    // Distribute payment to the charter
    token_transfer_with_seed( 
    token_program.to_account_info(),
    from.to_account_info(),
        charter_deposit.to_account_info(),
        authority.to_account_info(),
        to_charter_amount,
        b"token_authority",
        bump
    )?;

    // Distribute payment to the lister
    token_transfer_with_seed(
    token_program.to_account_info(),
    from.to_account_info(),
        listing_deposit.to_account_info(),
        authority.to_account_info(),
        to_lister_amount,
        b"token_authority",
        bump
    )?;

    Ok(Splits { to_charter_amount, to_lister_amount })
}


#[program]
pub mod strangemood {
    use anchor_lang::{prelude::Context, solana_program::{program_option::COption}};

    use crate::{error::StrangemoodError, cpi::{token_transfer, mint_to_and_freeze, token_transfer_with_seed, burn, close_token_escrow_account, close_native_account, approve_delegate, thaw_account, freeze_account}};

    use super::*;

    pub fn init_listing(
        ctx: Context<InitListing>,
        _mint_authority_bump: u8,
        _decimals: u8,
        price: u64,
        refundable: bool,
        consumable: bool,
        available: bool,
        cashier_split: f64,
        uri: String,
    ) -> Result<()> {
        if cashier_split < 0.0 || cashier_split > 1.0 {
            return Err(error!(StrangemoodError::CashierSplitIsInvalid));
        }

        let listing = &mut ctx.accounts.listing;
        listing.is_initialized = true;
        listing.price = price;
        listing.mint = ctx.accounts.mint.key();
        listing.authority = *ctx.accounts.authority.key;
        listing.payment_deposit = ctx.accounts.payment_deposit.key();
        listing.vote_deposit = ctx.accounts.vote_deposit.key();
        listing.charter = ctx.accounts.charter.key();
        listing.uri = uri;
        listing.is_refundable = refundable;
        listing.is_consumable = consumable;
        listing.is_available = available;
        listing.cashier_split = cashier_split;

        Ok(())
    }

    pub fn purchase(ctx: Context<Purchase>,   
        listing_mint_authority_bump: u8,
        charter_mint_authority_bump: u8,
        _inventory_delegate_bump: u8,
        amount: u64
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();

        if !listing.is_available {
            return Err(StrangemoodError::ListingIsUnavailable.into());
        }

        // Distribute payment
        let total: u64 = listing.price * amount;
        let splits = transfer_funds(total,
            &listing,
            &charter,
            ctx.accounts.token_program.clone(),
            *ctx.accounts.payment.clone(),
            *ctx.accounts.charter_treasury_deposit.clone(),
            *ctx.accounts.listings_payment_deposit.clone(),
            ctx.accounts.purchaser.clone()
        )?;

        // Distribute votes 
        let charter_treasury = ctx.accounts.charter_treasury.clone().into_inner();
        distribute_governance_tokens(
            splits.to_charter_amount,
            charter.expansion_rate * charter_treasury.scalar,
            charter.vote_contribution,
             ctx.accounts.token_program.to_account_info(),
             ctx.accounts.charter_mint.to_account_info(),
             ctx.accounts.charter_mint_authority.to_account_info(),
             charter_mint_authority_bump,
             ctx.accounts.listings_vote_deposit.to_account_info(),
             ctx.accounts.charter_reserve.to_account_info(),
        )?;

        // Approve the delegate over the inventory 
        let delegated_amount = ctx.accounts.inventory.amount + amount;
        approve_delegate(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.inventory_delegate.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            delegated_amount
        )?;

        // Distribute listing token 
        mint_to_and_freeze(
ctx.accounts.token_program.to_account_info(),
        ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
    ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_authority_bump,
            amount,
        )?;

        Ok(())
    }

    pub fn purchase_with_cashier(ctx: Context<PurchaseWithCashier>,   
        listing_mint_authority_bump: u8,
        charter_mint_authority_bump: u8,
        _inventory_delegate_bump: u8,
        amount: u64
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();

        if !listing.is_available {
            return Err(StrangemoodError::ListingIsUnavailable.into());
        }

        // Distribute payment
        let total: u64 = listing.price * amount;
        let splits = transfer_funds_with_cashier(total,
            &listing,
            &charter,
            ctx.accounts.token_program.clone(),
            *ctx.accounts.payment.clone(),
            *ctx.accounts.charter_treasury_deposit.clone(),
            *ctx.accounts.listings_payment_deposit.clone(),
            *ctx.accounts.cashier_treasury_escrow.clone(),
            ctx.accounts.purchaser.clone()
        )?;

        // Distribute votes 
        let charter_treasury = ctx.accounts.charter_treasury.clone().into_inner();
        distribute_governance_tokens(
            splits.to_charter_amount,
            charter.expansion_rate * charter_treasury.scalar,
            charter.vote_contribution,
             ctx.accounts.token_program.to_account_info(),
             ctx.accounts.charter_mint.to_account_info(),
             ctx.accounts.charter_mint_authority.to_account_info(),
             charter_mint_authority_bump,
             ctx.accounts.listings_vote_deposit.to_account_info(),
             ctx.accounts.charter_reserve.to_account_info(),
        )?;

        // Approve the delegate over the inventory 
        let delegated_amount = ctx.accounts.inventory.amount + amount;
        approve_delegate(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.inventory_delegate.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            delegated_amount
        )?;

        // Distribute listing token 
        mint_to_and_freeze(
ctx.accounts.token_program.to_account_info(),
        ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
    ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_authority_bump,
            amount, 
        )?;

        Ok(())
    }

    pub fn start_trial(
        ctx: Context<StartTrial>,
        listing_mint_authority_bump: u8,
        _escrow_authority_bump: u8,
        _inventory_delegate_bump: u8,
        amount: u64,
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();

        if !listing.is_available {
            return Err(error!(StrangemoodError::ListingIsUnavailable));
        }
        if !listing.is_refundable {
            return Err(error!(StrangemoodError::ListingIsNotRefundable));
        }

        // Move funds into an escrow, rather than the lister's deposit.
        let total = amount * listing.price;
        token_transfer(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.payment.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            total,
        )?;

        // Approve the delegate over the inventory 
        let delegated_amount = ctx.accounts.inventory.amount + amount;
        approve_delegate(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.inventory_delegate.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            delegated_amount
        )?;

        // Mint the token, which can be burned later upon refund.
        mint_to_and_freeze(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_authority_bump,
            amount,
        )?;

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_initialized = true;
        receipt.listing = ctx.accounts.listing.key();
        receipt.purchaser = ctx.accounts.purchaser.key();
        receipt.quantity = amount;
        receipt.inventory = ctx.accounts.inventory.key();
        receipt.cashier = None;
        receipt.price = total;
        receipt.escrow = ctx.accounts.escrow.key();

        Ok(())
    }

    pub fn start_trial_with_cashier(
        ctx: Context<StartTrialWithCashier>,
        listing_mint_authority_bump: u8,
        _escrow_authority_bump: u8,
        _inventory_delegate_bump: u8,
        amount: u64,
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();

        if !listing.is_available {
            return Err(error!(StrangemoodError::ListingIsUnavailable));
        }
        if !listing.is_refundable {
            return Err(error!(StrangemoodError::ListingIsNotRefundable));
        }

        // Move funds into an escrow, rather than the lister's deposit.
        let total = amount * listing.price;
        token_transfer(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.payment.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.user.to_account_info(),
            total,
        )?;

        // Mint the token, which can be burned later upon refund.
        mint_to_and_freeze(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_authority_bump,
            amount,
        )?;

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_initialized = true;
        receipt.listing = ctx.accounts.listing.key();
        receipt.purchaser = ctx.accounts.user.key();
        receipt.quantity = amount;
        receipt.inventory = ctx.accounts.inventory.key();
        receipt.cashier = Some(ctx.accounts.cashier.key());
        receipt.price = total;
        receipt.escrow = ctx.accounts.escrow.key();

        Ok(())
    }

    pub fn finish_trial(
        ctx: Context<FinishTrialWithCashier>,
        charter_mint_authority_bump: u8,
        receipt_escrow_authority_bump: u8
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let receipt = ctx.accounts.receipt.clone().into_inner();

        if receipt.cashier != None {
            return Err(error!(StrangemoodError::ReceiptHasCashier));
        }

        let total: u64 = receipt.price;
        let splits = transfer_funds_from_escrow(
            total, 
            &listing,
            &charter,
            ctx.accounts.token_program.clone(),
            *ctx.accounts.receipt_escrow.clone(),
            *ctx.accounts.charter_treasury_deposit.clone(),
            *ctx.accounts.listings_payment_deposit.clone(),
            ctx.accounts.receipt_escrow_authority.clone(),  
            receipt_escrow_authority_bump
        )?;
        
        let treasury = ctx.accounts.charter_treasury.clone().into_inner();
        distribute_governance_tokens(
            splits.to_charter_amount,
            charter.expansion_rate * treasury.scalar,
            charter.vote_contribution,
             ctx.accounts.token_program.to_account_info(),
             ctx.accounts.charter_mint.to_account_info(),
             ctx.accounts.charter_mint_authority.to_account_info(),
             charter_mint_authority_bump,
             ctx.accounts.listings_vote_deposit.to_account_info(),
             ctx.accounts.charter_reserve.to_account_info(),
        )?;

        // Close the escrow account.
        close_token_escrow_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.receipt_escrow.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            ctx.accounts.receipt_escrow_authority.to_account_info(),
            receipt_escrow_authority_bump
        )?;

        // Close the receipt.
        close_native_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        );

        Ok(())
    }

    pub fn finish_trial_with_cashier(
        ctx: Context<FinishTrialWithCashier>,
        charter_mint_authority_bump: u8,
        receipt_escrow_authority_bump: u8
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let receipt = ctx.accounts.receipt.clone().into_inner();

        if receipt.cashier == None {
            return Err(error!(StrangemoodError::ReceiptDoesNotHaveCashier));
        }

        let total: u64 = receipt.price;
        let splits = transfer_funds_from_escrow_with_cashier(
            total, 
            &listing,
            &charter,
            ctx.accounts.token_program.clone(),
            *ctx.accounts.receipt_escrow.clone(),
            *ctx.accounts.charter_treasury_deposit.clone(),
            *ctx.accounts.listings_payment_deposit.clone(),
            *ctx.accounts.cashier_treasury_escrow.clone(),
            ctx.accounts.receipt_escrow_authority.clone(),  
            receipt_escrow_authority_bump
        )?;
        

        let treasury = ctx.accounts.charter_treasury.clone().into_inner();
        distribute_governance_tokens(
            splits.to_charter_amount,
            charter.expansion_rate * treasury.scalar,
            charter.vote_contribution,
             ctx.accounts.token_program.to_account_info(),
             ctx.accounts.charter_mint.to_account_info(),
             ctx.accounts.charter_mint_authority.to_account_info(),
             charter_mint_authority_bump,
             ctx.accounts.listings_vote_deposit.to_account_info(),
             ctx.accounts.charter_reserve.to_account_info(),
        )?;

        // Close the escrow account.
        close_token_escrow_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.receipt_escrow.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            ctx.accounts.receipt_escrow_authority.to_account_info(),
            receipt_escrow_authority_bump
        )?;

        // Close the receipt.
        close_native_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        );

        Ok(())
    }

    pub fn refund_trial(
        ctx: Context<Refund>,
        listing_mint_authority_bump: u8,
        escrow_authority_bump:u8,
    ) -> Result<()> {
        let receipt = ctx.accounts.receipt.clone().into_inner();

        burn(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_authority_bump,
            receipt.quantity,
        )?;

        // Close the receipt account
        close_native_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        );

        // Transfer all the funds in the escrow back to the user 
        token_transfer_with_seed(            
            ctx.accounts.token_program.to_account_info(), 
            ctx.accounts.escrow.to_account_info(), 
            ctx.accounts.return_deposit.to_account_info(), 
            ctx.accounts.escrow_authority.to_account_info(), 
            ctx.accounts.escrow.amount,
            b"token_authority",
            escrow_authority_bump
        )?;

        // Close the escrow
        close_token_escrow_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            escrow_authority_bump
        )?;

        Ok(())
    }

    pub fn consume(
        ctx: Context<Consume>,
        mint_authority_bump: u8,
        inventory_delegate_bump: u8,
        amount: u64,
    ) -> Result<()> {
        let listing = ctx.accounts.listing.clone().into_inner();

        if !listing.is_consumable {
            return Err(error!(StrangemoodError::ListingIsNotConsumable));
        }

        thaw_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            mint_authority_bump,
        )?;

        burn(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.inventory_delegate.to_account_info(),
            inventory_delegate_bump,
            amount,
        )?;

        freeze_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.inventory.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            mint_authority_bump,
        )?;

        Ok(())
    }

    pub fn init_charter(
        ctx: Context<InitCharter>,
        expansion_rate: f64,
        payment_contribution: f64,
        vote_contribution: f64,
        withdraw_period: u64,
        stake_withdraw_amount: u64,
        uri: String,
    ) -> Result<()> {
        // Only the mint authority can make a charter.
        let mint = ctx.accounts.mint.clone().into_inner();
        if let COption::Some(authority) = mint.mint_authority {
            if authority != ctx.accounts.user.key() {
                return Err(StrangemoodError::SignerIsNotMintAuthority.into())
            }
        } else {
            // You can't create a charter with a mint that has a fixed supply of 
            // tokens, since purchases would fail.
            return Err(StrangemoodError::SignerIsNotMintAuthority.into())
        }
        
        let charter = &mut ctx.accounts.charter;
        charter.authority = ctx.accounts.authority.key();
        charter.expansion_rate = expansion_rate;
        charter.payment_contribution = payment_contribution;
        charter.vote_contribution = vote_contribution;
        charter.withdraw_period = withdraw_period;
        charter.stake_withdraw_amount = stake_withdraw_amount;
        charter.reserve = ctx.accounts.reserve.key();
        charter.mint = ctx.accounts.mint.key();
        charter.uri = uri;

        Ok(())
    }

    pub fn set_listing_price(ctx: Context<SetListing>, price: u64) -> Result<()> {
        ctx.accounts.listing.price = price;
        Ok(())
    }

    pub fn set_listing_uri(ctx: Context<SetListing>, uri: String) -> Result<()> {
        ctx.accounts.listing.uri = uri;
        Ok(())
    }

    pub fn set_listing_availability(
        ctx: Context<SetListing>,
        is_available: bool,
    ) -> Result<()> {

        ctx.accounts.listing.is_available = is_available;
        Ok(())
    }

    pub fn set_listing_deposits(ctx: Context<SetListingDeposit>) -> Result<()> {
        ctx.accounts.listing.vote_deposit = ctx.accounts.vote_deposit.key();
        ctx.accounts.listing.payment_deposit = ctx.accounts.payment_deposit.key();
        Ok(())
    }

    pub fn set_listing_authority(ctx: Context<SetListingAuthority>) -> Result<()> {
        ctx.accounts.listing.authority = ctx.accounts.new_authority.key();
        Ok(())
    }

    // Migrate a listing to a different charter
    pub fn set_listing_charter(ctx: Context<SetListingCharter>) -> Result<()> {
        ctx.accounts.listing.charter = ctx.accounts.charter.key();
        Ok(())
    }

    pub fn set_charter_expansion_rate(
        ctx: Context<SetCharter>,
        expansion_rate: f64,
    ) -> Result<()> {
        ctx.accounts.charter.expansion_rate = expansion_rate;
        Ok(())
    }

    pub fn set_charter_contribution_rate(
        ctx: Context<SetCharter>,
        payment_contribution: f64,
        vote_contribution: f64,
    ) -> Result<()> {
        ctx.accounts.charter.payment_contribution = payment_contribution;
        ctx.accounts.charter.vote_contribution = vote_contribution;

        Ok(())
    }

    // Migrates the charter to a different authority, like a new governance program
    pub fn set_charter_authority(ctx: Context<SetCharterAuthority>) -> Result<()> {
        ctx.accounts.charter.authority = ctx.accounts.new_authority.key();
        Ok(())
    }

    pub fn set_charter_reserve(ctx: Context<SetCharterReserve>) -> Result<()> {
        ctx.accounts.charter.reserve = ctx.accounts.reserve.key();
        Ok(())
    }

    pub fn init_charter_treasury(ctx: Context<InitCharterTreasury>, scalar: f64) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.charter = ctx.accounts.charter.key();
        treasury.deposit = ctx.accounts.deposit.key(); 
        treasury.mint = ctx.accounts.mint.key();
        treasury.scalar = scalar; 

        Ok(())
    }

    pub fn set_charter_treasury_scalar(ctx: Context<SetCharterTreasuryExpansionScalar>, scalar: f64) -> Result<()> {
        
        let treasury = &mut ctx.accounts.treasury;
        treasury.scalar = scalar; 

        Ok(())
    }

    pub fn set_charter_treasury_deposit(ctx: Context<SetCharterTreasuryDeposit>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.deposit = ctx.accounts.deposit.key(); 

        Ok(())
    }

    pub fn init_cashier(ctx: Context<InitCashier>, _stake_authority_bump: u8, uri: String) -> Result<()> {
        let cashier = &mut ctx.accounts.cashier;
        cashier.is_initialized = true;
        cashier.charter = ctx.accounts.charter.key();
        cashier.stake = ctx.accounts.stake.key();
        cashier.authority = ctx.accounts.authority.key();
        cashier.last_withdraw_at = ctx.accounts.clock.epoch;
        cashier.uri = uri;

        Ok(())
    }

    pub fn init_cashier_treasury(ctx: Context<InitCashierTreasury>, _escrow_authority_bump: u8) -> Result<()> {
        let treasury = &mut ctx.accounts.cashier_treasury; 
        
        treasury.is_initialized = true; 
        treasury.cashier = ctx.accounts.cashier.key();
        treasury.deposit = ctx.accounts.deposit.key();
        treasury.escrow = ctx.accounts.escrow.key();
        treasury.mint = ctx.accounts.mint.key();
        treasury.last_withdraw_at = ctx.accounts.clock.epoch;

        Ok(())
    }

    pub fn burn_cashier_stake(ctx: Context<BurnCashierStake>,  mint_authority_bump: u8, amount: u64) -> Result<()> {   
        burn(
            ctx.accounts.token_program.to_account_info(), 
    ctx.accounts.mint.to_account_info(),
ctx.accounts.stake.to_account_info(),
ctx.accounts.stake_authority.to_account_info(),
        mint_authority_bump,
        amount
        )?;

        Ok(())
    }

    // A decentralized crank that moves money from the the cashier's escrow to their deposit.
    pub fn withdraw_cashier_treasury(ctx: Context<WithdrawCashierTreasury>, _mint_authority_bump: u8, cashier_escrow_bump: u8) -> Result<()> {
        let charter = ctx.accounts.charter.clone().into_inner();
        let charter_treasury = ctx.accounts.charter_treasury.clone().into_inner();
        let stake = ctx.accounts.stake.clone().into_inner();
        let clock = ctx.accounts.clock.clone();
        let cashier_treasury = &mut ctx.accounts.cashier_treasury;

        // Calculate the amount to transfer
        let amount_per_period = stake.amount as f64 * charter_treasury.scalar;
        let amount_per_epoch = amount_per_period as f64 / charter.withdraw_period as f64;
        let epochs_passed = clock.epoch - cashier_treasury.last_withdraw_at;
        let amount_to_transfer = amount_per_epoch * epochs_passed as f64;

        // Transfer what we can
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.escrow.to_account_info(),
         ctx.accounts.deposit.to_account_info(),
        ctx.accounts.escrow_authority.to_account_info(),
            cmp::min(amount_to_transfer as u64, ctx.accounts.escrow.amount),
            b"cashier.escrow", 
            cashier_escrow_bump
        )?;

        // Update cashier treasury's last epoch
        cashier_treasury.last_withdraw_at = clock.epoch;

        Ok(())
    }

    // A decentralized crank that moves money from the the cashier's escrow to their deposit.
    pub fn withdraw_cashier_stake(ctx: Context<WithdrawCashierStake>, stake_authority_bump: u8) -> Result<()> {
        let charter = ctx.accounts.charter.clone().into_inner();
        let clock = ctx.accounts.clock.clone();
        let cashier = &mut ctx.accounts.cashier;

        // Calculate the amount to transfer
        let amount_per_period = charter.stake_withdraw_amount;
        let amount_per_epoch = amount_per_period as f64 / charter.withdraw_period as f64;
        let epochs_passed = clock.epoch - cashier.last_withdraw_at;
        let amount_to_transfer = amount_per_epoch * epochs_passed as f64;

        // Transfer what we can
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.stake.to_account_info(),
            ctx.accounts.deposit.to_account_info(),
        ctx.accounts.stake_authority.to_account_info(),
            cmp::min(amount_to_transfer as u64, ctx.accounts.stake.amount),
            b"token_authority", 
            stake_authority_bump
        )?;

        // Update cashier treasury's last epoch
        cashier.last_withdraw_at = clock.epoch;

        Ok(())
    }
}


#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8)]
pub struct MintTo<'info> {

    pub inventory: Box<Account<'info, Listing>>,

    // The listing we can mint from
    #[account(
        has_one=mint @ StrangemoodError::ListingHasUnexpectedMint,
        has_one=authority @ StrangemoodError::ListingHasUnexpectedAuthority
    )]
    pub listing: Box<Account<'info, Listing>>,

    // The listing mint
    pub mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8, escrow_authority_bump:u8, inventory_delegate_bump: u8)]
pub struct StartTrial<'info> {

    // The user's token account where funds will be transfered from
    #[account(mut)]
    pub payment: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        constraint=listing_payment_deposit.key()==listing.clone().into_inner().payment_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
        constraint=listing_mint.key()==listing.clone().into_inner().mint @ StrangemoodError::ListingHasUnexpectedMint,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        constraint=listing_payment_deposit.mint==listing_payment_deposit_mint.key() @ StrangemoodError::TokenAccountHasUnexpectedMint
    )]
    pub listing_payment_deposit: Box<Account<'info, TokenAccount>>,

    // The type of funds that this 
    pub listing_payment_deposit_mint: Account<'info, Mint>,

    // A token account of the listing.mint where listing tokens
    // will be deposited at
    #[account(mut)]
    pub inventory: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"token_authority", inventory.key().as_ref()],
        bump = inventory_delegate_bump,
    )]
    pub inventory_delegate: AccountInfo<'info>,

    // The mint associated with the listing
    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    // A receipt that lets you refund something later.
    //
    // 8 for the tag
    // 1 for is_initialized bool
    // 32 for listing pubkey
    // 32 for inventory pubkey
    // 32 for purchaser pubkey
    // 32 for cashier pubkey
    // 32 for escrow pubkey
    // 8 for quantity u64
    // 8 for price u64
    #[account(init,
        seeds = [b"receipt", escrow.key().as_ref()],
        bump,
        payer = purchaser,
        space = 8 + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 8)]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(
        init,
        payer=purchaser,
        token::mint = listing_payment_deposit_mint,
        token::authority = escrow_authority,
    )]
    pub escrow: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", escrow.key().as_ref()],
        bump=escrow_authority_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub purchaser: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8, escrow_authority_bump:u8, inventory_delegate_bump:u8)]
pub struct StartTrialWithCashier<'info> {

    // The user's token account where funds will be transfered from
    #[account(mut)]
    pub payment: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        constraint=listing_payment_deposit.key()==listing.clone().into_inner().payment_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
        constraint=listing_mint.key()==listing.clone().into_inner().mint @ StrangemoodError::ListingHasUnexpectedMint,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        constraint=listing_payment_deposit.mint==listing_payment_deposit_mint.key() @ StrangemoodError::TokenAccountHasUnexpectedMint
    )]
    pub listing_payment_deposit: Box<Account<'info, TokenAccount>>,

    // The type of funds that this
    pub listing_payment_deposit_mint: Account<'info, Mint>,

    // The person who's allowed to cash out the listing
    pub cashier: Account<'info, Cashier>,

    // A token account of the listing.mint where listing tokens
    // will be deposited at
    #[account(mut)]
    pub inventory: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"token_authority", inventory.key().as_ref()],
        bump = inventory_delegate_bump,
    )]
    pub inventory_delegate: AccountInfo<'info>,

    // The mint associated with the listing
    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    // A receipt that lets you refund something later.
    //
    // 8 for the tag
    // 1 for is_initialized bool
    // 32 for listing pubkey
    // 32 for inventory pubkey
    // 32 for purchaser pubkey
    // 32 for cashier pubkey
    // 32 for escrow pubkey
    // 8 for quantity u64
    // 8 for price u64
    #[account(init,
        seeds = [b"receipt", escrow.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 8)]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(
        init,
        payer=user,
        token::mint = listing_payment_deposit_mint,
        token::authority = escrow_authority,
    )]
    pub escrow: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", escrow.key().as_ref()],
        bump=escrow_authority_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}


#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8, charter_mint_authority_bump: u8, inventory_delegate_bump: u8)]
pub struct Purchase<'info> {
    // The user's token account where funds will be transfered from
    #[account(mut)]
    pub payment: Box<Account<'info, TokenAccount>>,

    // TODO: consider rename? 
    // Where the listing token is deposited when purchase is complete.
    #[account(mut)]
    pub inventory: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"token_authority", inventory.key().as_ref()],
        bump = inventory_delegate_bump,
    )]
    pub inventory_delegate: AccountInfo<'info>,

    #[account(mut)]
    pub listings_payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        has_one=charter,
        constraint=listing_mint.key()==listing.clone().into_inner().mint @ StrangemoodError::ListingHasUnexpectedMint,
        constraint=listings_payment_deposit.key()==listing.clone().into_inner().payment_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
        constraint=listings_vote_deposit.key()==listing.clone().into_inner().vote_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    #[account(
        has_one=charter,
        constraint=charter_treasury_deposit.key()==charter_treasury.clone().into_inner().deposit @ StrangemoodError::CharterTreasuryHasUnexpectedDeposit,
        constraint=charter_treasury.mint==listings_payment_deposit.mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint, 
    )]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(mut)]
    pub charter_treasury_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", charter_mint.key().as_ref()],
        bump = charter_mint_authority_bump,
    )]
    pub charter_mint_authority: AccountInfo<'info>,

    // Box'd to move the charter (which is fairly hefty)
    // to the heap instead of the stack.
    // Not actually sure if this is a good idea, but
    // without the Box, we run out of space?
    #[account(
        constraint=charter.clone().into_inner().mint==charter_mint.key() @ StrangemoodError::CharterHasUnexpectedMint,
        constraint=charter.reserve==charter_reserve.key() @ StrangemoodError::CharterHasUnexpectedReserve,
        constraint=charter.mint==charter_mint.key() @ StrangemoodError::CharterHasUnexpectedMint,
    )]
    pub charter: Box<Account<'info, Charter>>,

    pub purchaser: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8, charter_mint_authority_bump: u8, inventory_delegate_bump: u8)]
pub struct PurchaseWithCashier<'info> {
    // The user's token account where funds will be transfered from
    #[account(mut)]
    pub payment: Box<Account<'info, TokenAccount>>,

    #[account(has_one=charter)]
    pub cashier: Box<Account<'info, Cashier>>,

    #[account(
        has_one=cashier @ StrangemoodError::CashierTreasuryHasUnexpectedCashier,
        constraint=cashier_treasury.escrow==cashier_treasury_escrow.key() @ StrangemoodError::CashierTreasuryHasUnexpectedEscrow,
        constraint=cashier_treasury.mint==charter_treasury.mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint,
        constraint=cashier_treasury.mint==listings_payment_deposit.mint @StrangemoodError::CashierTreasuryHasUnexpectedMint,
    )]
    pub cashier_treasury: Box<Account<'info, CashierTreasury>>,

    #[account(mut)]
    pub cashier_treasury_escrow: Box<Account<'info, TokenAccount>>,

    // TODO: consider rename? 
    // Where the listing token is deposited when purchase is complete.
    #[account(mut)]
    pub inventory: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"token_authority", inventory.key().as_ref()],
        bump = inventory_delegate_bump,
    )]
    pub inventory_delegate: AccountInfo<'info>,

    #[account(mut)]
    pub listings_payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        has_one=charter @ StrangemoodError::ListingHasUnexpectedCharter,
        constraint=listing_mint.key()==listing.clone().into_inner().mint @ StrangemoodError::ListingHasUnexpectedMint,
        constraint=listings_payment_deposit.key()==listing.clone().into_inner().payment_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
        constraint=listings_vote_deposit.key()==listing.clone().into_inner().vote_deposit @ StrangemoodError::ListingHasUnexpectedDeposit, 
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    #[account(
        has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter,
        constraint=charter_treasury_deposit.key()==charter_treasury.clone().into_inner().deposit @ StrangemoodError::CharterTreasuryHasUnexpectedDeposit,
        constraint=charter_treasury.mint==listings_payment_deposit.mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint,
    )]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(mut)]
    pub charter_treasury_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", charter_mint.key().as_ref()],
        bump = charter_mint_authority_bump,
    )]
    pub charter_mint_authority: AccountInfo<'info>,

    #[account(
        constraint=charter.mint==charter_mint.key() @ StrangemoodError::CharterHasUnexpectedMint,
        constraint=charter.reserve==charter_reserve.key() @ StrangemoodError::CharterHasUnexpectedReserve,
    )]
    pub charter: Box<Account<'info, Charter>>,

    pub purchaser: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(charter_mint_authority_bump: u8, receipt_escrow_authority_bump: u8)]
pub struct FinishTrial<'info> {

    #[account(mut,
        has_one=listing @ StrangemoodError::ReceiptHasUnexpectedListing, 
        has_one=purchaser @ StrangemoodError::ReceiptHasUnexpectedPurchaser,
        constraint=receipt.escrow==receipt_escrow.key() @ StrangemoodError::ReceiptHasUnexpectedEscrow
    )]
    pub receipt: Box<Account<'info, Receipt>>,

    /// CHECK: A purchaser is just a signer; we're not reading 
    /// or writing from it.
    /// The signer that purchased, who gets their SOL back that they used for the receipt.
    pub purchaser: AccountInfo<'info>,

    #[account(mut)]
    pub receipt_escrow: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", receipt_escrow.key().as_ref()],
        bump=receipt_escrow_authority_bump,
    )]
    pub receipt_escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub listings_payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        constraint=charter.key()==listing.clone().into_inner().charter @ StrangemoodError::ListingHasUnexpectedCharter,
        constraint=listings_payment_deposit.key()==listing.clone().into_inner().payment_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
        constraint=listings_vote_deposit.key()==listing.clone().into_inner().vote_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter,
        constraint=charter_treasury_deposit.key()==charter_treasury.clone().into_inner().deposit @ StrangemoodError::CharterTreasuryHasUnexpectedDeposit,
        constraint=charter_treasury.mint==listings_payment_deposit.mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint,
    )]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(mut)]
    pub charter_treasury_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", charter_mint.key().as_ref()],
        bump = charter_mint_authority_bump,
    )]
    pub charter_mint_authority: AccountInfo<'info>,

    // Box'd to move the charter (which is fairly hefty)
    // to the heap instead of the stack.
    // Not actually sure if this is a good idea, but
    // without the Box, we run out of space?
    #[account(
        constraint=charter.mint==charter_mint.key() @ StrangemoodError::CharterHasUnexpectedMint,
        constraint=charter.reserve==charter_reserve.key() @ StrangemoodError::CharterHasUnexpectedReserve,
    )]
    pub charter: Box<Account<'info, Charter>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(charter_mint_authority_bump: u8, receipt_escrow_authority_bump: u8)]
pub struct FinishTrialWithCashier<'info> {
    #[account(has_one=charter)]
    pub cashier: Box<Account<'info, Cashier>>,

    #[account(
        has_one=cashier @ StrangemoodError::CashierTreasuryHasUnexpectedCashier,
        constraint=cashier_treasury.escrow==cashier_treasury_escrow.key() @ StrangemoodError::CashierTreasuryHasUnexpectedEscrow,
        constraint=cashier_treasury.mint==charter_treasury.mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint,
        constraint=cashier_treasury.mint==listings_payment_deposit.mint @ StrangemoodError::CashierTreasuryHasUnexpectedMint,
    )]
    pub cashier_treasury: Box<Account<'info, CashierTreasury>>,

    #[account(mut)]
    pub cashier_treasury_escrow: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        has_one=listing @ StrangemoodError::ReceiptHasUnexpectedListing, 
        has_one=purchaser @ StrangemoodError::ReceiptHasUnexpectedPurchaser,
        constraint=receipt.escrow==receipt_escrow.key() @ StrangemoodError::ReceiptHasUnexpectedEscrow,
        constraint=receipt.cashier == Some(cashier.key()) @ StrangemoodError::ReceiptHasUnexpectedCashier,)
    ]
    pub receipt: Box<Account<'info, Receipt>>,

    /// CHECK: A purchaser is just a signer; we're not reading 
    /// or writing from it.
    // The signer that purchased, who gets their SOL back that they used for the receipt.
    pub purchaser: AccountInfo<'info>,

    #[account(mut)]
    pub receipt_escrow: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", receipt_escrow.key().as_ref()],
        bump=receipt_escrow_authority_bump,
    )]
    pub receipt_escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub listings_payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        constraint=charter.key()==listing.clone().into_inner().charter @ StrangemoodError::ListingHasUnexpectedCharter,
        constraint=listings_payment_deposit.key()==listing.clone().into_inner().payment_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
        constraint=listings_vote_deposit.key()==listing.clone().into_inner().vote_deposit @ StrangemoodError::ListingHasUnexpectedDeposit,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter,
        constraint=charter_treasury_deposit.key()==charter_treasury.clone().into_inner().deposit @ StrangemoodError::CharterTreasuryHasUnexpectedDeposit,
        constraint=charter_treasury.mint==listings_payment_deposit.mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint,
    )]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(mut)]
    pub charter_treasury_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", charter_mint.key().as_ref()],
        bump = charter_mint_authority_bump,
    )]
    pub charter_mint_authority: AccountInfo<'info>,

    #[account(
        constraint=charter.mint==charter_mint.key() @ StrangemoodError::CharterHasUnexpectedMint,
        constraint=charter.reserve==charter_reserve.key() @ StrangemoodError::CharterHasUnexpectedReserve,
    )]
    pub charter: Box<Account<'info, Charter>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8)]
pub struct Refund<'info> {
    pub purchaser: Signer<'info>,

    // Where we'll return the tokens back to 
    #[account(mut)]
    pub return_deposit: Account<'info, TokenAccount>,

    #[account(mut,
        has_one=listing @ StrangemoodError::ReceiptHasUnexpectedListing, 
        has_one=inventory @ StrangemoodError::ReceiptHasUnexpectedInventory, 
        has_one=purchaser @ StrangemoodError::ReceiptHasUnexpectedPurchaser,
        has_one=escrow @ StrangemoodError::ReceiptHasUnexpectedEscrow,
    )]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    pub escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub inventory: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(constraint=listing.mint==listing_mint.key() @ StrangemoodError::ListingHasUnexpectedMint)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mint_authority_bump: u8, inventory_delegate_bump:u8)]
pub struct Consume<'info> {
    #[account(
        has_one=authority @ StrangemoodError::ListingHasUnexpectedAuthority,
        has_one=mint @ StrangemoodError::ListingHasUnexpectedMint)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", mint.key().as_ref()],
        bump = mint_authority_bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"token_authority", inventory.key().as_ref()],
        bump = inventory_delegate_bump,
    )]
    pub inventory_delegate: AccountInfo<'info>,

    #[account(mut)]
    pub inventory: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,

    // The listing authority
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(mint_authority_bump: u8, decimals: u8)]
pub struct InitListing<'info> {
    // 8 for the tag
    // 1 for is_initialized
    // 1 for is_available 
    // 32 for charter
    // 32 for authority
    // 32 for payment_deposit
    // 32 for payment_deposit
    // 8 for price
    // 32 for mint 
    // 1 for is_refundable
    // 1 for is_consumable 
    // 8 for cashier_split
    // 256 for metadata URI
    // 128 for future versions
    #[account(init, seeds=[b"listing", mint.key().as_ref()], bump, payer = authority, space = 8 + 1 + 1 + 32 + 32 + 32 + 32 + 8 + 32 + 1 + 1 + 8 + 256 + 128)]
    pub listing: Box<Account<'info, Listing>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds = [b"mint_authority", mint.key().as_ref()],
        bump = mint_authority_bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    #[account(init, mint::decimals = decimals, mint::authority = mint_authority, mint::freeze_authority = mint_authority, payer = authority)]
    pub mint: Box<Account<'info, Mint>>,

    // The charter that this listing will belong to, effectively determining it's governance.
    pub charter: Box<Account<'info, Charter>>,

    // The charter treasury that proves that this governance supports the payment method
    // that this charter is using.
    #[account(has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter)]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(constraint=payment_deposit.mint==charter_treasury.mint @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(constraint=vote_deposit.mint==charter.mint @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub vote_deposit: Box<Account<'info, TokenAccount>>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,

    // The soon to be authority of the listing
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListing<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::ListingHasUnexpectedAuthority)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListingDeposit<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::ListingHasUnexpectedAuthority, has_one=charter @ StrangemoodError::ListingHasUnexpectedCharter)]
    pub listing: Account<'info, Listing>,

    #[account(constraint=charter_treasury.mint==payment_deposit.mint @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub payment_deposit: Account<'info, TokenAccount>,

    #[account(constraint=vote_deposit.mint==charter.mint @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub vote_deposit: Account<'info, TokenAccount>,

    pub charter: Account<'info, TokenAccount>,

    #[account(has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter)]
    pub charter_treasury: Account<'info, CharterTreasury>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListingAuthority<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::ListingHasUnexpectedAuthority)]
    pub listing: Account<'info, Listing>,

    /// CHECK: This is an authority, and we're not reading or writing from it.
    pub new_authority: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct SetListingCharter<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::ListingHasUnexpectedAuthority)]
    pub listing: Account<'info, Listing>,

    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct InitCharter<'info> {
    // 8 for the tag
    // 8 + 1 + 8 + 1 + 8 + 1 + 32 + 32 + 32 + 256 for the charter
    // 256 as a buffer for future versions
    #[account(init, seeds = [b"charter", mint.key().as_ref()], bump, payer = user, space = 8 + 8 + 1 + 8 + 1 + 8 + 1 + 32 + 32 + 32 + 256 + 256)]
    pub charter: Account<'info, Charter>,

    pub mint: Account<'info, Mint>,

    /// CHECK: This is an authority, and we're not reading or writing from it.
    pub authority: AccountInfo<'info>,

    pub reserve: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharter<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority)]
    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterReserve<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority)]
    pub charter: Account<'info, Charter>,

    pub reserve: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterAuthority<'info> {
    #[account(mut, has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority)]
    pub charter: Account<'info, Charter>,

    /// CHECK: This is an authority, and we're not reading or writing from it.
    pub new_authority: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct InitCharterTreasury<'info> {
    // 8 for the tag
    // 1 is initialiezd
    // 32 for cashier
    // 32 for escrow 
    // 32 for mint
    // 8 for scalar
    // 256 as a buffer for future versions
    #[account(init,
        seeds = [b"treasury", charter.key().as_ref(), mint.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 1 + 32 + 32 + 32 + 8 + 256
    )]
    pub treasury: Account<'info, CharterTreasury>,

    #[account(
        has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority,
    )]
    pub charter: Account<'info, Charter>,

    #[account(
        has_one=mint @ StrangemoodError::TokenAccountHasUnexpectedMint
    )]
    pub deposit: Account<'info, TokenAccount>,

    // The mint of the deposit account 
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterTreasuryExpansionScalar<'info> {
    #[account(mut, has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter)]
    pub treasury: Account<'info, CharterTreasury>,

    #[account(has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority)]
    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterTreasuryDeposit<'info> {
    #[account(mut, has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter, has_one=mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint)]
    pub treasury: Account<'info, CharterTreasury>,

    #[account(has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority)]
    pub charter: Account<'info, Charter>,

    #[account(has_one=mint @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub deposit: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stake_authority_bump: u8)]
pub struct InitCashier<'info> {
    // 8 for the tag
    // 1 for is_initalized 
    // 32 for charter
    // 32 for stake
    // 8 for last_withdraw_at
    // 32 for authority
    // 256 for URI
    // 128 for future versions
    #[account(init,
        seeds = [b"cashier", stake.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 1 + 32 + 32 + 8 + 256 + 128
    )]
    pub cashier: Account<'info, Cashier>,

    #[account(init,
        payer=authority,
        token::mint = charter_mint,
        token::authority = stake_authority
    )]
    pub stake: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", stake.key().as_ref()],
        bump=stake_authority_bump,
    )]
    pub stake_authority: AccountInfo<'info>,

    #[account(
        constraint=charter.mint == charter_mint.key() @ StrangemoodError::CharterHasUnexpectedMint
    )]
    pub charter: Account<'info, Charter>,
    pub charter_mint: Account<'info, Mint>,

    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}


#[derive(Accounts)]
#[instruction(escrow_authority_bump: u8)]
pub struct InitCashierTreasury<'info> {
    // 8 for the tag 
    // 1 for is_initialized
    // 32 for cashier
    // 32 for escrow
    // 32 for deposit 
    // 32 for mint 
    // 8 for last_withdraw_epoch
    // 128 for future verisons
    #[account(
        init, 
        seeds = [b"treasury", cashier.key().as_ref(), mint.key().as_ref()],
        bump,
        payer=authority,
        space= 8 + 1 + 32 + 32 + 32 + 32 + 8 + 128
    )]
    pub cashier_treasury: Box<Account<'info, CashierTreasury>>,

    #[account(has_one=authority @ StrangemoodError::CashierHasUnexpectedAuthority,
        has_one=charter @ StrangemoodError::CashierHasUnexpectedCharter)]
    pub cashier: Box<Account<'info, Cashier>>, 

    #[account(
        has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter,
        has_one=mint @ StrangemoodError::CharterTreasuryHasUnexpectedMint
    )]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,
    pub charter: Box<Account<'info, Charter>>,

    #[account(has_one=mint @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub deposit: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer=authority,
        token::mint = mint,
        token::authority = escrow_authority
    )]
    pub escrow: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", escrow.key().as_ref()],
        bump=escrow_authority_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}

#[derive(Accounts)]
#[instruction(stake_authority_bump: u8)]
pub struct BurnCashierStake<'info> {
    #[account(
        has_one=authority @ StrangemoodError::CharterHasUnexpectedAuthority,
        has_one=mint @ StrangemoodError::CharterHasUnexpectedMint
    )]
    pub charter: Account<'info, Charter>,

    #[account(
        has_one=charter @ StrangemoodError::CashierHasUnexpectedCharter, 
        has_one=stake @ StrangemoodError::CashierHasUnexpectedStake
    )]
    pub cashier: Account<'info, Cashier>,

    #[account(mut, has_one=mint @ StrangemoodError::CharterHasUnexpectedMint)]
    pub stake: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", stake.key().as_ref()],
        bump=stake_authority_bump,
    )]
    pub stake_authority: AccountInfo<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}


#[derive(Accounts)]
#[instruction(mint_authority_bump: u8, cashier_escrow_bump: u8)]
pub struct WithdrawCashierTreasury<'info> {
    #[account(constraint=charter.mint==vote_mint.key() @ StrangemoodError::CharterHasUnexpectedMint)]
    pub charter: Box<Account<'info, Charter>>,

    // The treasury of the charter
    #[account(mut, has_one=charter @ StrangemoodError::CharterTreasuryHasUnexpectedCharter)]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(has_one=charter @ StrangemoodError::CashierHasUnexpectedCharter, 
        has_one=stake @ StrangemoodError::CashierHasUnexpectedStake)]
    pub cashier: Box<Account<'info, Cashier>>, 

    // The token account that contains the stake 
    // the cashier has in the network
    #[account(constraint=stake.mint==vote_mint.key() @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub stake: Box<Account<'info, TokenAccount>>,

    // The treasury that binds the escrow, deposit, and 
    // cashier together
    #[account(
        has_one=cashier @ StrangemoodError::CashierTreasuryHasUnexpectedCashier,
        has_one=escrow @ StrangemoodError::CashierTreasuryHasUnexpectedEscrow,
        has_one=deposit @ StrangemoodError::CashierTreasuryHasUnexpectedDeposit,
        constraint=cashier_treasury.mint==payment_mint.key() @ StrangemoodError::CashierTreasuryHasUnexpectedMint
    )]
    pub cashier_treasury: Box<Account<'info, CashierTreasury>>,

    // Where the tokens are right now 
    #[account(
        mut,
        constraint=escrow.mint==payment_mint.key() @ StrangemoodError::TokenAccountHasUnexpectedMint
    )]
    pub escrow: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", escrow.key().as_ref()],
        bump=cashier_escrow_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    // Where the tokens will end up after we withdraw
    #[account(mut, 
        constraint=deposit.mint==payment_mint.key()  @ StrangemoodError::TokenAccountHasUnexpectedMint
    )]
    pub deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payment_mint: Box<Account<'info, Mint>>,

    // The governance token mint
    pub vote_mint: Box<Account<'info, Mint>>,

    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}


#[derive(Accounts)]
#[instruction(stake_authority_bump: u8)]
pub struct WithdrawCashierStake<'info> {
    #[account(mut, constraint=charter.mint==vote_mint.key() @ StrangemoodError::CharterHasUnexpectedMint)]
    pub charter: Box<Account<'info, Charter>>,

    #[account(
        has_one=charter @ StrangemoodError::CashierHasUnexpectedCharter, 
        has_one=stake @ StrangemoodError::CashierHasUnexpectedStake
    )]
    pub cashier: Box<Account<'info, Cashier>>, 

    // The token account that contains the stake 
    // the cashier has in the network
    #[account(constraint=stake.mint==vote_mint.key() @ StrangemoodError::TokenAccountHasUnexpectedMint)]
    pub stake: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is a PDA, and we're not reading or writing from it.
    #[account(
        seeds=[b"token_authority", stake.key().as_ref()],
        bump=stake_authority_bump,
    )]
    pub stake_authority: AccountInfo<'info>,

    // Where the tokens will end up after we withdraw
    #[account(mut, 
        constraint=deposit.mint==vote_mint.key() @ StrangemoodError::TokenAccountHasUnexpectedMint
    )]
    pub deposit: Box<Account<'info, TokenAccount>>,

    // The governance token mint
    pub vote_mint: Box<Account<'info, Mint>>,

    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}

