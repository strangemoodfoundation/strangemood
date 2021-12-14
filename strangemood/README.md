# Strangemood

### Environment Setup

1. Install Rust from https://rustup.rs/
2. Install Solana from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool
3. Ensure that libssl is installed: `sudo apt install libssl-dev` (or `brew install openssl` on macOS)
4. Ensure libudev is installed: `sudo apt install libudev-dev`

### Build and test for program compiled natively

```
$ cargo build
$ cargo test
```

### Build and test the program compiled for BPF

```
$ cargo build-bpf
$ cargo test-bpf
```

---

## Helpful definitions

**Governance:**

- lets you create new "stuff", like DAOs. You can create many DAOs.
- does not use the term DAO, because DAO is not all encompassing.
- Realm is used to describe this governance

**Realm:**

- has Mints, the voting power, called communityMint

**Listing Mint**

- every purchase from the listing creates a token from the listing mint

**Listing**

- listing is a wrapper around the listing mint, including data like price and owner

---

## Examples

```js
/**
 * Purchasing Listings:
 *
 * - Listings are purchasable.
 * - Purchasing a listing, involves a fee and returns a token.
 * - Purchasing with SOL is possible through a listing-specific (or mint-specific) wrapped SOL account.
 * - This wrapped account is pre-loaded with enough SOL to cover the costs of purchasing the listing.
 * - The purchased token, is stored in a mint-specific token account. This account is deterministically derived based on the program/mint/purchaser combination. Only the purchaser has ownership over this account.
 *
 * This results in:
 * 1) a wrapped sol account for paying
 * 2) a token account, with a deterministic account address
 *
 */
```
