use anchor_lang::solana_program::system_instruction;
use anchor_lang::{prelude::*, solana_program};

pub fn mint_to_and_freeze<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> Result<()> {
    mint_to(
        token_program.clone(),
        mint.clone(),
        to.clone(),
        authority.clone(),
        bump,
        amount,
    )?;
    freeze_account(token_program, mint, to, authority, bump)
}

pub fn mint_to<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> Result<()> {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::MintTo {
        mint: mint,
        to: to,
        authority: authority,
    };
    let seeds = &[b"mint_authority", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::mint_to(cpi_ctx, amount)
}

pub fn freeze_account<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
) -> Result<()> {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::FreezeAccount {
        mint: mint,
        account: account,
        authority: authority,
    };
    let seeds = &[b"mint_authority", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::freeze_account(cpi_ctx)
}

// Transfer from one token account to another using the Token Program
pub fn token_transfer_with_seed<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
    seed_label: &[u8],
    bump: u8,
) -> Result<()> {
    let cpi_program = token_program;
    let key = from.key.clone();
    let cpi_accounts = anchor_spl::token::Transfer {
        from,
        to,
        authority,
    };
    let seeds = &[seed_label, key.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::transfer(cpi_ctx, amount)
}

pub fn token_transfer<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
) -> Result<()> {
    let cpi_program = token_program;
    let cpi_accounts = anchor_spl::token::Transfer {
        from,
        to,
        authority,
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    anchor_spl::token::transfer(cpi_ctx, amount)
}

pub fn burn<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> Result<()> {
    let cpi_program = token_program;
    let cloned_account = account.key.clone();
    let cpi_accounts = anchor_spl::token::Burn {
        mint,
        to: account,
        authority,
    };
    let seeds = &[b"token_authority", cloned_account.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::burn(cpi_ctx, amount)
}

pub fn sync_native<'a>(token_program: &AccountInfo<'a>, account: AccountInfo<'a>) -> Result<()> {
    let ix = spl_token::instruction::sync_native(&token_program.key(), &account.key())?;

    solana_program::program::invoke(&ix, &[account.clone()]).map_err(Into::into)
}

pub fn system_transfer<'a>(
    system_program: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
) -> Result<()> {
    let ix = system_instruction::transfer(&from.key(), &to.key(), lamports);

    solana_program::program::invoke(&ix, &[from.clone(), to.clone(), system_program.clone()])
        .map_err(Into::into)
}

pub fn erase_data<'a>(account: &AccountInfo<'a>) {
    let mut data = account.data.borrow_mut();
    data.fill(0);
}

pub fn move_lamports<'a>(
    source_account_info: &AccountInfo<'a>,
    dest_account_info: &AccountInfo<'a>,
    amount: u64,
) {
    let dest_starting_lamports = dest_account_info.lamports();
    **dest_account_info.lamports.borrow_mut() = dest_starting_lamports.checked_add(amount).unwrap();
    **source_account_info.lamports.borrow_mut() =
        source_account_info.lamports().checked_sub(amount).unwrap();
}

pub fn close_native_account<'a>(
    source_account_info: &AccountInfo<'a>,
    dest_account_info: &AccountInfo<'a>,
) {
    let dest_starting_lamports = dest_account_info.lamports();
    **dest_account_info.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(source_account_info.lamports())
        .unwrap();
    **source_account_info.lamports.borrow_mut() = 0;

    erase_data(source_account_info);
}

pub fn close_token_escrow_account<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
) -> Result<()> {
    let cpi_program = token_program;
    let key = from.key.clone();
    let cpi_accounts = anchor_spl::token::CloseAccount {
        authority,
        account: from,
        destination: to,
    };
    let seeds = &[b"token_authority", key.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::close_account(cpi_ctx)
}
